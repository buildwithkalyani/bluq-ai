// Work Package Types — foundation for RCPSP-based schedule optimization
// A work package is the atomic schedulable unit: quantity + resource + dependencies

export type InfrastructureType =
  | "port"
  | "airport"
  | "highway"
  | "bridge"
  | "metro"
  | "water_treatment"
  | "mmlp"
  | "icd"
  | "liquid_cargo_terminal"
  | "tunnel"
  | "railway";

// Coarse categories matching frontend constructionType — used for work-package-extractor routing.
// Distinct from task-library.ts BuildingType which is fine-grained (residential_highrise, etc.)
export type BuildingCategory =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed";

export type ProjectType = InfrastructureType | BuildingCategory;

export type ResourceType =
  | "piling_rig"
  | "formwork_crew"
  | "launching_gantry"
  | "paving_train"
  | "excavator_fleet"
  | "concrete_pump"
  | "crane"
  | "tbm"
  | "natm_heading_crew"
  | "dredger"
  | "general_civil_crew"
  | "mep_crew"
  | "track_laying_crew"
  | "erection_crew";

export type QuantityBasis = "boq" | "drawing_measured" | "estimated";

export type ProductivityBasis = "user_input" | "document" | "indian_norm";

// Keyed by resourceType string — user provides rates per equipment/crew type
// e.g. { "paving_train": 1200, "excavator_fleet": 620 }
export type ProductivityOverrides = Partial<Record<string, number>>;

export type DependencyType = "FS" | "SS"; // finish-to-start or start-to-start

export interface Predecessor {
  id: string;
  type: DependencyType;
  lagDays: number;  // 0 = immediately; 28 = 28-day cure before successor starts
}

export interface SpatialConstraints {
  maxConcurrentInZone: number;   // max activities allowed simultaneously in this zone (1 = exclusive)
  accessRoute: string;           // haul road / access path that serves this package
  directionForced: boolean;      // true if must follow a directional sequence
  directionNote: string;         // e.g. "paving proceeds from Ch 0+000 toward Ch 18+000"
}

export interface WorkPackage {
  id: string;                    // e.g., "PIER_P01", "EARTH_S03", "SPAN_S05"
  name: string;                  // e.g., "Pier P1 Construction"
  phase: string;                 // e.g., "substructure", "earthwork", "pavement"
  quantity: number;
  unit: string;                  // "m³", "m²", "m", "no.", "RM"
  resourceType: ResourceType;
  resourceUnitsRequired: number; // simultaneous units of resourceType needed
  productivityRate: number;      // quantity units per day per resource unit
  productivityBasis: ProductivityBasis;
  predecessors: Predecessor[];
  monsoonSensitive: boolean;     // restrict to non-monsoon months if true
  zoneId: string;                // spatial zone — packages in same zone share location
  spatialConstraints: SpatialConstraints;
  quantityBasis: QuantityBasis;
  notes?: string;
}

export type ResourceBasis = "document" | "assumed";

export interface ResourceTypeInfo {
  type: ResourceType;
  defaultCount: number;          // from document or assumed; user overrides in UI
  description: string;           // e.g., "Liebherr LB28 hydraulic rotary, 28m kelly bar"
  resourceBasis: ResourceBasis;  // "document" = read from method statement; "assumed" = standard deployment
}

export interface ProductivityConflict {
  resourceType: string;
  documentRate: number;          // what Claude found in the uploaded document
  userRate: number;              // what the user manually entered
  affectedPackageIds: string[];  // which work packages are affected
  note: string;                  // e.g. "User rate (1200) is 26% higher than document rate (950)"
}

export interface ExtractionSummary {
  totalPackages: number;
  boqDerived: number;
  drawingMeasured: number;
  estimated: number;
  missingData: string[];
  productivityConflicts: ProductivityConflict[];
}

export interface ExtractedScheduleInput {
  infraType: string;
  workPackages: WorkPackage[];
  availableResourceTypes: ResourceTypeInfo[];
  monsoonMonths: number[];       // months (1-12) when sensitive work is restricted
  extractionSummary: ExtractionSummary;
}
