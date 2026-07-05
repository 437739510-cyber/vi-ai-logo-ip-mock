// Merge Round 1 + Round 2 markdown into final VI manual

// Merge two rounds with a clear separator
export function mergeManualRound(round1Md: string, round2Md: string): string {
  const r1 = round1Md.trim();
  const r2 = round2Md.trim();
  return r1 + "\n\n---\n\n" + r2;
}

// Generate Table of Contents from merged markdown
export function generateToc(md: string): string {
  const lines = md.split("\n");
  const tocLines: string[] = [];
  tocLines.push("## 目录\n");

  let pageNum = 1;
  for (const line of lines) {
    const h2Match = line.match(/^##\s+(\d+)\s+(.+)$/);
    if (h2Match) {
      const chNum = h2Match[1];
      const title = h2Match[2].replace(/[*_`]/g, "").trim();
      tocLines.push(`- ${chNum}  ${title}`);
      pageNum++;
    }
  }

  if (tocLines.length === 1) {
    tocLines.push("(目录生成失败)");
  }

  return tocLines.join("\n");
}
