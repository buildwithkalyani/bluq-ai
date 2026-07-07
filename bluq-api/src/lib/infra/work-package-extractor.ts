// Work Package Extractor
// Claude reads uploaded documents and outputs schedulable work packages with
// quantities, dependencies, and resource requirements — ready for RCPSP optimization.

import { ParsedDocument, toClaudeContent } from "../parsers.js";
import type {
  ExtractedScheduleInput,
  ProjectType,
  ProductivityOverrides,
} from "./work-package-types.js";

export type { ExtractedScheduleInput, InfrastructureType, BuildingCategory, ProjectType, ProductivityOverrides } from "./work-package-types.js";

// ─── Shared Schema Description ─────────────────────────────────────────────────

const SCHEMA = `
Return a single JSON object matching this exact schema:

{
  "infraType": string,
  "workPackages": [
    {
      "id": string,                   // SHORT_UPPERCASE e.g. "PIER_P01", "EARTH_S03"
      "name": string,                 // human readable e.g. "Pier P1 Construction"
      "phase": string,                // phase name e.g. "substructure", "earthwork"
      "quantity": number,
      "unit": string,                 // "m³" | "m²" | "m" | "no." | "RM"
      "resourceType": string,         // from the allowed list below
      "resourceUnitsRequired": number,// simultaneous units needed (usually 1)
      "productivityRate": number,     // quantity units per day per resource unit
      "productivityBasis": "document"|"indian_norm",
      "predecessors": [
        { "id": string, "type": "FS"|"SS", "lagDays": number }
      ],
      "monsoonSensitive": boolean,
      "zoneId": string,               // spatial zone ID e.g. "zone_left_approach"
      "spatialConstraints": {
        "maxConcurrentInZone": number, // max activities in this zone at once (1 = exclusive)
        "accessRoute": string,         // haul road / access path e.g. "haul_road_A", "river_barge"
        "directionForced": boolean,    // true if sequence direction is fixed by geometry
        "directionNote": string        // e.g. "paving proceeds from Ch 0+000 toward Ch 18+000"
      },
      "quantityBasis": "boq"|"drawing_measured"|"estimated",
      "notes": string                 // optional
    }
  ],
  "availableResourceTypes": [
    {
      "type": string,
      "defaultCount": number,
      "description": string,
      "resourceBasis": "document"|"assumed"
    }
  ],
  "monsoonMonths": [number],          // e.g. [6,7,8,9] for peninsular India
  "extractionSummary": {
    "totalPackages": number,
    "boqDerived": number,
    "drawingMeasured": number,
    "estimated": number,
    "missingData": [string]
  }
}

Allowed resourceType values:
  piling_rig | formwork_crew | launching_gantry | paving_train | excavator_fleet |
  concrete_pump | crane | tbm | natm_heading_crew | dredger | general_civil_crew |
  mep_crew | track_laying_crew | erection_crew

Dependency types:
  FS = Finish-to-Start (successor starts after predecessor finishes + lagDays)
  SS = Start-to-Start (successor starts lagDays after predecessor starts)

General rules:
- Create 30–80 work packages. Too few = no optimization. Too many = slow.
- Aim for: per-element granularity for repeated elements (piers, spans, sections)
- For linear projects (highway, railway): split into 5–10km sections
- For point projects (bridge, WTP): split by element (pier, span, unit)
- If BOQ has quantities, use them. Divide total by element count for per-element quantity.
- If no BOQ, measure from drawings or estimate from typical Indian norms.
- Always define predecessors — a package with no predecessors starts at day 0.
- monsoonSensitive=true for: earthwork, bituminous, open excavation, tunnelling (high water ingress)
- monsoonSensitive=false for: piling (with care), concrete with cover, indoor MEP
- lagDays after concrete pour: 28 for load-bearing, 7 for non-structural

Resource extraction rules (READ BEFORE ASSIGNING availableResourceTypes):
- FIRST: Scan all uploaded documents for any method statement, mobilisation plan, equipment list,
  or contract clause mentioning specific equipment. Look for:
  "equipment to be deployed", "mobilisation schedule", "plant and machinery", "resources planned",
  "we propose to use", "contractor shall deploy", "TBM diameter", "number of piling rigs".
- If found: extract the equipment type, count, and any capacity/spec mentioned.
  Map to the nearest resourceType from the allowed list.
  Set defaultCount from the document (e.g. "2 Liebherr LB28 rigs" → defaultCount: 2).
  Set description to what the document actually says (e.g. "Liebherr LB28 hydraulic rotary, 28m kelly bar").
  Set resourceBasis: "document".
- If NOT found: assume standard deployment for this project type and scale.
  Set defaultCount based on typical Indian contractor deployment.
  Set description to a generic description of the resource.
  Set resourceBasis: "assumed".
- Only include resource types actually used by work packages in this project.

Productivity rate rules (CRITICAL — read this carefully):
- FIRST: Scan all uploaded documents for any of these: "productivity", "output norms",
  "rate analysis", "MoRT&H output norms", "equipment output", "cycle time", "daily output".
  These may appear in: a separate productivity document, DPR appendix, method statement, or BOQ preamble.
- If you find a project-specific rate for a work type → USE IT. Set productivityBasis="document".
  Example: document says "excavator output = 620 m³/day in black cotton soil" → use 620.
- If NOT found → use the Indian norm fallback below. Set productivityBasis="indian_norm".
  AND add an entry to missingData: "Productivity rate for [resourceType] not in documents — Indian IS/MoRT&H norm applied ([rate] [unit]/day)".
  Example: "Productivity rate for paving_train not in documents — Indian MoRT&H norm applied (900 m²/day)".
- productivityRate is always per single resource unit per day.
  e.g. if 2 excavators achieve 1000 m³/day → productivityRate = 500 (per excavator).

Spatial rules (READ PLAN AND SITE LAYOUT DRAWINGS CAREFULLY):
- zoneId: assign the same zoneId to packages that occupy the same physical location.
  e.g. all work at Pier P3 gets zoneId="zone_pier_P03"
  e.g. highway section Ch5–Ch10 gets zoneId="zone_section_S02"
- maxConcurrentInZone: how many activities can physically happen in this zone at once.
  Same pier location = 1 (only one crew can work at a pier at a time).
  Same highway section = 2 (earthwork and drainage can overlap, but not earthwork and paving).
  Large yard area = 3–4.
- accessRoute: identify from site layout or plan drawings which haul road / barge / river
  serves each package. Packages sharing an access route compete for traffic throughput.
  If no site layout drawing, infer from geography (river bank → barge; isolated pier → dedicated road).
- directionForced: true when geometry forces a construction direction.
  Paving trains always move in one direction (true).
  TBM drives in one direction (true).
  Bridge piers can be built in any order (false).
  Tunnel adits force heading direction (true).
- directionNote: describe the forced direction clearly so the optimizer enforces ordering.
`;

const BASE_INSTRUCTION = `You are an expert infrastructure construction planner for Indian projects.
Read the uploaded documents carefully. Extract a work breakdown structure as schedulable work packages.
Your output will feed directly into a constraint-based schedule optimizer (RCPSP).
${SCHEMA}
Respond with ONLY the JSON object. No markdown, no explanation.`;

// ─── Infrastructure-Type Prompts ───────────────────────────────────────────────

function buildHighwayPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: HIGHWAY (4-lane / 6-lane / Expressway)

WORK BREAKDOWN GUIDANCE:
Split the highway into chainage sections (aim for 5–10km sections).
For each section create packages: earthwork → drainage → sub-base → base → bituminous.
Bridges and underpasses get their own packages separate from the section pavement.

Expected phases and resource types:
  earthwork       → excavator_fleet     (monsoonSensitive: true)
  drainage        → general_civil_crew  (monsoonSensitive: false)
  bridge_sub      → formwork_crew + piling_rig
  bridge_super    → launching_gantry or crane
  sub_base        → general_civil_crew  (monsoonSensitive: false)
  base_course     → general_civil_crew  (monsoonSensitive: false)
  bituminous      → paving_train        (monsoonSensitive: true)
  safety_furniture→ general_civil_crew
  toll_its        → general_civil_crew

