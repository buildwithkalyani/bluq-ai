const PHASE_KEYWORDS: [string, string[]][] = [
  ["Site Preparation", [
    "site survey", "demarcation", "layout", "site clearing", "clearing", "grubbing",
    "excavation", "earthwork", "earth work", "dewatering", "temporary fencing",
    "temporary office", "site office", "mobilisation", "mobilization", "hoarding",
  ]],
  ["Foundation", [
    "pile", "piling", "bored pile", "driven pile", "footing", "foundation",
    "raft", "raft slab", "plinth", "grade beam", "pile cap", "underpinning",
    "anti-termite", "anti termite", "damp proof",
  ]],
  ["Structure", [
    "column", "beam", "slab", "rcc", "rc ", "reinforced concrete", "reinforcement",
    "rebar", "formwork", "shuttering", "shutter", "centering", "concrete", "casting",
    "concreting", "pour", "structural wall", "core wall", "shear wall", "lift core",
    "staircase", "stair", "lintel", "sunshade", "parapet",
  ]],
  ["MEP", [
    "plumbing", "sanitary", "drainage", "sewage", "water supply", "fire fighting",
    "fire sprinkler", "electrical", "wiring", "conduit", "cable", "switchboard",
    "panel", "mep", "hvac", "air conditioning", "duct", "ductwork", "ventilation",
    "elevator", "lift installation", "escalator", "bms", "building management",
  ]],
  ["Finishing", [
    "plaster", "plastering", "render", "paint", "painting", "putty",
    "tile", "tiling", "flooring", "marble", "granite", "vitrified",
    "false ceiling", "gypsum", "drywall", "partition", "interior",
    "waterproof", "waterproofing", "cladding", "facade", "glazing",
    "aluminium", "aluminum", "window", "door", "carpentry", "woodwork",
    "cabinet", "kitchen", "bathroom fitting", "sanitary fitting", "fixture",
    "railing", "handrail", "landscaping", "external", "finishing",
  ]],
  ["Handover", [
    "handover", "commissioning", "testing", "snag", "snagging",
    "defect", "punch list", "inspection", "noc", "certificate",
    "completion", "final inspection", "trial run",
  ]],
];

export function detectPhase(taskName: string): string | null {
  const lower = taskName.toLowerCase();
  for (const [phase, keywords] of PHASE_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return phase;
  }
  return null;
}
