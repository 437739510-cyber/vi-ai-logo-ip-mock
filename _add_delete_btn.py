#!/usr/bin/env python3
import re

filepath = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\app\admin\manual-pages\[projectId]\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add Trash2 to imports
c = c.replace(
    'import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Loader2, Hand, Play } from "lucide-react";',
    'import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Loader2, Hand, Play, Trash2 } from "lucide-react";'
)

# 2. Add handleClearPages function before loading check
old_func = '  if (loading) {'
new_func = '''  const handleClearPages = async () => {
    if (!window.confirm("\u786e\u5b9a\u8981\u5220\u9664\u5df2\u751f\u6210\u7684\u6240\u6709\u9875\u9762\u5417\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002")) return;
    try {
      const res = await fetch("/api/ai/clear-generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setPagesData(null);
        setLivePages([]);
        setLiveErrors([]);
        setProgress({ done: 0, total: 11 });
      } else {
        alert("\u5220\u9664\u5931\u8d25: " + (data.error || "\u672a\u77e5\u9519\u8bef"));
      }
    } catch {
      alert("\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5");
    }
  };

  if (loading) {'''
c = c.replace(old_func, new_func)

# 3. Add delete button next to manual mode button
old_btn = '''          {mode === "manual" && !generating && (
            <button onClick={startManualGenerate}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Hand className="w-4 h-4" /> {displayPages.length > 0 ? "\u7ee7\u7eed\u751f\u6210" : "\u5f00\u59cb\u9010\u5f20\u751f\u6210"}
            </button>
          )}
        </div>'''

new_btn = '''          {mode === "manual" && !generating && (
            <button onClick={startManualGenerate}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Hand className="w-4 h-4" /> {displayPages.length > 0 ? "\u7ee7\u7eed\u751f\u6210" : "\u5f00\u59cb\u9010\u5f20\u751f\u6210"}
            </button>
          )}
          {displayPages.length > 0 && !generating && (
            <button onClick={handleClearPages}
              className="px-3 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> \u5220\u9664\u5df2\u751f\u6210
            </button>
          )}
        </div>'''

c = c.replace(old_btn, new_btn)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

print('OK')
print('Trash2 import:', 'Trash2' in c)
print('handleClearPages:', 'handleClearPages' in c)