Standard dependencies:
  earthwork[Sn] → sub_base[Sn] (FS, lag 7 days for compaction)
  sub_base[Sn]  → base[Sn]    (FS, lag 3 days)
  base[Sn]      → bituminous[Sn] (FS, lag 7 days)
  Adjacent sections can start SS with 14-day lag (rolling construction).
  bridge_sub → bridge_super (FS, lag 28 days for concrete cure)
  All pavement must complete before safety_furniture.

Quantity extraction:
  From BOQ: find earthwork (m³), sub-base (m³ or m²), DBM/BC (m² or tonnes), concrete (m³).
  Divide totals by number of sections proportionally by chainage length.
  Bridges: concrete m³ from BOQ or estimate = 0.6 m³/m² deck area for PSC girder bridges.
  If BOQ not available, estimate earthwork = length × average cut/fill height × carriageway width.

Indian norm fallback productivity rates (use only if no productivity document found):
  earthwork (alluvial/sandy soil)  → excavator_fleet:    600 m³/day
  earthwork (black cotton soil)    → excavator_fleet:    400 m³/day
  earthwork (rock cutting)         → excavator_fleet:    200 m³/day
  granular sub-base (GSB)          → general_civil_crew: 400 m²/day
  wet mix macadam (WMM)            → general_civil_crew: 350 m²/day
  dense bituminous macadam (DBM)   → paving_train:       900 m²/day
  bituminous concrete (BC)         → paving_train:       800 m²/day
  bridge piling (bored cast in-situ)→ piling_rig:        18 RM/day
  bridge pier concrete (M30)       → formwork_crew:      12 m³/day
  PSC girder erection              → launching_gantry:   2 spans/day (set unit="no.", rate=2)
  deck slab concrete               → concrete_pump:      25 m³/day
  drainage structures (culverts)   → general_civil_crew: 1 no./day
  Use the soil type from project documents to select the correct earthwork rate.

SPATIAL ANALYSIS (read alignment plan + site layout drawings):
  Zones: each chainage section is a zone ("zone_S01" for Ch 0–5km, "zone_S02" for Ch 5–10km etc).
  Zone boundaries: look for natural breaks — rivers, towns, interchanges, forest patches.
  accessRoute: highway sections typically share one haul road running parallel to alignment.
    If you see a separate access road for the bridge from the site layout, assign it differently.
    Identify from the plan if construction traffic enters from one end or both ends.
  directionForced=true for all pavement packages — paving train moves in one direction.
    Note the direction: "paving proceeds from Ch 0+000 toward Ch X+XXX" from the plan drawing.
  maxConcurrentInZone: for highway sections = 2 (earthwork + drainage can overlap).
    For bridge pier zones = 1 (only one formwork crew per pier location).
  If site layout shows a batching plant location, note which sections it serves directly
  vs which sections require longer concrete haul (affects productivity, note in notes field).`;
}

function buildBridgePrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: BRIDGE (Major / Minor / Cable-Stayed)

WORK BREAKDOWN GUIDANCE:
Bridge construction is element-by-element. Create packages per pier and per span.
Group piers into zones based on physical location (approach vs main span area).

Expected phases and packages:
  PILING: one package per pier group (if pile cap serves 1 pier, per pier; if raft, per zone)
  PILE_CAP: one per pier
  PIER: one per pier (include column + pier cap)
  CAP_BEAM: one per pair of piers (or per bent)
  GIRDER_ERECTION: one per span
  DECK_SLAB: one per span
  APPROACH: two packages (approach 1 and approach 2)
  FINISHING: one aggregate package

Resource types:
  piling_rig      → PILING
  formwork_crew   → PILE_CAP, PIER, CAP_BEAM
  launching_gantry or crane → GIRDER_ERECTION
  concrete_pump   → DECK_SLAB
  general_civil_crew → APPROACH, FINISHING

Standard dependencies:
  PILING[Px]     → PILE_CAP[Px]  (FS, lag 3 days)
  PILE_CAP[Px]   → PIER[Px]      (FS, lag 7 days for cure)
  PIER[Px]       → CAP_BEAM[Px]  (FS, lag 28 days for cure)
  CAP_BEAM[Px]   → GIRDER[Span_x] (FS, lag 0)  [both adjoining piers must finish]
  GIRDER[Sx]     → DECK[Sx]      (FS, lag 3 days)
  Piers in different zones (non-adjacent) can be built in parallel.
  Spans can be erected sequentially or simultaneously if resources allow.

Quantity extraction:
  Piers: concrete volume = BOQ substructure concrete ÷ pier count (or from pier dimensions)
  Piles: total RM from BOQ ÷ pile count = average pile length per package
  Girders: count from span arrangement in drawings
  Deck: deck area = total length × width (from drawings)

Indian norm fallback productivity rates:
  bored cast in-situ piling         → piling_rig:        18 RM/day per rig
  well foundation sinking           → general_civil_crew: 0.5 m/day per crew
  pile cap concrete (M30)           → formwork_crew:      15 m³/day
  pier concrete (M35, up to 15m)    → formwork_crew:      10 m³/day
  pier concrete (M35, 15–30m)       → formwork_crew:      7 m³/day
  cap beam concrete                 → formwork_crew:      12 m³/day
  PSC girder erection               → launching_gantry:   2 spans/day
  deck slab (cast in-situ)          → concrete_pump:      20 m³/day
  approach embankment               → excavator_fleet:    500 m³/day
  For river bridges: reduce piling rate by 30% for water pier packages (barge operations slower).

SPATIAL ANALYSIS (read GA plan drawing and foundation layout):
  Zones: each pier gets its own zone ("zone_pier_P01" etc). Each span gets its own zone.
  accessRoute: read the plan drawing to identify how each pier is accessed.
    River bridge: piers in water → "river_barge_access"; bank piers → "haul_road_bank_L" or "_R".
    Valley bridge: check if access road shown on drawing — some piers may need separate access tracks.
    If all piers accessible from one service road → "main_service_road".
  maxConcurrentInZone: pier zones = 1 (formwork is exclusive to one pier at a time).
    Exception: if two pile caps are far apart and separate cranes shown → can be 2.
  directionForced: false for individual bridge piers (can be built in any order).
    Exception: launching gantry — spans must be erected sequentially in the gantry travel direction.
    Set directionForced=true for all GIRDER packages with direction note matching gantry travel.
  Look for: separate access jetties for water piers (note as separate accessRoute per pier).
  Look for: temporary coffer dam or island shown for deep-water piers (affects concurrent limit).`;
}

function buildMetroPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: METRO RAIL (Elevated / Underground)

WORK BREAKDOWN GUIDANCE:
For elevated sections: split by inter-station viaduct segment + each station separately.
For underground sections: each tunnel drive (up/down) + each station box.

Expected phases:
  PILING          → piling_rig         (per station / per viaduct section)
  PIER_VIADUCT    → formwork_crew      (per viaduct section, ~500m each)
  DECK_VIADUCT    → launching_gantry   (per viaduct section)
  STATION_CIVIL   → formwork_crew + general_civil_crew  (per station)
  TBM_DRIVE       → tbm               (per drive — one per tunnel tube per reach)
  STATION_BOX     → general_civil_crew (per station — concurrent with TBM drives)
  TRACK_LAYING    → track_laying_crew  (SS with civil completion, lag 30 days)
  SYSTEMS_OHE     → mep_crew          (after track, per section)
  SYSTEMS_SIGNALING→ mep_crew         (after OHE, aggregate)
  DEPOT           → general_civil_crew (parallel to main works)
  TESTING         → general_civil_crew (after all civil complete)

