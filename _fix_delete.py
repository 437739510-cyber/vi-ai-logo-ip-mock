import re

source = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\projects\[id]\page.tsx'
with open(source, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add imports
c = c.replace(
    "import { ArrowLeft, ExternalLink } from \"lucide-react\";",
    "import { ArrowLeft, ExternalLink, Trash2 } from \"lucide-react\";"
)

c = c.replace(
    "import { useRouter } from \"next/navigation\";\n",
    ""
)

c = c.replace(
    'import { useEffect, useState } from "react";',
    'import { useEffect, useState } from "react";\nimport { useRouter } from "next/navigation";'
)

# 2. Add state and handlers after the loading/error states
old_loading_block = """  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);"""

new_loading_block = """  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);"""

c = c.replace(old_loading_block, new_loading_block)

# 3. Add router
c = c.replace(
    "export default function ProjectDetailPage({",
    "export default function ProjectDetailPage({\n  params,",
)

# 4. Add delete handler before the return statement
old_return = "  if (error) return <ErrorState message={error} />;"
new_return = """  const handleDelete = async () => {
    if (!window.confirm(\"确定要删除此项目吗？此操作不可撤销。\")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/admin/projects");
      } else {
        alert(\"删除失败: \" + (data.error || \"未知错误\"));
      }
    } catch {
      alert(\"网络错误，请重试\");
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <ErrorState message={error} />;"""

c = c.replace(old_return, new_return)

# 5. Add delete button in the header area after the "返回项目列表" link
old_header = """      {/* 返回 */}
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回项目列表
      </Link>"""

new_header = """      {/* 返回 + 删除 */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目列表
        </Link>
        {project && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-danger border border-danger/30 rounded-lg hover:bg-danger/5 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "删除中..." : "删除项目"}
          </button>
        )}
      </div>"""

c = c.replace(old_header, new_header)

with open(source, 'w', encoding='utf-8') as f:
    f.write(c)
print('Updated project detail page with delete button')
