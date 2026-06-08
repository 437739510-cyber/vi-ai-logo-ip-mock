# Add PDF export button to manual-pages viewer
p = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\manual-pages\[projectId]\page.tsx'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# Check if Download import exists
if 'Download' not in c.split('import')[2].split('from')[0]:
    c = c.replace(
        'Sparkles, Loader2',
        'Sparkles, Loader2, Download'
    )

# Add export button after the generate button (find the closing div/button block)
old_marker = '{hasPages ? "重新生成全部页面" : "AI 生成全部页面"}'
new_marker = '{hasPages ? "重新生成全部页面" : "AI 生成全部页面"}'

export_html = '''
        {hasPages && (
          <button
            onClick={async () => {
              const res = await fetch("/api/ai/export-pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
              });
              const data = await res.json();
              if (data.success) {
                window.open(data.url, "_blank");
              } else {
                alert("导出失败: " + (data.error || data.detail));
              }
            }}
            className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出 PDF
          </button>
        )}
      </div>'''

# Find the closing div after the generate button
c = c.replace('</>\n        </button>\n      </div>\n\n      {generating &&', '</>\n        </button>\n      </div>\n' + export_html + '\n      {generating &&')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('Done - PDF export button added')