Standard dependencies:
  PILING[station] → STATION_CIVIL[station] (FS, lag 7 days)
  Viaduct section N → Viaduct section N+1 can SS with 30-day lag (rolling)
  All civil must reach a section before track laying starts in that section.
  Systems work starts after track is complete (SS with 60-day lag).

Quantity extraction:
  Viaduct: deck area = viaduct length × deck width (~12m for metro)
  TBM drives: tunnel length in meters per drive
  Stations: floor area from drawings or estimate 150m × 25m per elevated station

Indian norm fallback productivity rates:
  metro viaduct piling              → piling_rig:        20 RM/day
  metro pier (precast or cast in-situ)→ formwork_crew:  1 pier/5 days per crew
  viaduct deck (precast U-girder)   → launching_gantry:  3 spans/day
  TBM tunnelling (soft ground)      → tbm:               8–12 m/day (use 10)
  TBM tunnelling (mixed face)       → tbm:               6 m/day
  station box excavation            → excavator_fleet:   200 m³/day (confined urban)
  station civil (structure)         → formwork_crew:     50 m²/day (slab area)
  track laying (metro)              → track_laying_crew: 100 m/day
  OHE installation                  → mep_crew:          150 m/day

SPATIAL ANALYSIS (read metro alignment plan and station layout drawings):
  Zones: each inter-station viaduct segment is a zone; each station is its own zone.
  accessRoute: urban metro — each station/segment likely has a different access road.
    Read the plan to identify which road each station fronts onto.
    If plan not available, assign "urban_road_access" with station name suffix.
  Underground stations: directionForced=true for TBM drives (TBM moves one direction).
    Note which end the TBM launches from in directionNote.
  Elevated viaduct: launching gantry travels in one direction → directionForced=true for deck packages.
  maxConcurrentInZone: station box = 1 (one excavation crew per station box).
    Viaduct pier zone = 1. TBM drive = 1 per tube.
  Look for: junction structures between elevated and underground — these are complex zones,
    set maxConcurrentInZone=1 and note the constraint.`;
}

function buildTunnelPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: TUNNEL (Road / Railway / Water Conveyance)

WORK BREAKDOWN GUIDANCE:
Split tunnel by drive direction and by adit access. Each tube is a separate drive.
NATM: break into heading lengths (~200–500m per package between adits/portals).
TBM: one package per drive (portal-to-portal or portal-to-adit).
Cut-and-cover: split by chainage sections (~100m each).

Expected phases:
  PORTAL_CIVIL    → general_civil_crew  (portal construction, 2 packages — one per end)
  ADIT_DRIVE      → natm_heading_crew   (if adits present, one per adit)
  MAIN_DRIVE      → natm_heading_crew or tbm  (per heading per adit reach)
  LINING          → formwork_crew       (SS with heading, lag = heading length lead time)
  WATERPROOFING   → general_civil_crew  (FS after lining per section)
  VENT_SHAFT      → general_civil_crew  (if applicable)
  ROAD_WORKS      → general_civil_crew  (fit-out: road surface, drainage, kerbs)
  MEP_TUNNEL      → mep_crew           (ventilation, lighting, signage — after road works)
  TESTING         → general_civil_crew  (final)

Standard dependencies:
  PORTAL_CIVIL → MAIN_DRIVE (FS, lag 14 days)
  ADIT_DRIVE   → MAIN_DRIVE_from_adit (FS, lag 0)
  MAIN_DRIVE heading → LINING (SS, lagDays = time to excavate one lining bay, ~5 days)
  LINING → WATERPROOFING (FS, lag 7 days)
  Both tubes must complete lining before ROAD_WORKS.
  ROAD_WORKS → MEP_TUNNEL (SS, lag 30 days)

Quantity extraction:
  Drive lengths: from tunnel length / number of drives (accounting for adits)
  Concrete lining: excavated area × lining thickness × drive length
  If NATM: shotcrete rounds estimate = drive length / 1.2m advance per round

Indian norm fallback productivity rates:
  NATM heading — Rock Class I/II    → natm_heading_crew:  4 m/day
  NATM heading — Rock Class III     → natm_heading_crew:  2.5 m/day
  NATM heading — Rock Class IV/V    → natm_heading_crew:  1 m/day
  TBM — hard rock                   → tbm:               10 m/day
  TBM — soft ground/mixed           → tbm:               12 m/day
  Shotcrete lining (per round)      → natm_heading_crew:  included in heading rate above
  Cast in-situ concrete lining      → formwork_crew:      3 m/day (ring advance)
  Cut and cover excavation          → excavator_fleet:    150 m³/day (urban, confined)
  Portal construction               → general_civil_crew: 30 m³/day concrete
  Adjust NATM rate down by 30% for high water ingress (Rock Class IV/V with pumping).

SPATIAL ANALYSIS (read tunnel alignment plan, portal drawings, adit layout):
  Zones: each heading (portal-to-adit or adit-to-adit) is a separate zone.
    Portal zones ("zone_portal_A", "zone_portal_B") are exclusive during construction.
  accessRoute: read portal drawings — identify whether each portal has road access or needs new road.
    Adit portals: assign separate accessRoute per adit ("adit_1_access", "adit_2_access").
    Main portals: usually "portal_A_road" and "portal_B_road".
  directionForced=true for all heading drives — excavation always moves away from the portal.
    Note direction: "heading advances from Portal A toward Portal B" or "from Adit 2 toward Portal B".
  maxConcurrentInZone=1 for each heading (one crew per heading face).
  TBM: if twin-tube, two TBMs can drive simultaneously — separate zones per tube.
  Look for: ventilation shaft locations on plan — shaft construction zone overlaps with heading zone,
    set maxConcurrentInZone=1 between shaft and nearest heading during shaft sinking.`;
}

function buildRailwayPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: MAINLINE RAILWAY (New Line / Doubling / Gauge Conversion)

WORK BREAKDOWN GUIDANCE:
Split by ~10km sections. Major bridges get their own packages.
Station works are separate packages per station.

Expected phases per section:
  LAND_CLEARING   → general_civil_crew
  EARTHWORK       → excavator_fleet     (monsoonSensitive: true)
  DRAINAGE_CULVERTS→ general_civil_crew
  BRIDGES_SUB     → formwork_crew + piling_rig  (per major bridge)
  BRIDGES_SUPER   → erection_crew               (per major bridge)
  ROBS            → formwork_crew       (per ROB)
  BALLAST_TRACK   → track_laying_crew   (FS earthwork, lag 14 days)
  TRACK_LINKING   → track_laying_crew   (aggregate, after all sections)
  STATION_CIVIL   → general_civil_crew  (per station, parallel to trackwork)
  OHE             → mep_crew           (if electrified, SS trackwork lag 30 days)
  SIGNALING       → mep_crew           (after OHE)
  TESTING_CRS     → general_civil_crew  (CRS inspection, final)

Standard dependencies:
  EARTHWORK[Sn] → BALLAST_TRACK[Sn] (FS, lag 14 days)
  BALLAST_TRACK[Sn] → TRACK_LINKING (all sections must be SS, lag 0)
  BRIDGES_SUB → BRIDGES_SUPER (FS, lag 28 days)
  Adjacent sections: EARTHWORK can start SS with 14-day lag.

Quantity extraction:
  Earthwork: estimate from section length × formation width × average height from long section
  Track: route length in km × 2 rails (for doubling: × 1 additional track)
  Bridges: from span arrangements in drawings

Indian norm fallback productivity rates:
  earthwork (alluvial)              → excavator_fleet:    600 m³/day
  earthwork (rock cutting)          → excavator_fleet:    180 m³/day
  blanket/sub-ballast               → general_civil_crew: 200 m/day track length
  ballast and track laying (BG)     → track_laying_crew:  500 m/day (track laying machine)
  manual track linking              → track_laying_crew:  100 m/day
  ROB construction (concrete)       → formwork_crew:      8 m³/day
  major bridge pier                 → formwork_crew:      10 m³/day (same as highway)
  OHE mast erection                 → mep_crew:           8 masts/day
  station civil works               → general_civil_crew: 25 m²/day (platform + building)

