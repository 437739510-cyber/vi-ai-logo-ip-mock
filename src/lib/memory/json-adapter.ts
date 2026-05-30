/**
 * Brand Brain — JSON Memory Adapter
 *
 * Implements MemoryAdapter using local JSON files for storage.
 *
 * Directory structure:
 *   public/memory/
 *   ├── index.json              # Memory index
 *   ├── clients.json            # All client memories
 *   ├── industries.json         # All industry memories
 *   └── projects.json           # All project memories
 *
 * JSON adapter enables 0-config development. Swap to SQL adapter for production.
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type {
  MemoryAdapter,
  ClientMemory,
  IndustryMemory,
  ProjectMemory,
  MemoryIndex,
} from "./types";

const MEMORY_DIR = path.join(process.cwd(), "public", "memory");

function memoryPath(filename: string): string {
  return path.join(MEMORY_DIR, filename);
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: any): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export class JsonMemoryAdapter implements MemoryAdapter {
  async initialize(): Promise<void> {
    await ensureDir(MEMORY_DIR);

    // Create initial files if they don't exist
    const index = await this.getIndex();
    await writeJson(memoryPath("index.json"), index);
    await writeJson(memoryPath("clients.json"), []);
    await writeJson(memoryPath("industries.json"), []);
    await writeJson(memoryPath("projects.json"), []);
  }

  // ==================== Client Memory ====================

  async getClient(clientId: string): Promise<ClientMemory | null> {
    const clients = await readJson<ClientMemory[]>(memoryPath("clients.json"), []);
    return clients.find((c) => c.clientId === clientId) || null;
  }

  async getAllClients(): Promise<ClientMemory[]> {
    return readJson<ClientMemory[]>(memoryPath("clients.json"), []);
  }

  async saveClient(client: ClientMemory): Promise<void> {
    const clients = await readJson<ClientMemory[]>(memoryPath("clients.json"), []);
    const idx = clients.findIndex((c) => c.clientId === client.clientId);
    if (idx >= 0) {
      clients[idx] = { ...client, updatedAt: new Date().toISOString() };
    } else {
      clients.push({ ...client, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    await writeJson(memoryPath("clients.json"), clients);
    await this.updateIndex();
  }

  async findClientByCompany(companyName: string): Promise<ClientMemory | null> {
    const clients = await readJson<ClientMemory[]>(memoryPath("clients.json"), []);
    return clients.find((c) => c.companyName === companyName) || null;
  }

  // ==================== Industry Memory ====================

  async getIndustry(industryKey: string): Promise<IndustryMemory | null> {
    const industries = await readJson<IndustryMemory[]>(memoryPath("industries.json"), []);
    return industries.find((i) => i.industryKey === industryKey) || null;
  }

  async getAllIndustries(): Promise<IndustryMemory[]> {
    return readJson<IndustryMemory[]>(memoryPath("industries.json"), []);
  }

  async saveIndustry(industry: IndustryMemory): Promise<void> {
    const industries = await readJson<IndustryMemory[]>(memoryPath("industries.json"), []);
    const idx = industries.findIndex((i) => i.industryKey === industry.industryKey);
    if (idx >= 0) {
      industries[idx] = { ...industry, updatedAt: new Date().toISOString() };
    } else {
      industries.push({ ...industry, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    await writeJson(memoryPath("industries.json"), industries);
    await this.updateIndex();
  }

  async findIndustryByCategory(category: string, subCategory?: string): Promise<IndustryMemory | null> {
    const industries = await readJson<IndustryMemory[]>(memoryPath("industries.json"), []);
    return industries.find((i) => {
      if (subCategory) return i.category === category && i.subCategory === subCategory;
      return i.category === category;
    }) || null;
  }

  // ==================== Project Memory ====================

  async getProject(projectId: string): Promise<ProjectMemory | null> {
    const projects = await readJson<ProjectMemory[]>(memoryPath("projects.json"), []);
    return projects.find((p) => p.projectId === projectId) || null;
  }

  async getAllProjects(): Promise<ProjectMemory[]> {
    return readJson<ProjectMemory[]>(memoryPath("projects.json"), []);
  }

  async saveProject(project: ProjectMemory): Promise<void> {
    const projects = await readJson<ProjectMemory[]>(memoryPath("projects.json"), []);
    const idx = projects.findIndex((p) => p.projectId === project.projectId);
    if (idx >= 0) {
      projects[idx] = { ...project, updatedAt: new Date().toISOString() };
    } else {
      projects.push({ ...project, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    await writeJson(memoryPath("projects.json"), projects);
    await this.updateIndex();
  }

  // ==================== Index ====================

  async getIndex(): Promise<MemoryIndex> {
    const index = await readJson<MemoryIndex>(memoryPath("index.json"), {
      version: 1,
      lastUpdated: new Date().toISOString(),
      totalClients: 0,
      totalProjects: 0,
      industryCoverage: {},
    });
    return index;
  }

  async updateIndex(): Promise<void> {
    const clients = await this.getAllClients();
    const projects = await this.getAllProjects();
    const industries = await this.getAllIndustries();

    const coverage: Record<string, { subCategories: string[]; projectCount: number }> = {};
    for (const ind of industries) {
      coverage[ind.category] = {
        subCategories: ind.subCategory ? [ind.subCategory] : [],
        projectCount: ind.projectCount,
      };
    }

    const index: MemoryIndex = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      totalClients: clients.length,
      totalProjects: projects.length,
      industryCoverage: coverage,
    };

    await writeJson(memoryPath("index.json"), index);
  }
}

/** Singleton instance */
let _instance: JsonMemoryAdapter | null = null;

export function getMemoryAdapter(): JsonMemoryAdapter {
  if (!_instance) {
    _instance = new JsonMemoryAdapter();
  }
  return _instance;
}
