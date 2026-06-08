/**
 * fix-pptx-frontend.js — Fix PptxGenJS handler in page.tsx
 * 
 * Problem: handleGeneratePptx sends project.logoUrl/project.mascotUrl
 *   which don't exist. Should use submission.logoAssets/mascotAssets.
 *   Also brandColors from submission is { primary: "#xxx" } format,
 *   not { primary: { hex: "#xxx" } }.
 * 
 * Usage: node fix-pptx-frontend.js
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'app', 'admin', 'projects', '[id]', 'page.tsx');

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE);
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf-8');

// Find and replace the handleGeneratePptx function
const oldHandler = `/** Generate PPTX via PptxGenJS engine (no API cost!) */
  const handleGeneratePptx = async () => {
    if (!project) return;
    setGeneratingPptx(true);
    setPptxError(null);
    setPptxResult(null);
    try {
      const res = await fetch('/api/ai/generate-manual-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          clientInfo: {
            companyName: project.clientName || project.name || '',
            brandVision: submission?.brandVision || '',
            coreValues: submission?.coreValues || '',
            targetMarket: submission?.targetMarket || '',
            industry: submission?.industry || '',
            logoPhilosophy: submission?.logoPhilosophy || '',
            mascotPhilosophy: submission?.mascotPhilosophy || '',
          },
          brandColors: project.brandColors || {
            primary: { hex: '#1A73E8' },
            secondary: { hex: '#34A853' },
            accent: { hex: '#FBBC04' },
          },
          logoUrl: project.logoUrl,
          mascotUrl: project.mascotUrl,
        }),
      });`;

const newHandler = `/** Generate PPTX via PptxGenJS engine (no API cost!) */
  const handleGeneratePptx = async () => {
    if (!project) return;
    setGeneratingPptx(true);
    setPptxError(null);
    setPptxResult(null);
    try {
      const res = await fetch('/api/ai/generate-manual-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          clientInfo: {
            companyName: submission?.companyName || submission?.clientName || project.name || '',
            brandVision: submission?.brandVision || '',
            coreValues: submission?.coreValues || '',
            targetMarket: submission?.targetMarket || '',
            industry: submission?.industry || '',
            logoPhilosophy: submission?.logoPhilosophy || '',
            mascotPhilosophy: submission?.mascotPhilosophy || '',
          },
          brandColors: submission?.brandColors || project.brandColors || {
            primary: { hex: '#1A73E8' },
            secondary: { hex: '#34A853' },
            accent: { hex: '#FBBC04' },
          },
          logoUrl: submission?.logoAssets?.[0]?.url || '',
          mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || '',
          mascotFiles: submission?.mascotAssets?.flatMap((m: any) => m.files || []) || [],
        }),
      });`;

if (content.includes(oldHandler)) {
  content = content.replace(oldHandler, newHandler);
  fs.writeFileSync(FILE, content, 'utf-8');
  console.log('OK: handleGeneratePptx fixed - now uses submission data correctly');
  console.log('');
  console.log('Changes:');
  console.log('1. companyName: submission.companyName (was project.clientName)');
  console.log('2. brandColors: submission.brandColors (was project.brandColors)');
  console.log('3. logoUrl: submission.logoAssets[0].url (was project.logoUrl - did not exist!)');
  console.log('4. mascotUrl: submission.mascotAssets[0].files[0].url (was project.mascotUrl - did not exist!)');
  console.log('5. Added mascotFiles array for fallback mascot loading');
} else if (content.includes('handleGeneratePptx')) {
  // Handler exists but different format - try to find the body JSON part
  const oldBodyPattern = /logoUrl: project\.logoUrl,\s*mascotUrl: project\.mascotUrl,/;
  if (oldBodyPattern.test(content)) {
    content = content.replace(
      oldBodyPattern,
      `logoUrl: submission?.logoAssets?.[0]?.url || '',
          mascotUrl: submission?.mascotAssets?.[0]?.files?.[0]?.url || '',
          mascotFiles: submission?.mascotAssets?.flatMap((m: any) => m.files || []) || [],`
    );
    // Also fix company name
    content = content.replace(
      /companyName: project\.clientName \|\| project\.name/,
      'companyName: submission?.companyName || submission?.clientName || project.name'
    );
    // Also fix brandColors
    content = content.replace(
      /brandColors: project\.brandColors/,
      'brandColors: submission?.brandColors || project.brandColors'
    );
    fs.writeFileSync(FILE, content, 'utf-8');
    console.log('OK: handleGeneratePptx patched via regex');
  } else {
    console.log('Handler exists but format is different. Manual fix may be needed.');
    console.log('Looking for logoUrl/mascotUrl assignments...');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('logoUrl:') || lines[i].includes('mascotUrl:')) {
        console.log(`  Line ${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
} else {
  console.log('No handleGeneratePptx found - page.tsx may not have been patched yet.');
  console.log('Run add-pptx-section.js first, then this script.');
}