SPATIAL ANALYSIS (read railway alignment plan and longitudinal section):
  Zones: each ~10km section is a zone. Major bridges are separate zones.
    Station zones are separate ("zone_station_NAME").
  accessRoute: railway construction typically uses one parallel access road along the alignment.
    Identify from plan if access is from one end or multiple entry points (level crossings, roads).
    Hilly sections may need separate access tracks — note if shown on drawings.
  directionForced=true for track laying — track laying machine moves in one direction.
    Note direction from plan: "track laying proceeds from Station A toward Station B".
  maxConcurrentInZone=2 for most sections (earthwork + drainage can overlap).
    Bridge zones = 1 per pier. Station zones = 2 (civil + track can overlap at 60-day SS lag).
  Look for: river crossings — if bridge spans a seasonal river, note dry-season-only access
    for that zone (affects accessRoute and monsoonSensitive for that bridge).`;
}

function buildPortPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: PORT / MARINE (Container Terminal / Bulk Cargo / Fishing Harbour)

WORK BREAKDOWN GUIDANCE:
Split by: dredging → reclamation → quay wall → yard → equipment installation → utilities.
Each berth is a separate package for quay wall construction.

Expected phases:
  DREDGING        → dredger            (one package per dredge zone)
  RECLAMATION     → general_civil_crew  (if applicable, per area)
  QUAY_WALL       → formwork_crew + piling_rig  (per berth)
  YARD_PAVEMENT   → paving_train       (per yard zone, monsoonSensitive: true)
  CRANE_FOUNDATION→ formwork_crew      (per crane location)
  CRANE_ERECTION  → erection_crew      (per crane)
  UTILITIES_INFRA → mep_crew
  BUILDINGS       → general_civil_crew

Standard dependencies:
  DREDGING → QUAY_WALL (FS, lag 14 days for settlement)
  QUAY_WALL[berth] → RECLAMATION behind that berth (FS, lag 7 days)
  RECLAMATION → YARD_PAVEMENT (FS, lag 28 days for settlement)
  CRANE_FOUNDATION → CRANE_ERECTION (FS, lag 28 days)

Quantity extraction:
  Dredging: area × dredge depth (from dredge plan drawings or tender docs)
  Quay wall: total quay length from drawings (berthLengthM × numberOfBerths)
  Reclamation: reclamationAreaHa × 10000 m²

Indian norm fallback productivity rates:
  capital dredging (CSD)            → dredger:            5000 m³/day per cutter suction dredger
  rock dredging                     → dredger:            800 m³/day
  reclamation (hydraulic fill)      → general_civil_crew: 3000 m³/day (pumped from dredger)
  sheet pile quay wall              → piling_rig:         5 panels/day
  concrete quay wall (caisson)      → general_civil_crew: 1 caisson/14 days
  yard concrete pavement            → paving_train:       600 m²/day (heavy-duty)
  crane foundation (pile cap)       → formwork_crew:      20 m³/day
  STS crane erection                → erection_crew:      1 crane/21 days

SPATIAL ANALYSIS (read port layout plan and bathymetric/dredge drawings):
  Zones: each berth is a zone ("zone_berth_1", "zone_berth_2"). Yard is split by bay.
  accessRoute: marine works use "sea_access" for dredger and barge-based activities.
    Land-side works use port access road ("port_main_gate_road").
    Identify if the port has a separate construction jetty shown on the layout drawing.
  directionForced=true for quay wall construction if it proceeds berth-by-berth in sequence.
    Note which berth is built first (usually the one with best barge access or closest to breakwater).
  maxConcurrentInZone=1 per berth for quay wall piling (one piling barge per berth).
    Yard zones = 2–3 (paving and drainage can overlap in different yard bays).
  Look for: breakwater position — it restricts dredger access. Dredging inside breakwater
    can only start after breakwater reaches a certain length (add predecessor accordingly).
  Tidal constraint: note if drawings show tidal range — work at low-level quay wall
    may be tide-dependent (affects productivity, note in notes field).`;
}

function buildAirportPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: AIRPORT (Greenfield / Expansion)

WORK BREAKDOWN GUIDANCE:
Split by zone: runway → taxiways → apron → terminal → ATC tower → utilities.
For runway, split into 500m sections for earthwork + pavement.

Expected phases:
  EARTHWORK_RWY   → excavator_fleet     (per 500m runway section, monsoonSensitive: true)
  EARTHWORK_TWY   → excavator_fleet     (taxiway sections)
  PAVEMENT_RWY_BASE → general_civil_crew (granular sub-base per section)
  PAVEMENT_RWY_PQC → paving_train       (PQC/flexible per section, monsoonSensitive: true)
  TAXIWAY_PAVEMENT → paving_train
  APRON_PAVEMENT  → paving_train
  TERMINAL_STRUCTURE → formwork_crew    (per floor)
  ATC_TOWER       → formwork_crew
  PERIMETER_FENCE → general_civil_crew
  UTILITIES_AIRSIDE → mep_crew
  NAVAIDS_ILS     → mep_crew           (after pavement complete)
  TESTING_DGCA    → general_civil_crew  (final)

Standard dependencies:
  EARTHWORK_RWY[Sn] → PAVEMENT_RWY_BASE[Sn] (FS, lag 14 days)
  PAVEMENT_RWY_BASE → PAVEMENT_RWY_PQC (FS, lag 7 days)
  Adjacent runway sections SS with 7-day lag.
  TERMINAL and ATC can proceed in parallel to runway works.
  NAVAIDS starts only after runway pavement is complete.

Indian norm fallback productivity rates:
  runway earthwork                  → excavator_fleet:    700 m³/day
  granular sub-base (GSB)           → general_civil_crew: 500 m²/day
  pavement quality concrete (PQC)   → paving_train:       400 m²/day (airport rigid)
  flexible runway (DBM+BC)          → paving_train:       700 m²/day
  apron concrete pavement           → paving_train:       350 m²/day (thicker, slower)
  terminal structure (per floor)    → formwork_crew:      60 m²/day slab
  perimeter fence                   → general_civil_crew: 100 m/day
  ILS/navaids installation          → mep_crew:           1 system/30 days

