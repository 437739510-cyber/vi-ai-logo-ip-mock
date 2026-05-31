/**
 * Brand Brain — Memory System Types
 *
 * Defines the data structures for long-term memory storage.
 * V1: Client Memory, Industry Memory, Project Memory
 */

// ========== Client Memory ==========

export interface ClientMemory {
  /** Unique client identifier (generated from company name hash) */
  clientId: string;
  /** Brand name */
  companyName: string;
  /** Industry label */
  industry: string;
  /** Standardized industry category */
  industryCategory: string;
  /** Sub-category (e.g. "beverage", "coconut_water") */
  subCategory?: string;
  /** Brand description */
  brandDescription?: string;
  /** Whether the client has uploaded a logo */
  hasLogo: boolean;
  /** Whether the client has uploaded a mascot/IP */
  hasMascot: boolean;
  /** Brand stage */
  brandStage: string;
  /** Budget range */
  budgetRange?: string;
  /** Target audience summary */
  targetAudience?: string;

  /** Associated project IDs */
  projectIds: string[];

  /** Latest brain analysis result reference */
  latestBrainResultId?: string;
  /** Latest business profile selection */
  latestBusinessProfile?: any;

  /** Metadata */
  createdAt: string;
  updatedAt: string;
  projectCount: number;
}

// ========== Industry Memory ==========

export interface IndustryMemory {
  /** Industry key: "food_beverage" or "food_beverage/beverage/coconut_water" */
  industryKey: string;
  /** Primary category */
  category: string;
  /** Sub-category (二级) */
  subCategory?: string;
  /** Sub-sub-category (三级细分) */
  subSubCategory?: string;

  /** Visual characteristics */
  designStyle: string[];
  colorTendency: string[];
  typographyStyle: string[];

  /** Common modules for this industry */
  commonModules: string[];
  /** Typical page range */
  typicalPageRange: [number, number];

  /** Typical application scenarios */
  typicalScenes: string[];
  /** Sample/reference brands */
  sampleBrands: string[];
  /** Visual keywords for AI prompt generation */
  visualKeywords: string[];

  /** Source of this knowledge */
  source: "initial_knowledge" | "project_accumulated" | "manual_review";
  /** Reference manual ID if extracted from PDF */
  referenceManualId?: string;

  /** Confidence level (0-1) */
  confidence: number;

  /** Metadata */
  createdAt: string;
  updatedAt: string;
  projectCount: number;
}

// ========== Project Memory ==========

export interface BrainResultSnapshot {
  /** Timestamp of the analysis */
  timestamp: string;
  /** Brand analyst output */
  brandProfile: any;
  /** Package recommendation */
  packageRecommendation: any;
  /** Module plan */
  modulePlan: any;
  /** Design direction */
  designDirection: any;
  /** Asset guardian output */
  assetGuardResult: any;
  /** Generated page URLs */
  generatedUrls: { pageId: string; label: string; url: string }[];
  /** Business profile (from Step 1.5) */
  businessProfile?: any;
}

export interface ProjectMemory {
  /** Project ID (matches existing project system) */
  projectId: string;
  /** Associated client ID */
  clientId?: string;
  /** Client/company name */
  companyName: string;

  /** All brain analysis results over the project lifecycle */
  brainResults: BrainResultSnapshot[];

  /** Final decisions made by the client */
  selectedPackage?: string;
  selectedModules?: string[];
  totalGeneratedPages?: number;


  clientFeedback?: string;

  /** Status tracking */
  /** Quality assessment result */
  qualityScore?: {
    total: number;
    dimensions: Record<string, number>;
    issues: { severity: string; category: string; message: string; affectedPages?: string[] }[];
    flags: string[];
    checkedAt: string;
  };

  status: "analyzed" | "planned" | "generated" | "delivered";

  /** Metadata */
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ========== Memory Index ==========

export interface MemoryIndex {
  version: number;
  lastUpdated: string;
  totalClients: number;
  totalProjects: number;
  industryCoverage: Record<string, { subCategories: string[]; projectCount: number }>;
}

// ========== Storage Adapter Interface ==========

export interface MemoryAdapter {
  /** Initialize storage (create dirs/index if needed) */
  initialize(): Promise<void>;

  // === Client Memory ===
  getClient(clientId: string): Promise<ClientMemory | null>;
  getAllClients(): Promise<ClientMemory[]>;
  saveClient(client: ClientMemory): Promise<void>;
  findClientByCompany(companyName: string): Promise<ClientMemory | null>;

  // === Industry Memory ===
  getIndustry(industryKey: string): Promise<IndustryMemory | null>;
  getAllIndustries(): Promise<IndustryMemory[]>;
  saveIndustry(industry: IndustryMemory): Promise<void>;
  findIndustryByCategory(category: string, subCategory?: string): Promise<IndustryMemory | null>;

  // === Project Memory ===
  getProject(projectId: string): Promise<ProjectMemory | null>;
  getAllProjects(): Promise<ProjectMemory[]>;
  saveProject(project: ProjectMemory): Promise<void>;

  // === Index ===
  getIndex(): Promise<MemoryIndex>;
  updateIndex(): Promise<void>;
}
  latestBusinessProfile?: any;
  /** Latest mascot profile */
  latestMascotProfile?: any;
  /** Mascot profile from Mascot Designer */
  mascotProfile?: any;
