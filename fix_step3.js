const fs = require("fs");
const path = "C:\\Users\\Administrator\\Documents\\Codex\\vi-ai-logo-ip-mock\\src\\app\\admin\\manual-pages\\[projectId]\\page.tsx";
let content = fs.readFileSync(path, "utf8");

// Remove duplicate line: "  }, [params]);" appearing twice
content = content.replace(/  }, \[params\]\);\r?\n  }, \[params\]\);/, "  }, [params]);");

// Ensure there's a blank line between the useEffect closing and the new useEffect
content = content.replace(
  /  }, \[params\]\);\r?\n\r?\n  \/\/ Auto-generate/,
  "  }, [params]);\n\n  // Auto-generate"
);

fs.writeFileSync(path, content, "utf8");
console.log("Done");