SPATIAL ANALYSIS (read airport layout plan and runway drawings):
  Zones: runway split by 500m sections ("zone_rwy_S01" etc). Terminal is one zone. Apron by bay.
  accessRoute: airside construction uses "airside_haul_road". Landside uses "landside_access".
    If drawings show a temporary construction access road through the site, assign it to relevant zones.
  directionForced=true for runway paving — paving train starts from one end.
    Identify from drawings which end (usually upwind threshold or nearest batching plant).
    Note: "runway paving proceeds from Threshold 09 toward Threshold 27".
  maxConcurrentInZone=1 for runway sections (paving train occupies one section at a time).
    Terminal floors = 1 per floor (formwork strips floor-by-floor).
    Apron bays = 2 (different bays can pave simultaneously).
  Look for: taxiway crossings of the runway — these are critical path intersections.
    Paving at the intersection must coordinate both runway and taxiway sequences.`;
}

function buildWTPPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: WATER / SEWAGE TREATMENT PLANT

WORK BREAKDOWN GUIDANCE:
Create packages per treatment unit (parallel streams) and per structure type.
Civil and mechanical/electrical are separate packages.

Expected phases:
  EARTHWORK_SITE  → excavator_fleet
  INTAKE_CIVIL    → formwork_crew + piling_rig  (if river intake)
  UNIT_CIVIL[N]   → formwork_crew      (one package per treatment unit — tanks, clarifiers, filters)
  PIPEWORK        → general_civil_crew  (interconnecting pipes — SS with civil lag 60 days)
  MECHANICAL_EQUIP→ mep_crew           (pumps, blowers, clarifier mechanisms per unit)
  ELECTRICAL      → mep_crew           (panels, cabling — SS mechanical lag 30 days)
  SCADA           → mep_crew           (after electrical)
  TESTING_SPCB    → general_civil_crew  (trial run + SPCB consent)

Standard dependencies:
  EARTHWORK → UNIT_CIVIL[N] (FS, lag 7 days)
  UNIT_CIVIL[N] → MECHANICAL_EQUIP[N] (FS, lag 28 days for cure)
  Units can be built in parallel (each is a separate stream).
  All mechanical must complete before SCADA.

Quantity extraction:
  Concrete: BOQ structural concrete ÷ number of units per package
  Earthwork: plant area × average depth of below-grade structures (~3–5m)

Indian norm fallback productivity rates:
  site earthwork (plant area)       → excavator_fleet:    400 m³/day
  tank foundation (pile cap/raft)   → formwork_crew:      15 m³/day
  tank walls + roof (RC)            → formwork_crew:      8 m³/day (circular shuttering slower)
  pipework (interconnecting)        → general_civil_crew: 20 m/day (large diameter)
  mechanical equipment installation → mep_crew:           1 major unit/7 days
  electrical cabling + panels       → mep_crew:           50 m cable/day
  SCADA commissioning               → mep_crew:           1 system/21 days

SPATIAL ANALYSIS (read plant layout drawing):
  Zones: each treatment unit/tank gets its own zone. Inlet/outlet structures are separate zones.
  accessRoute: WTP/STP typically has one main access road — assign "plant_access_road" to all.
    If drawings show a separate inlet road to intake structure, assign "intake_access_road" to intake.
  directionForced=false — treatment units can be built in any order (they are independent streams).
    Exception: inlet channel and outlet structures must be built in sequence with the main units.
  maxConcurrentInZone=1 per tank (one formwork crew per tank).
    Open area between tanks = 2–3 (pipework and electrical can run simultaneously in corridors).
  Look for: pump house location — it is usually on the critical path (all pipes connect through it).
    Set pump house zone as predecessor for all inter-unit pipe packages.`;
}

function buildMMLPPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: MMLP / LOGISTICS PARK

WORK BREAKDOWN GUIDANCE:
Split by: site development → warehouses (per warehouse) → rail siding → utilities → equipment.

Expected phases:
  SITE_EARTHWORK  → excavator_fleet
  ROADS_YARD      → paving_train       (monsoonSensitive: true)
  WAREHOUSE[N]    → general_civil_crew  (one per warehouse — foundation to roof)
  RAIL_SIDING     → track_laying_crew   (if hasRailConnectivity)
  UTILITIES       → mep_crew
  EQUIPMENT_RTG   → erection_crew      (crane/RTG installation per unit)

Standard dependencies:
  SITE_EARTHWORK → ROADS_YARD (FS, lag 7 days)
  SITE_EARTHWORK → WAREHOUSE[N] (FS, lag 14 days)
  Warehouses can build in parallel.
  RAIL_SIDING starts after site earthwork (parallel to warehouses).
  EQUIPMENT_RTG → after yard roads complete.

Indian norm fallback productivity rates:
  site earthwork (levelling)        → excavator_fleet:    600 m³/day
  yard pavement (heavy-duty PQC)    → paving_train:       400 m²/day
  warehouse structure (per floor)   → general_civil_crew: 200 m²/day (pre-engineered building)
  rail siding track laying          → track_laying_crew:  200 m/day
  RTG / crane erection              → erection_crew:      1 unit/14 days
  MEP / utilities                   → mep_crew:           50 m pipe or cable/day

SPATIAL ANALYSIS (read site layout / plot plan drawing):
  Zones: each warehouse is a zone. Yard area split by section. Rail siding is its own zone.
  accessRoute: identify from layout — main gate access road for heavy vehicles ("main_gate_road").
    Rail siding: "railway_siding_access". If separate delivery gate shown, assign accordingly.
  directionForced=false for warehouses (any build order).
    directionForced=true for rail siding laying (track must proceed in one direction).
  maxConcurrentInZone=1 per warehouse (one structural crew per building).
    Yard paving = 2–3 zones can pave simultaneously if separate paving trains.
  Look for: transformer yard / electrical substation on layout — this is usually on critical path
    for equipment commissioning. Note its zone and add it as predecessor for EQUIPMENT_RTG.`;
}

function buildICDPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: ICD / DRY PORT / PRIVATE FREIGHT TERMINAL

WORK BREAKDOWN GUIDANCE:
Split by: yard → customs warehouse → rail siding → scanners → utilities.

Expected phases:
  SITE_EARTHWORK  → excavator_fleet
  YARD_PAVEMENT   → paving_train       (heavy-duty pavement, monsoonSensitive: true)
  CUSTOMS_WH      → general_civil_crew
  RAIL_SIDING     → track_laying_crew   (if hasRailSiding)
  SCANNER_CIVIL   → general_civil_crew  (scanner pit and gantry foundation)
  SCANNER_INSTALL → erection_crew
  UTILITIES       → mep_crew
  CBIC_SYSTEMS    → mep_crew           (ECTS, weighbridge — after yard complete)

Standard dependencies:
  SITE_EARTHWORK → YARD_PAVEMENT (FS, lag 14 days)
  YARD_PAVEMENT → SCANNER_CIVIL (FS, lag 28 days)
  SCANNER_CIVIL → SCANNER_INSTALL (FS, lag 14 days)
  CUSTOMS_WH runs parallel to yard works.

Indian norm fallback productivity rates:
  container yard pavement (heavy)   → paving_train:       350 m²/day
  customs warehouse structure       → general_civil_crew: 150 m²/day
  rail siding track laying          → track_laying_crew:  200 m/day
  scanner gantry civil + install    → general_civil_crew: 1 scanner/45 days total
  weighbridge installation          → general_civil_crew: 1 unit/7 days

SPATIAL ANALYSIS (read ICD layout drawing):
  Zones: container yard, customs warehouse, scanner area, rail siding are separate zones.
  accessRoute: truck entry gate ("truck_gate_road"), rail entry ("railway_entry").
    Scanner area has its own access lane — assign "scanner_lane" to scanner packages.
  directionForced=true for rail siding track laying.
  maxConcurrentInZone=1 for scanner installation zone (scanner pit + gantry foundation exclusive).
    Container yard paving = 2–3 sections simultaneously.
  Look for: weighbridge location — it sits at the truck gate and must be installed
    before yard operations. Add as predecessor for CBIC_SYSTEMS.`;
}

function buildLCTPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: LIQUID CARGO TERMINAL / CHEMICAL JETTY / LPG TERMINAL

WORK BREAKDOWN GUIDANCE:
Split by: dredging → jetty piling → jetty deck → pipelines → tanks → MLA → utilities.

Expected phases:
  DREDGING        → dredger
  JETTY_PILING    → piling_rig         (per berth)
  JETTY_DECK      → formwork_crew + crane (per berth)
  PIPELINE        → general_civil_crew  (shore pipeline — SS jetty lag 30 days)
  TANK_CIVIL[N]   → formwork_crew      (one per tank — foundation + shell)
  TANK_TESTING    → general_civil_crew  (hydro test per tank)
  MLA_INSTALL     → erection_crew      (per MLA — long-lead item, start procurement early)
  ELECTRICAL_PESO → mep_crew
  VRU_INSTALL     → mep_crew

Standard dependencies:
  DREDGING → JETTY_PILING (FS, lag 14 days)
  JETTY_PILING → JETTY_DECK (FS, lag 7 days)
  JETTY_DECK → MLA_INSTALL (FS, lag 28 days) [but MLA has 270-day procurement lead]
  TANK_CIVIL → TANK_TESTING (FS, lag 7 days)
  All tanks and jetty must complete before ELECTRICAL_PESO (PESO inspection).

Quantity extraction:
  Jetty: deck area = jettyLengthM × typical width 15m
  Tanks: storageTankCapacityKL → estimate tank diameter from capacity

