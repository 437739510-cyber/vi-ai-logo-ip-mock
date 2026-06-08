/**
 * Brand Brain 鈥?Supabase Memory Adapter
 *
 * Implements MemoryAdapter against Supabase PostgreSQL tables.
 *
 * Tables (from docs/MEMORY_SUPABASE_SCHEMA.sql):
 *   memory_clients, memory_industries, memory_projects, memory_index
 *
 * This is the production adapter. JSON adapter remains for development.
 * Adapter selection is controlled by NEXT_PUBLIC_MEMORY_ADAPTER env var.
 */

import { supabaseAdmin } from "@/lib/supabase";
import type {
  MemoryAdapter,
  ClientMemory,
  IndustryMemory,
  ProjectMemory,
  BrainResultSnapshot,
  MemoryIndex,
} from "./types";
import { generateClientId } from "./client-id";

const MAX_SNAPSHOTS = 10;

// ==================== Row 鈫?Type Mappers ====================

function rowToClientMemory(row: any): ClientMemory {
  return {
    clientId: row.client_id,
    companyName: row.company_name,
    industry: row.industry,
    industryCategory: row.industry_category,
    subCategory: row.sub_category || undefined,
    brandDescription: row.brand_description || undefined,
    hasLogo: row.has_logo,
    hasMascot: row.has_mascot,
    brandStage: row.brand_stage,
    budgetRange: row.budget_range || undefined,
    targetAudience: row.target_audience || undefined,
    projectIds: row.project_ids || [],
    latestBrainResultId: row.metadata?.latestBrainResultId || undefined,
    latestBusinessProfile: row.metadata?.latestBusinessProfile || undefined,
    latestMascotProfile: row.metadata?.latestMascotProfile || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectCount: row.project_count,
  };
}

function clientMemoryToRow(client: ClientMemory): Record<string, unknown> {
  return {
    client_id: client.clientId,
    company_name: client.companyName,
    industry: client.industry,
    industry_category: client.industryCategory,
    sub_category: client.subCategory || null,
    brand_description: client.brandDescription || null,
    has_logo: client.hasLogo,
    has_mascot: client.hasMascot,
    brand_stage: client.brandStage,
    budget_range: client.budgetRange || null,
    target_audience: client.targetAudience || null,
    project_ids: client.projectIds || [],
    project_count: client.projectCount,
    metadata: {
      latestBrainResultId: client.latestBrainResultId || null,
      latestBusinessProfile: client.latestBusinessProfile || null,
      latestMascotProfile: client.latestMascotProfile || null,
    },
    schema_version: 2,
  };
}

function rowToIndustryMemory(row: any): IndustryMemory {
  return {
    industryKey: row.industry_key,
    category: row.category,
    subCategory: row.sub_category || undefined,
    subSubCategory: undefined,
    designStyle: row.design_style || [],
    colorTendency: row.color_tendency || [],
    typographyStyle: row.typography_style || [],
    commonModules: row.typical_modules || [],
    typicalPageRange: (row.typical_page_range || [8, 12]) as [number, number],
    typicalScenes: row.typical_scenes || [],
    sampleBrands: row.sample_brands || [],
    visualKeywords: row.visual_keywords || [],
    source: row.source || "initial_knowledge",
    referenceManualId: row.reference_manual_id || undefined,
    confidence: row.confidence ?? 0.8,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectCount: row.project_count,
  };
}

function industryMemoryToRow(industry: IndustryMemory): Record<string, unknown> {
  return {
    industry_key: industry.industryKey,
    category: industry.category,
    sub_category: industry.subCategory || null,
    design_style: industry.designStyle || [],
    color_tendency: industry.colorTendency || [],
    typography_style: industry.typographyStyle || [],
    typical_modules: industry.commonModules || [],
    typical_page_range: industry.typicalPageRange || [8, 12],
    typical_scenes: industry.typicalScenes || [],
    sample_brands: industry.sampleBrands || [],
    visual_keywords: industry.visualKeywords || [],
    source: industry.source || "initial_knowledge",
    reference_manual_id: industry.referenceManualId || null,
    confidence: industry.confidence ?? 0.8,
    schema_version: 2,
    project_count: industry.projectCount || 0,
  };
}

