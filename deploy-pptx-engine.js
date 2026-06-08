/**
 * deploy-pptx-engine.js — PptxGenJS Engine Deployment Script
 * 
 * Usage: node deploy-pptx-engine.js
 * 
 * What this does:
 * 1. Copies render-pptx.ts to src/lib/
 * 2. Copies API route to src/app/api/ai/generate-manual-pptx/
 * 3. Installs pptxgenjs dependency
 * 4. Cleans .next cache
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname);

console.log('=== Brand Brain PptxGenJS Engine Deployment ===');

// Step 1: Copy files
console.log('\n[1/4] Copying engine files...');

const copyMap = [
  { src: 'src/lib/render-pptx.ts', dest: 'src/lib/render-pptx.ts' },
  { src: 'src/app/api/ai/generate-manual-pptx/route.ts', dest: 'src/app/api/ai/generate-manual-pptx/route.ts' },
];

for (const { src, dest } of copyMap) {
  const srcPath = path.join(PROJECT_ROOT, src);
  const destPath = path.join(PROJECT_ROOT, dest);
  
  if (!fs.existsSync(srcPath)) {
    console.error('  ERROR: Source file not found: ' + src);
    console.error('  Make sure you extracted fix-pack-pptx-engine.tar.gz first');
    process.exit(1);
  }
  
  // Ensure dest directory exists
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  
  fs.copyFileSync(srcPath, destPath);
  console.log('  OK: ' + src + ' -> ' + dest);
}

// Step 2: Install pptxgenjs
console.log('\n[2/4] Installing pptxgenjs...');
try {
  execSync('npm install pptxgenjs', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  console.log('  OK: pptxgenjs installed');
} catch (e) {
  console.error('  ERROR: Failed to install pptxgenjs');
  console.error('  Please run manually: npm install pptxgenjs');
}

// Step 3: Clean .next cache
console.log('\n[3/4] Cleaning Next.js cache...');
const nextDir = path.join(PROJECT_ROOT, '.next');
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('  OK: .next cache cleared');
} else {
  console.log('  OK: No .next cache to clear');
}

// Step 4: Done
console.log('\n[4/4] Deployment complete!');
console.log('\n=== What was installed ===');
console.log('1. PptxGenJS Rendering Engine: src/lib/render-pptx.ts');
console.log('2. PPTX Generation API:       src/app/api/ai/generate-manual-pptx/route.ts');
console.log('3. Dependency:                 pptxgenjs');
console.log('\n=== How to use ===');
console.log('1. Run: npm run dev');
console.log('2. POST to /api/ai/generate-manual-pptx with:');
console.log('   { projectId, clientInfo, brandColors, logoUrl, mascotUrl }');
console.log('3. Response: { success, url, pageCount, fileName }');
console.log('4. Download the .pptx file from the returned URL');