SPATIAL ANALYSIS (read terminal layout, jetty plan, and tank farm drawings):
  Zones: each berth/jetty arm is a zone. Each tank is a zone. Pipeline corridor is a zone.
  accessRoute: marine works → "marine_barge_access". Shore pipeline → "shore_pipeline_corridor".
    Tank farm → "tank_farm_internal_road". Identify from layout drawing.
  directionForced=true for pipeline laying — pipeline proceeds from jetty toward tank farm.
    Note direction: "pipeline proceeds from jetty head toward shore tank farm".
  maxConcurrentInZone=1 per tank (tank shell erection is exclusive per tank).
    Pipeline corridor = 1 (only one welding crew in corridor at a time — safety regulation).
    Jetty zone = 1 per berth during piling (one piling barge per berth arm).
  Look for: vapour barrier / dyke walls on tank farm drawing — dyke construction
    must precede tank erection within that dyke (add as predecessor for each tank in dyke).
  MLA procurement note: MLA has 270-day lead time — flag MLA_INSTALL start date constraint
    in notes field as "MLA procurement must begin at project start to meet this schedule".

Indian norm fallback productivity rates:
  marine dredging                   → dredger:            3000 m³/day
  jetty piling (offshore)           → piling_rig:         12 RM/day (barge, slower)
  jetty deck concrete               → formwork_crew:      10 m³/day (marine, restricted access)
  shore pipeline laying             → general_civil_crew: 15 m/day (large diameter welded)
  tank shell erection (large)       → formwork_crew:      1 course/5 days per tank
  MLA installation                  → erection_crew:      1 MLA/21 days
  electrical (hazardous area)       → mep_crew:           30 m cable/day (Ex-rated, slower)
  VRU installation                  → mep_crew:           1 system/30 days`;
}

// ─── Prompt Map ────────────────────────────────────────────────────────────────

function buildResidentialPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: BUILDING — RESIDENTIAL (Apartment Tower / Housing Society / Villas)

WORK BREAKDOWN GUIDANCE:
Buildings are floor-by-floor sequential. Create repeating packages per floor (or floor group) per wing/block.
If multiple wings exist, treat each as an independent construction front that can run in parallel.
Keep total packages 30–80. For high-rise (>12 floors) group every 3–4 floors into one structural package per wing.
e.g. STRUC_B1_FL01_04 covers floors 1–4 of Wing B1.

Expected phases and packages:
  FOUNDATION:
    FOUND_PILE    — bored piling (piling_rig; skip if raft-on-good-soil)
    FOUND_CAP     — pile caps or raft slab (concrete_pump)
  BASEMENT (create only if drawings indicate basement levels):
    BSMT_EX       — basement excavation (excavator_fleet; monsoonSensitive: true)
    BSMT_RW       — basement retaining wall (formwork_crew)
    BSMT_SLAB     — basement slab (concrete_pump)
  PODIUM (create only if drawings indicate a podium):
    PODM_STR_P01..Pn — podium floor structural cycle per level (formwork_crew)
  STRUCTURE (per floor group per wing):
    STRUC_B1_FL01..FLn — floor structural cycle: formwork + rebar + pour + initial cure (formwork_crew)
    quantity = floor plate area in m²; unit = "m²"
  MASONRY (per floor per wing, follows structure):
    BRICK_B1_FL01..FLn — block / brick masonry (general_civil_crew)
  MEP_ROUGH (per floor per wing):
    MEP_B1_FL01..FLn — conduit, plumbing, HVAC rough-in (mep_crew)
  FINISHES (per floor per wing):
    FIN_B1_FL01..FLn — internal finishes: plaster, tiling, painting, false ceiling (general_civil_crew)
  EXTERNAL:
    EXT_FACADE    — external plaster, cladding, paint (general_civil_crew)
    SERVICES      — lifts, fire fighting, STP, electrical panels, rooftop (mep_crew)
    EXT_DEV       — external development, landscaping, boundary wall (general_civil_crew)

Standard dependencies:
  FOUND_PILE   → FOUND_CAP        (FS, lag 3 days)
  FOUND_CAP    → STRUC_B1_FL01   (FS, lag 28 days — pile cap / raft cure)
  STRUC_FLn    → STRUC_FL(n+1)   (FS, lag 7 days — minimum deshutter time)
  STRUC_FLn    → BRICK_FLn       (SS, lag 14 days — masonry starts few floors below active slab)
  BRICK_FLn    → MEP_FLn         (FS, lag 7 days)
  MEP_FLn      → FIN_FLn         (FS, lag 7 days — plaster before finishes)
  All STRUC    → EXT_FACADE       (FS, lag 0)
  All FIN      → SERVICES         (FS, lag 0)
  SERVICES     → EXT_DEV          (FS, lag 0)
  Multiple wings: wings start same FOUND but STRUC is independent per wing from FOUND_CAP.

Quantity extraction:
  Piling: RM from BOQ (or estimate: pile_count × 12–18m depth based on floors — 1 pile per 18 m² footprint)
  Pile cap / raft: m³ from BOQ (or estimate: 0.6–1.0 m³/m² footprint)
  Slab per floor: m² from drawings (floor plate area per wing per level)
  Masonry: m² from BOQ → divide by floor count (or estimate: perimeter × floor height × 0.7 openings factor)
  Finishes: same m² as floor plate

Indian norm fallback productivity rates:
  bored piling (450mm dia, M30):         piling_rig:        18 RM/day per rig
  pile cap / raft concrete (pump, M30):  concrete_pump:     30 m³/day
  slab structural cycle (M30, pump):     formwork_crew:     45 m²/day (formwork+rebar+pour+2-day cure)
  AAC block masonry (200mm, M4):         general_civil_crew: 14 m²/day
  internal plaster + finishing:          general_civil_crew: 30 m²/day
  MEP rough-in per floor (express as m²):mep_crew:          50 m²/day
  external plaster / cladding:           general_civil_crew: 35 m²/day

SPATIAL ANALYSIS (read site plan + floor plan drawings):
  Zones: each wing is a zone (zone_wingA, zone_wingB). Basement = zone_basement. External = zone_external.
  maxConcurrentInZone: structural = 1 per wing (only one active formwork level at a time).
    Masonry and MEP can coexist in same zone on different floors: maxConcurrentInZone=2 for those stages.
  accessRoute: site entry from site plan. Tower crane serves vertical access within each wing zone.
    If tower crane position shown on site plan → assign its serving zone. Else: "hoist_access".
  directionForced: true for structural — must ascend floor by floor.
    directionNote: "structure advances upward from ground floor; cannot skip floors".
    false for external development.
  monsoonSensitive: true for excavation only. All above-ground RC work is monsoon-insensitive.`;
}

function buildCommercialPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: BUILDING — COMMERCIAL (Office Tower / Mall / Hotel / Mixed Office)

WORK BREAKDOWN GUIDANCE:
Commercial buildings typically have larger floor plates (1000–3000 m²) than residential.
Higher MEP complexity — dedicated mechanical floors, AHU rooms, raised flooring in offices.
Hotels have repetitive room fit-out per floor. Malls are single/double storey with large spans.

Expected phases and packages:
  FOUNDATION:
    FOUND_PILE    — bored piling (piling_rig)
    FOUND_CAP     — pile caps or raft (concrete_pump)
  BASEMENT (if any):
    BSMT_EX       — excavation (excavator_fleet; monsoonSensitive: true)
    BSMT_STR      — basement levels structure (formwork_crew)
  STRUCTURE per floor (group every 4 floors for tall buildings):
    STRUC_FL01..FLn — floor structural cycle (formwork_crew); quantity = floor plate m²
  SERVICES CORE:
    CORE_STR      — staircase + lift core structure (formwork_crew, can run parallel to floor slabs)
  FACADE:
    FACADE_B1..B5 — unitised curtain wall or cladding by facade section (crane + erection_crew)
  MEP (per floor group):
    MEP_FL01..FLn — mechanical, electrical, plumbing rough-in (mep_crew)
  FIT-OUT (per floor group):
    FITOUT_FL01..FLn — raised floor, false ceiling, partitions, finishing (general_civil_crew)
  EXTERNAL:
    EXT_DEV       — external works, roads within site, landscaping (general_civil_crew)
    COMMISS       — MEP commissioning, lifts, building management system (mep_crew)

