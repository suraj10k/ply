import * as path from 'path';
import { scanCodebase, readCandidateFile } from './scanners/projectScanner.js';
import { runValidation } from './engine.js';
import { mockInterviewState } from './mockData.js';
import { CodebaseFacts } from './types.js';

// ANSI colors for reporting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  fgBlack: '\x1b[30m',
  white: '\x1b[37m'
};

async function testHybridFlow() {
  console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  P L Y  //  Hybrid Validation Flow (Phase 2 Demo)  ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);

  const mockRepoPath = path.resolve('./mock-microservice');
  console.log(`${colors.bold}Step 1: Running Deterministic Local Codebase Scan...${colors.reset}`);
  console.log(`Scanning repository path: ${colors.blue}${mockRepoPath}${colors.reset}\n`);

  // 1. Run local scan
  const scanResult = await scanCodebase(mockRepoPath);
  
  console.log(`${colors.bold}Detected Metadata:${colors.reset}`);
  console.log(`  - Framework: ${colors.magenta}${scanResult.facts.framework}${colors.reset}`);
  console.log(`  - Database Drivers: ${colors.magenta}${JSON.stringify(scanResult.facts.detectedDBDrivers)}${colors.reset}`);
  console.log(`  - Config Files: ${colors.gray}${JSON.stringify(scanResult.facts.configFiles)}${colors.reset}`);
  console.log(`  - Direct Dependencies: ${colors.gray}${Object.keys(scanResult.facts.dependencies).slice(0, 5).join(', ')}...${colors.reset}\n`);

  console.log(`${colors.bold}Classified Candidate Files for LLM Review:${colors.reset}`);
  scanResult.candidateFiles.forEach(file => {
    let catColor = colors.white;
    if (file.category === 'apis') catColor = colors.cyan;
    if (file.category === 'data') catColor = colors.green;
    if (file.category === 'architecture') catColor = colors.yellow;
    if (file.category === 'operations') catColor = colors.blue;

    console.log(`  - [${catColor}${file.category.toUpperCase()}${colors.reset}] ${file.filePath} (${file.sizeBytes} bytes)`);
  });
  console.log();

  // 2. Simulate Connected AI Harness (LLM) processing candidate files
  console.log(`${colors.bold}Step 2: Simulating LLM-Assisted Fact Extraction...${colors.reset}`);
  console.log(`${colors.dim}Reading candidate files and extracting semantic information...${colors.reset}`);

  // LLM reads 'src/routes/userRoutes.ts'
  const apiFile = scanResult.candidateFiles.find(f => f.category === 'apis');
  const extractedRoutes: Array<{ path: string; method: string }> = [];

  if (apiFile) {
    const fileContent = await readCandidateFile(mockRepoPath, apiFile.filePath);
    console.log(`\n  ${colors.gray}--- Reading file: ${apiFile.filePath} ---${colors.reset}`);
    // Print a snippet of the read file content
    console.log(fileContent.split('\n').map(line => `    | ${line}`).slice(0, 15).join('\n'));
    console.log(`  ${colors.gray}----------------------------------------${colors.reset}\n`);

    // Simulated LLM-based parsing logic
    console.log(`  🤖 ${colors.magenta}LLM Reasoning:${colors.reset} Parsing routes using semantic pattern matching...`);
    if (fileContent.includes("router.get('/users'")) {
      extractedRoutes.push({ path: '/users', method: 'GET' });
    }
    if (fileContent.includes("router.post('/login'")) {
      extractedRoutes.push({ path: '/login', method: 'POST' });
    }
    
    console.log(`  ✔ Extracted routes from AST content: ${colors.green}${JSON.stringify(extractedRoutes)}${colors.reset}\n`);
  }

  // Merge the LLM-extracted facts into our codebase facts
  const completedCodebaseFacts: CodebaseFacts = {
    ...scanResult.facts,
    detectedRoutes: extractedRoutes
  };

  // 3. Run Step 3 Validation Engine
  console.log(`${colors.bold}Step 3: Running Divergence Validation Engine...${colors.reset}`);
  const report = runValidation(mockRepoPath, mockInterviewState, completedCodebaseFacts);

  console.log(`Found ${colors.red}${report.divergences.length}${colors.reset} divergence(s):\n`);

  report.divergences.forEach((div, idx) => {
    let severityBadge = '';
    if (div.severity === 'high') {
      severityBadge = `${colors.bgRed}${colors.fgBlack}${colors.bold} HIGH ${colors.reset}`;
    } else if (div.severity === 'medium') {
      severityBadge = `${colors.bgYellow}${colors.fgBlack}${colors.bold} MEDIUM ${colors.reset}`;
    } else {
      severityBadge = `${colors.bgBlue}${colors.fgBlack}${colors.bold} LOW ${colors.reset}`;
    }

    console.log(`${colors.bold}${idx + 1}. [${div.category.toUpperCase()}] ${div.title}${colors.reset}  ${severityBadge}`);
    console.log(`   ${colors.red}${colors.bold}✖ Human Claim:${colors.reset}   ${div.humanClaim}`);
    console.log(`   ${colors.green}${colors.bold}✓ Code Evidence:${colors.reset} ${div.codeEvidence}`);
    console.log(`   ${colors.bold}Suggested Triage Options:${colors.reset}`);
    div.suggestedActions.forEach(action => {
      console.log(`     - [${action.type}] ${action.description}`);
    });
    console.log();
  });

  console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
}

testHybridFlow().catch(err => {
  console.error('Error running test flow:', err);
});