function rowToProjectMemory(row: any): ProjectMemory {
  return {
    projectId: row.project_id,
    clientId: row.client_id || undefined,
    companyName: row.company_name,
    status: row.status,
    brainResults: row.brain_results || [],
    selectedPackage: row.selected_package || undefined,
    selectedModules: row.selected_modules || undefined,
    totalGeneratedPages: row.total_generated_pages || undefined,
    clientFeedback: row.client_feedback || undefined,
    qualityScore: row.quality_score || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: undefined,
  };
}

function projectMemoryToRow(project: ProjectMemory): Record<string, unknown> {
  return {
    project_id: project.projectId,
    client_id: project.clientId || null,
    company_name: project.companyName,
    status: project.status || "analyzed",
    brain_results: enforceMaxSnapshots(project.brainResults || []),
    selected_package: project.selectedPackage || null,
    selected_modules: project.selectedModules || null,
    total_generated_pages: project.totalGeneratedPages || null,
    client_feedback: project.clientFeedback || null,
    quality_score: project.qualityScore || null,
    schema_version: 2,
  };
}

// ==================== Snapshot Helpers ====================

/**
 * Enforce max 10 snapshots per project. Keep the most recent 10.
 */
export function enforceMaxSnapshots(snapshots: BrainResultSnapshot[]): BrainResultSnapshot[] {
  if (snapshots.length <= MAX_SNAPSHOTS) return snapshots;
  // Keep the most recent MAX_SNAPSHOTS items (assumes newest at end)
  return snapshots.slice(snapshots.length - MAX_SNAPSHOTS);
}

// ==================== Index Helpers ====================

/**
 * Build industry coverage from a list of industries.
 * Properly accumulates subCategories per category (fixes JSON adapter bug).
 */
export function buildIndustryCoverage(industries: IndustryMemory[]): Record<string, { subCategories: string[]; projectCount: number }> {
  const coverage: Record<string, { subCategories: Set<string>; projectCount: number }> = {};

  for (const ind of industries) {
    if (!coverage[ind.category]) {
      coverage[ind.category] = { subCategories: new Set(), projectCount: 0 };
    }
    if (ind.subCategory) {
      coverage[ind.category].subCategories.add(ind.subCategory);
    }
    coverage[ind.category].projectCount += ind.projectCount;
  }

  // Convert Sets to sorted arrays
  const result: Record<string, { subCategories: string[]; projectCount: number }> = {};
  for (const [cat, data] of Object.entries(coverage)) {
    result[cat] = {
      subCategories: [...data.subCategories].sort(),
      projectCount: data.projectCount,
    };
  }
  return result;
}

// ==================== SupabaseMemoryAdapter ====================

export class SupabaseMemoryAdapter implements MemoryAdapter {
  async initialize(): Promise<void> {
    // Tables should already exist (created via MEMORY_SUPABASE_SCHEMA.sql).
    // This method verifies connectivity and ensures the index row exists.
    const { error: pingError } = await supabaseAdmin
      .from("memory_index")
      .select("id", { count: "exact", head: true });

    if (pingError) {
      throw new Error(
        `SupabaseMemoryAdapter: Cannot access memory tables. ` +
        `Ensure MEMORY_SUPABASE_SCHEMA.sql has been executed. ` +
        `Error: ${pingError.message}`
      );
    }

    // Ensure the single index row exists
    const { data: existingIndex } = await supabaseAdmin
      .from("memory_index")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (!existingIndex) {
      await supabaseAdmin.from("memory_index").insert({
        id: 1,
        version: 2,
        total_clients: 0,
        total_projects: 0,
        industry_coverage: {},
      });
    }
  }

  // ==================== Client Memory ====================

  async getClient(clientId: string): Promise<ClientMemory | null> {
    const { data, error } = await supabaseAdmin
      .from("memory_clients")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToClientMemory(data) : null;
  }

