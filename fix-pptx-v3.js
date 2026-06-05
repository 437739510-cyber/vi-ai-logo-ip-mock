/**
 * fix-pptx-v3.js — One-shot fix for PptxGenJS frontend handler
 * 
 * Fixes:
 * - companyName from submission.companyName (not project.clientName which doesn't exist)
 * - brandColors from submission.brandColors (handles both {hex} and string formats)
 * - logoUrl from submission.logoAssets[0].url
 * - mascotUrl from submission.mascotAssets[0].files[0].url
 * - mascotFiles array for fallback
 * 
 * Usage: node fix-pptx-v3.js
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'app', 'admin', 'projects', '[id]', 'page.tsx');

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE);
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf-8');
let changes = 0;

// Fix 1: companyName source
const cnPatterns = [
  /companyName:\s*project\.clientName\s*\|\|\s*project\.name/g,
  /companyName:\s*project\.name/g,
];
for (const pat of cnPatterns) {
  if (pat.test(content)) {
    content = content.replace(pat, 'companyName: submission?.companyName || submission?.clientName || project.name');
    changes++;
    console.log('Fix 1: companyName → submission?.companyName');
    break;
  }
}
// Also check if it's already fixed
if (content.includes('submission?.companyName') && !content.includes('project.clientName')) {
  console.log('Fix 1: Already correct');
}

// Fix 2: brandColors source
const bcOld = /brandColors:\s*project\.brandColors/g;
if (bcOld.test(content)) {
  content = content.replace(bcOld, 'brandColors: submission?.brandColors || project.brandColors');
  changes++;
  console.log('Fix 2: brandColors → submission?.brandColors');
} else if (content.includes('submission?.brandColors')) {
  console.log('Fix 2: Already correct');
}

// Fix 3: logoUrl source
const logoOld = /logoUrl:\s*project\.logoUrl/g;
if (logoOld.test(content)) {
  content = content.replace(logoOld, "logoUrl: submission?.logoAssets?.[0]?.url || ''");
  changes++;
  console.log('Fix 3: logoUrl → submission?.logoAssets?.[0]?.url');
} else if (content.includes('submission?.logoAssets')) {
  console.log('Fix 3: Already correct');
}

// Fix 4: mascotUrl source
const mascotOld = /mascotUrl:\s*project\.mascotUrl/g;
if (mascotOld.test(content)) {
  content = content.replace(mascotOld, "mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || ''");
  changes++;
  console.log('Fix 4: mascotUrl → submission?.mascotAssets?.[0]?.files?.[0]?.url');
  // Also add mascotFiles after mascotUrl
  content = content.replace(
    "mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || '',\n",
    "mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || '',\n          mascotFiles: submission?.mascotAssets?.flatMap((m: any) => m.files || []) || [],\n"
  );
  changes++;
  console.log('Fix 4b: Added mascotFiles');
} else if (content.includes('submission?.mascotAssets')) {
  console.log('Fix 4: Already correct');
}

// Fix 5: AI layout planner port
const aiFile = path.join(__dirname, 'src', 'lib', 'ai-layout-planner.ts');
if (fs.existsSync(aiFile)) {
  let aiContent = fs.readFileSync(aiFile, 'utf-8');
  if (aiContent.includes('localhost:3001')) {
    aiContent = aiContent.replace(/localhost:3001/g, 'localhost:3000');
    fs.writeFileSync(aiFile, aiContent, 'utf-8');
    console.log('Fix 5: AI layout planner port 3001 → 3000');
    changes++;
  } else {
    console.log('Fix 5: Port already correct');
  }
} else {
  console.log('Fix 5: ai-layout-planner.ts not found (skip)');
}

if (changes > 0) {
  fs.writeFileSync(FILE, content, 'utf-8');
  console.log(`\nOK: ${changes} fixes applied`);
} else {
  console.log('\nNo changes needed — all fixes already applied');
}