Standard dependencies:
  FOUND_PILE → FOUND_CAP     (FS, lag 3 days)
  FOUND_CAP  → STRUC_FL01   (FS, lag 28 days)
  STRUC_FLn  → STRUC_FL(n+1)(FS, lag 7 days)
  STRUC_FLn  → MEP_FLn      (SS, lag 21 days — MEP follows structure by 3 floors)
  MEP_FLn    → FITOUT_FLn   (FS, lag 7 days)
  All STRUC  → FACADE        (FS, lag 0) [facade can start floor 5+ with SS lag in practice]
  All FITOUT → COMMISS       (FS, lag 0)
  COMMISS    → EXT_DEV       (SS, lag 0)

Quantity extraction:
  Piling: RM from BOQ or estimate (column grid: 1 pile per 20 m² footprint, depth 18–24m)
  Slab: floor plate area × floor count (from drawings or BOQ)
  Facade: perimeter × height from drawings (or BOQ facade area)
  Fit-out: m² = floor plate area per floor group

Indian norm fallback productivity rates:
  bored piling (600mm dia, M30):          piling_rig:        15 RM/day (larger dia, slower)
  raft / pile cap (pump, M35):            concrete_pump:     35 m³/day
  slab structural cycle (M35, large plate):formwork_crew:    55 m²/day (larger plates use jump form)
  unitised curtain wall installation:     erection_crew:     60 m²/day
  office MEP (complex, per m²):           mep_crew:          40 m²/day
  office fit-out (raised floor + FC):     general_civil_crew: 30 m²/day

SPATIAL ANALYSIS (read site plan + floor plan + facade elevation drawings):
  Zones: each building block / tower is a zone. Podium (if any) is a separate zone.
  maxConcurrentInZone: structure = 1 (one active slab at a time). Facade = 1 per elevation face.
  accessRoute: construction hoists per tower, plus ground-level material access from site entry.
    Unitised facade panels: crane access from ground — note which face has craneage clearance.
  directionForced: true for structure (upward). True for facade (bottom-up erection sequence).
    directionNote for facade: "curtain wall installed bottom to top, one floor per erection cycle".
  monsoonSensitive: excavation only. RC frame and facade work are monsoon-insensitive.`;
}

function buildIndustrialBuildingPrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: BUILDING — INDUSTRIAL (Factory / Warehouse / Manufacturing Plant)

WORK BREAKDOWN GUIDANCE:
Industrial buildings are bay-based, not floor-based. Work proceeds bay by bay across the footprint.
Pre-engineered buildings (PEB) are common — steel columns + roof trusses + cladding system.
Civil construction: isolated footings → anchor bolts → steel erection → roofing → walling → floor.

Expected phases and packages (per bay or bay group):
  EARTHWORK:
    EARTH_GRADE   — site grading and filling to plinth level (excavator_fleet; monsoonSensitive: true)
    EARTH_COMPACT — layer compaction (general_civil_crew)
  FOUNDATION (per bay group of 3–5 bays):
    FOUND_FTG_S01..S0n — isolated footings + pedestal (formwork_crew); quantity = m³ concrete
  ANCHOR (per section):
    ANCHOR_S01..S0n — anchor bolt setting and second pour (general_civil_crew)
  STRUCTURE (per bay):
    STEEL_BAY_B01..B0n — column erection + truss setting + purlin (crane + erection_crew); unit = no. (bays)
  ROOFING (per bay group, follows steel):
    ROOF_BAY_B01..B0n — roof cladding panels + ridge + gutters (erection_crew); unit = m²
  WALLING (per bay group):
    WALL_BAY_B01..B0n — wall cladding / brick infill (general_civil_crew); unit = m²
  FLOORING (per zone):
    FLOOR_Z01..Z0n — industrial hard floor: PCC + screed + hardener (concrete_pump); unit = m²
  MEP / UTILITIES:
    ELEC_DIST     — electrical distribution: panels, cable trays, lighting (mep_crew)
    PLBG_FIRE     — plumbing, fire fighting, HVAC if any (mep_crew)
  OVERHEAD CRANE (if applicable):
    EOT_RAIL      — crane rail and gantry beam installation (crane + erection_crew)
    EOT_CRANE     — overhead crane installation and commissioning (erection_crew)
  EXTERNAL:
    EXT_RD        — internal roads, drains, external yard (general_civil_crew)
    EXT_COMPOUND  — compound wall, gate, guard room (general_civil_crew)

Standard dependencies:
  EARTH_GRADE   → EARTH_COMPACT → FOUND_FTG_S0n (FS, lag 3 days)
  FOUND_FTG_S0n → ANCHOR_S0n   (FS, lag 7 days — footing cure)
  ANCHOR_S0n    → STEEL_BAY_B0n (FS, lag 3 days — anchor bolt cure)
  STEEL_BAY_B0n → ROOF_BAY_B0n (FS, lag 0 — roof follows steel erection by bay)
  STEEL_BAY_B0n → WALL_BAY_B0n (SS, lag 7 days)
  ROOF_BAY_B0n  → FLOOR_Z0n    (SS, lag 0 — flooring can start once roof covers the zone)
  All FLOOR     → ELEC_DIST    (FS, lag 0)
  ELEC_DIST     → EOT_RAIL     (SS, lag 0, if applicable)
  All bays complete → EXT_RD   (FS, lag 0)
  Adjacent bay groups can start with SS lag of 7 days (rolling construction).

Quantity extraction:
  Foundation: m³ concrete from BOQ or estimate: 1.5 m³/column × column count
  Steel: tonnes from BOQ or estimate: 45–70 kg/m² covered area for PEB
  Roofing: m² = covered area from drawings
  Flooring: m² = total ground floor area from drawings
  Bay count: from grid layout (columns on X-axis × Y-axis in plan drawing)

Indian norm fallback productivity rates:
  site grading + filling:             excavator_fleet:    500 m³/day
  isolated footing concrete (M25):    formwork_crew:      12 m³/day per crew
  PEB steel column + truss erection:  erection_crew:      2 bays/day per crew (unit = "no.")
  roof cladding panels:               erection_crew:      200 m²/day
  wall cladding / brick infill (m²):  general_civil_crew: 60 m²/day
  industrial floor (PCC + screed):    concrete_pump:      250 m²/day
  electrical distribution:            mep_crew:           80 m²/day
  EOT crane rail + beam:              erection_crew:      20 RM/day

SPATIAL ANALYSIS (read site plan + structural layout + equipment layout drawings):
  Zones: divide building into longitudinal bays zones from the structural grid.
    e.g. zone_A (bays 1–5), zone_B (bays 6–10). Each zone progresses independently.
    If equipment layout drawing shows process equipment: separate zone per process area.
  maxConcurrentInZone: steel erection = 1 per zone (crane operates in one zone at a time).
    Flooring and MEP can overlap in same zone: maxConcurrentInZone=2 for those stages.
  accessRoute: mobile crane access path from site plan. Note if crane must travel between zones.
    If equipment layout shows heavy process equipment: note crawler crane access path separately.
  directionForced: true for steel erection (crane travels in one direction bay by bay).
    directionNote: "steel erection proceeds from bay 1 toward bay N following crane travel path".
    Roof cladding follows same direction. False for flooring and MEP.
  monsoonSensitive: earthwork = true. Steel erection = false (work continues in rain with care).`;
}