  async getAllClients(): Promise<ClientMemory[]> {
    const { data, error } = await supabaseAdmin
      .from("memory_clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToClientMemory);
  }

  async saveClient(client: ClientMemory): Promise<void> {
    const row = clientMemoryToRow(client);
    const { error } = await supabaseAdmin
      .from("memory_clients")
      .upsert(row, { onConflict: "client_id" });

    if (error) throw error;
    await this.updateIndex();
  }

  async findClientByCompany(companyName: string): Promise<ClientMemory | null> {
    // Step 1: Try hash-based ID lookup (new clients created with v2 IDs)
    const hashId = generateClientId(companyName);
    const { data: hashResult } = await supabaseAdmin
      .from("memory_clients")
      .select("*")
      .eq("client_id", hashId)
      .maybeSingle();

    if (hashResult) return rowToClientMemory(hashResult);

    // Step 2: Fallback to company_name exact match (legacy clients with v1 IDs)
    const { data: nameResult } = await supabaseAdmin
      .from("memory_clients")
      .select("*")
      .eq("company_name", companyName)
      .maybeSingle();

    return nameResult ? rowToClientMemory(nameResult) : null;
  }

  // ==================== Industry Memory ====================

  async getIndustry(industryKey: string): Promise<IndustryMemory | null> {
    const { data, error } = await supabaseAdmin
      .from("memory_industries")
      .select("*")
      .eq("industry_key", industryKey)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToIndustryMemory(data) : null;
  }

  async getAllIndustries(): Promise<IndustryMemory[]> {
    const { data, error } = await supabaseAdmin
      .from("memory_industries")
      .select("*")
      .order("industry_key");

    if (error) throw error;
    return (data || []).map(rowToIndustryMemory);
  }

  async saveIndustry(industry: IndustryMemory): Promise<void> {
    const row = industryMemoryToRow(industry);
    const { error } = await supabaseAdmin
      .from("memory_industries")
      .upsert(row, { onConflict: "industry_key" });

    if (error) throw error;
    await this.updateIndex();
  }

  async findIndustryByCategory(category: string, subCategory?: string): Promise<IndustryMemory | null> {
    let query = supabaseAdmin
      .from("memory_industries")
      .select("*")
      .eq("category", category);

    if (subCategory) {
      query = query.eq("sub_category", subCategory);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? rowToIndustryMemory(data) : null;
  }

  // ==================== Project Memory ====================

  async getProject(projectId: string): Promise<ProjectMemory | null> {
    const { data, error } = await supabaseAdmin
      .from("memory_projects")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToProjectMemory(data) : null;
  }

  async getAllProjects(): Promise<ProjectMemory[]> {
    const { data, error } = await supabaseAdmin
      .from("memory_projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToProjectMemory);
  }

  async saveProject(project: ProjectMemory): Promise<void> {
    const row = projectMemoryToRow(project);
    const { error } = await supabaseAdmin
      .from("memory_projects")
      .upsert(row, { onConflict: "project_id" });

    if (error) throw error;
    await this.updateIndex();
  }

  // ==================== Index ====================

  async getIndex(): Promise<MemoryIndex> {
    const { data, error } = await supabaseAdmin
      .from("memory_index")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        version: 2,
        lastUpdated: new Date().toISOString(),
        totalClients: 0,
        totalProjects: 0,
        industryCoverage: {},
      };
    }

    return {
      version: data.version,
      lastUpdated: data.updated_at,
      totalClients: data.total_clients,
      totalProjects: data.total_projects,
      industryCoverage: data.industry_coverage || {},
    };
  }

  async updateIndex(): Promise<void> {
    const clients = await this.getAllClients();
    const projects = await this.getAllProjects();
    const industries = await this.getAllIndustries();

    const coverage = buildIndustryCoverage(industries);

    const index = {
      version: 2,
      total_clients: clients.length,
      total_projects: projects.length,
      industry_coverage: coverage,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("memory_index")
      .upsert({ id: 1, ...index }, { onConflict: "id" });

    if (error) throw error;
  }
}
