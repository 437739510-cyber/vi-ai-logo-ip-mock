const fs = require("fs");
const path = "C:\\Users\\Administrator\\Documents\\Codex\\vi-ai-logo-ip-mock\\src\\app\\admin\\manual-pages\\[projectId]\\page.tsx";
let content = fs.readFileSync(path, "utf8");

// Step 1: Remove the 3 useState declarations at the very end of the file
content = content.replace(
  /\}\s*\r?\n  const \[step, setStep\] = useState<1 \| 2 \| 3 \| 4 \| 5>\(1\);\s*\r?\n  const \[mascotPromptSet, setMascotPromptSet\] = useState<MascotPromptSet \| null>\(null\);\s*\r?\n  const \[mascotAccepted, setMascotAccepted\] = useState\(true\);\s*$/,
  "}\n"
);

// Step 2: Add mascotPromptSet and mascotAccepted inside component (after businessProfile)
content = content.replace(
  "  const [businessProfile, setBusinessProfile] = useState",
  "  const [mascotPromptSet, setMascotPromptSet] = useState(null);\n  const [mascotAccepted, setMascotAccepted] = useState(true);\n\n  const [businessProfile, setBusinessProfile] = useState"
);

// Step 3: Fix garbled Chinese text
content = content.replace('industry: "鏈寚瀹? }', 'industry: "未指定" }');

fs.writeFileSync(path, content, "utf8");
console.log("Done, size: " + content.length);
