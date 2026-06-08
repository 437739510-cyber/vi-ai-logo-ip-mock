// API Route: POST /api/ai/clear-generated
// Delete generated manual pages and their data file
import { NextRequest, NextResponse } from "next/server";
import { unlink, readdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const errors: string[] = [];

    // 1. Delete the JSON data file
    const dataPath = path.join(process.cwd(), "public", "mock", "manual-pages-" + projectId + ".json");
    try {
      await unlink(dataPath);
    } catch {
      // File might not exist, that's OK
    }

    // 2. Delete generated image files for this project
    const genDir = path.join(process.cwd(), "public", "generated");
    try {
      const files = await readdir(genDir);
      for (const file of files) {
        if (file.startsWith(projectId + "-")) {
          try {
            await unlink(path.join(genDir, file));
          } catch {
            errors.push("Failed to delete: " + file);
          }
        }
      }
    } catch {
      // Directory might not exist
    }

    return NextResponse.json({
      success: true,
      message: "Generated pages cleared",
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
  }
}