function buildMixedUsePrompt(): string {
  return `${BASE_INSTRUCTION}

PROJECT TYPE: BUILDING — MIXED USE (Podium + Tower / Integrated Township Block)

WORK BREAKDOWN GUIDANCE:
Mixed-use developments typically have: retail / commercial podium (2–5 floors) + residential or office
towers above. Treat podium and each tower as separate construction zones that share foundation work.
Podium structure must complete before tower structure can proceed above the podium level.

Expected phases and packages:
  FOUNDATION:
    FOUND_PILE    — bored piling for full footprint (piling_rig)
    FOUND_CAP     — pile caps / raft (concrete_pump); one package for podium zone, one per tower zone
  PODIUM STRUCTURE:
    PODM_FL_B1..B3 — podium floor structural cycle per level (formwork_crew); quantity = m² podium plate
  TOWER STRUCTURE (per tower, per floor group of 3–4 floors):
    TWR_A_FL01..FLn — tower A structural cycle (formwork_crew)
    TWR_B_FL01..FLn — tower B structural cycle (formwork_crew) [if 2nd tower]
  PODIUM MEP + FIT-OUT:
    PODM_MEP      — podium MEP rough-in: retail, food court, parking (mep_crew)
    PODM_FITOUT   — podium finishes: floors, ceiling, storefronts (general_civil_crew)
  TOWER MEP + FINISHES (per floor group per tower):
    MEP_A_FL01..FLn — tower A MEP rough-in (mep_crew)
    FIN_A_FL01..FLn — tower A finishes (general_civil_crew)
  FACADE:
    FACADE_PODM   — podium facade: glass / ACP / stone (erection_crew); quantity = m²
    FACADE_TWR_A  — tower A curtain wall / cladding (erection_crew)
  SERVICES + COMMISSIONING:
    SERVICES      — lifts, fire fighting, BMS, STP, rooftop (mep_crew)
    EXT_DEV       — external development, landscape, roads within site (general_civil_crew)

Standard dependencies:
  FOUND_PILE   → FOUND_CAP        (FS, lag 3 days)
  FOUND_CAP    → PODM_FL_B1       (FS, lag 28 days)
  PODM_FL_Bn   → PODM_FL_B(n+1)  (FS, lag 7 days)
  Last PODM_FL → TWR_A_FL01      (FS, lag 7 days — tower starts from top of podium)
  TWR_A_FLn    → TWR_A_FL(n+1)   (FS, lag 7 days)
  PODM_FL_B3   → PODM_MEP        (FS, lag 0) [MEP can start once podium structure done]
  PODM_MEP     → PODM_FITOUT     (FS, lag 7 days)
  TWR_A_FLn    → MEP_A_FLn       (SS, lag 21 days)
  MEP_A_FLn    → FIN_A_FLn       (FS, lag 7 days)
  All structure → FACADE          (SS, lag floor 5 — facade erection can start while structure rises)
  All finishes  → SERVICES        (FS, lag 0)
  SERVICES      → EXT_DEV         (SS, lag 0)
  If 2 towers: TWR_B_FL01 starts in parallel with TWR_A_FL01 from same FOUND_CAP.

Quantity extraction:
  Piling: total RM from BOQ or estimate (podium + tower footprints combined)
  Pile cap: m³ from BOQ (or estimate: 0.7 m³/m² total footprint)
  Podium slab: floor plate area × podium levels (from drawings)
  Tower slab: tower footprint area × tower floor count per tower
  Facade: perimeter area from drawings (podium perimeter × podium height + tower perimeter × tower height)

Indian norm fallback productivity rates:
  bored piling (600mm dia, deep foundations): piling_rig:  14 RM/day per rig (deep, 24–30m)
  pile cap concrete (M35, pump):               concrete_pump: 30 m³/day
  podium slab structural cycle (M35, large plate): formwork_crew: 55 m²/day
  tower slab structural cycle (M35):           formwork_crew: 45 m²/day
  retail fit-out (podium finishes):            general_civil_crew: 25 m²/day
  residential finishes (tower):               general_civil_crew: 30 m²/day
  tower curtain wall / cladding:              erection_crew:  50 m²/day
  podium MEP (complex retail+parking):        mep_crew:       35 m²/day

SPATIAL ANALYSIS (read site plan + podium plan + tower floor plans):
  Zones: zone_podium, zone_tower_A, zone_tower_B (if exists), zone_basement (if any), zone_external.
  maxConcurrentInZone: podium structure = 1 per podium zone. Each tower = 1 (independent).
    Tower A and Tower B are independent zones and can run fully in parallel.
  accessRoute: separate tower crane for each tower. Podium may use mobile crane at ground level.
    If site plan shows crane positions: assign each crane to its serving zone.
    "tower_crane_A" serves zone_tower_A; "tower_crane_B" serves zone_tower_B.
  directionForced: true for all structural packages (upward sequence, podium before towers).
    directionNote: "towers must start from podium top slab level; cannot begin tower structure before last podium floor".
  monsoonSensitive: basement excavation only. All above-podium work = false.`;
}

const PROMPT_BUILDERS: Record<ProjectType, () => string> = {
  highway:               buildHighwayPrompt,
  bridge:                buildBridgePrompt,
  metro:                 buildMetroPrompt,
  tunnel:                buildTunnelPrompt,
  railway:               buildRailwayPrompt,
  port:                  buildPortPrompt,
  airport:               buildAirportPrompt,
  water_treatment:       buildWTPPrompt,
  mmlp:                  buildMMLPPrompt,
  icd:                   buildICDPrompt,
  liquid_cargo_terminal: buildLCTPrompt,
  residential:           buildResidentialPrompt,
  commercial:            buildCommercialPrompt,
  industrial:            buildIndustrialBuildingPrompt,
  mixed:                 buildMixedUsePrompt,
};

// ─── Main Extraction Function ──────────────────────────────────────────────────

export async function extractWorkPackages(
  infraType: ProjectType,
  documents: ParsedDocument[],
  productivityOverrides: ProductivityOverrides = {},
): Promise<ExtractedScheduleInput> {
  const buildPrompt = PROMPT_BUILDERS[infraType];
  const promptText = buildPrompt();
  const content = toClaudeContent(documents, promptText);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 8192,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content[0]?.type === "text" ? data.content[0].text : "";

  // Strip markdown code fences if Claude adds them despite instruction
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  const result = JSON.parse(cleaned) as ExtractedScheduleInput;

  // Apply user-provided overrides — highest priority
  // Track conflicts where user input differs from document-extracted rates
  if (Object.keys(productivityOverrides).length > 0) {
    const conflictMap = new Map<string, { documentRate: number; userRate: number; ids: string[] }>();

    for (const wp of result.workPackages) {
      const userRate = productivityOverrides[wp.resourceType];
      if (userRate === undefined) continue;

      // Conflict = user gave a rate AND Claude found one from a document (not a norm)
      if (wp.productivityBasis === "document" && wp.productivityRate !== userRate) {
        const existing = conflictMap.get(wp.resourceType);
        if (existing) {
          existing.ids.push(wp.id);
        } else {
          conflictMap.set(wp.resourceType, {
            documentRate: wp.productivityRate,
            userRate,
            ids: [wp.id],
          });
        }
      }

      wp.productivityRate = userRate;
      wp.productivityBasis = "user_input";
    }

    // Write conflicts into the summary so the frontend can surface them
    result.extractionSummary.productivityConflicts = Array.from(conflictMap.entries()).map(
      ([resourceType, { documentRate, userRate, ids }]) => {
        const pct = Math.round(Math.abs(userRate - documentRate) / documentRate * 100);
        const direction = userRate > documentRate ? "higher" : "lower";
        return {
          resourceType,
          documentRate,
          userRate,
          affectedPackageIds: ids,
          note: `User rate (${userRate}) is ${pct}% ${direction} than document rate (${documentRate}). User rate applied.`,
        };
      }
    );
  } else {
    result.extractionSummary.productivityConflicts = [];
  }

  return result;
}
