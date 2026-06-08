# Fix generate-manual-pages route
import re

filepath = r"C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\api\ai\generate-manual-pages\route.ts"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix signage line
content = content.replace('signage and\u6807\u8bc6system', 'signage system')

# Update generatePageImage to return detailed errors
old_func = '''async function generatePageImage(prompt: string, apiKey: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = {
        model: "wan2.5-t2i-preview",
        input: { prompt, negative_prompt: "blurry, low quality, deformed, watermark", size: "1024*1024", n: 1 },
        parameters: { seed: Math.floor(Math.random() * 999999) },
      };

      const resp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });

      if (!resp.ok) { await new Promise((r) => setTimeout(r, 3000)); continue; }
      const data = await resp.json();

      if (data.output?.task_id) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const taskResp = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${data.output.task_id}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!taskResp.ok) continue;
          const taskData = await taskResp.json();
          if (taskData.output?.task_status === "SUCCEEDED") {
            return taskData.output?.results?.[0]?.image_url || null;
          }
          if (taskData.output?.task_status === "FAILED") break;
        }
      }

    } catch { await new Promise((r) => setTimeout(r, 3000)); }
  }
  return null;
}'''

new_func = '''async function generatePageImage(prompt: string, apiKey: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = {
        model: "wan2.5-t2i-preview",
        input: { prompt, negative_prompt: "blurry, low quality, deformed, watermark", size: "1024*1024", n: 1 },
        parameters: { seed: Math.floor(Math.random() * 999999) },
      };

      const resp = await fetch(DASHSCOPE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        if (attempt < 2) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        return `HTTP_${resp.status}: ${errText.substring(0, 200)}`;
      }
      const data = await resp.json();

      if (data.output?.task_id) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const taskResp = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${data.output.task_id}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!taskResp.ok) continue;
          const taskData = await taskResp.json();
          if (taskData.output?.task_status === "SUCCEEDED") {
            const url = taskData.output?.results?.[0]?.image_url;
            if (url) return url;
            return "Task OK but no image_url";
          }
          if (taskData.output?.task_status === "FAILED") {
            return "Task failed: " + (taskData.output?.message || "Unknown");
          }
        }
        return "Polling timeout (30 tries)";
      }
      return "Unexpected: " + JSON.stringify(data).substring(0, 200);
    } catch (e) {
      if (attempt < 2) { await new Promise((r) => setTimeout(r, 3000)); continue; }
      return "Error: " + (e instanceof Error ? e.message : String(e)).substring(0, 200);
    }
  }
  return "All 3 attempts failed";
}'''

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Function replaced successfully")
else:
    print("ERROR: Could not find old function in file")
    # Debug: find where generatePageImage is
    idx = content.find('async function generatePageImage')
    if idx >= 0:
        print(f"Found at position {idx}")
        print(content[idx:idx+100])

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
