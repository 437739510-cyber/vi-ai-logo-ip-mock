/**
 * fix-ai-layout-port.js — Fix AI Layout Planner port
 * 
 * Problem: ai-layout-planner.ts hardcodes localhost:3001 but dev server is on 3000
 * This causes all AILayoutPlanner calls to fail with "fetch failed"
 * 
 * Usage: node fix-ai-layout-port.js
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src', 'lib', 'ai-layout-planner.ts');

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE);
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf-8');

// Fix the port from 3001 to 3000
const oldPort = 'http://localhost:3001';
const newPort = 'http://localhost:3000';

if (content.includes(oldPort)) {
  content = content.replace(oldPort, newPort);
  fs.writeFileSync(FILE, content, 'utf-8');
  console.log('OK: Fixed AI Layout Planner port from 3001 to 3000');
} else if (content.includes(newPort)) {
  console.log('Port already set to 3000, no change needed');
} else {
  console.log('Could not find port pattern in file');
}
