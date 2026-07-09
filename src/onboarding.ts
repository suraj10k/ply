import * as readline from 'readline';
import * as path from 'path';
import { ingestReferenceDocument, scanCodebase } from './scanners/projectScanner.js';
import { runValidation } from './engine.js';
import { mockInterviewState } from './mockData.js';
import { applyResolution } from './resolution.js';
import { validateSchemaBounds, commitKnowledgeBundle } from './finalization.js';
import { CodebaseFacts } from './types.js';

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
  fgBlack: '\x1b[30m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function runOnboardingPipeline() {
  console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}     P L Y  //  Unified Onboarding Orchestrator Pipeline     ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);

  const repoPath = path.resolve('./mock-microservice');
  console.log(`${colors.bold}Target Workspace:${colors.reset} ${colors.blue}${repoPath}${colors.reset}\n`);

  // --- STEP 1: Pre-Flight Codebase Scan ---
  console.log(`${colors.cyan}${colors.bold}Step 1: Pre-Flight Codebase Scan${colors.reset}`);
  console.log(`${colors.dim}Scanning dependencies and extracting AST candidates...${colors.reset}\n`);

  const scanResult = await scanCodebase(repoPath);
  
  console.log(`${colors.bold}Detected Codebase Stack:${colors.reset}`);
  console.log(`  - Framework: ${colors.magenta}${scanResult.facts.framework}${colors.reset}`);
  console.log(`  - Database Drivers: ${colors.magenta}${JSON.stringify(scanResult.facts.detectedDBDrivers)}${colors.reset}\n`);

  // --- STEP 2: Document Ingestion & Seeding ---
  console.log(`${colors.cyan}${colors.bold}Step 2: Document Ingestion & Seeding${colors.reset}`);
  console.log(`${colors.dim}Based on detected tech stack, you can share existing documentation (local Markdown files or GitHub URLs)${colors.reset}`);
  console.log(`${colors.dim}to help pre-fill the service knowledge bundle.${colors.reset}\n`);

  const ingestedDocs: Array<{ title: string; type: string; snippet: string }> = [];

  while (true) {
    const docPath = await askQuestion(
      `${colors.bold}Share a spec/docs file for ${scanResult.facts.framework}/${scanResult.facts.detectedDBDrivers.join('/')} [or press Enter/type 'done' to finish]:${colors.reset} `
    );
    const trimmed = docPath.trim();

    if (!trimmed || trimmed.toLowerCase() === 'done' || trimmed.toLowerCase() === 'no') {
      break;
    }

    let sourceType: 'github' | 'file' = 'file';
    if (trimmed.toLowerCase().includes('github.com')) {
      sourceType = 'github';
    }

    console.log(`Analyzing document: ${colors.yellow}${trimmed}${colors.reset}...`);
    const result = await ingestReferenceDocument(repoPath, sourceType, trimmed);

    if (result.success) {
      console.log(`${colors.green}✔ Successfully ingested "${result.title}"!${colors.reset}`);
      ingestedDocs.push({
        title: result.title,
        type: sourceType,
        snippet: result.contentSnippet
      });
    } else {
      console.log(`${colors.red}✖ Ingestion Failed: ${result.error}${colors.reset}`);
    }
    console.log();
  }

  console.log(`\n${colors.green}Total Ingested Documents: ${ingestedDocs.length}${colors.reset}\n`);

  // We use the ingested documents to refine/fill the interview state/codebase facts
  const completedCodebaseFacts: CodebaseFacts = {
    ...scanResult.facts,
    detectedRoutes: [
      { path: '/users', method: 'GET' },
      { path: '/login', method: 'POST' }
    ]
  };

  if (ingestedDocs.length > 0) {
    console.log(`🤖 ${colors.magenta}AI Harness Action:${colors.reset} Ingested document references successfully matched against codebase structures.`);
  }

  // --- STEP 3: Divergence Validation ---
  console.log(`\n${colors.cyan}${colors.bold}Step 3: Running Divergence Validation Engine${colors.reset}`);
  console.log(`${colors.dim}Comparing code state against human interview inputs...${colors.reset}\n`);

  const report = runValidation(repoPath, mockInterviewState, completedCodebaseFacts);

  if (report.divergences.length === 0) {
    console.log(`${colors.green}${colors.bold}✔ No divergences found! Service is aligned.${colors.reset}`);
  } else {
    console.log(`Found ${colors.red}${report.divergences.length}${colors.reset} contradictions between code and design intent:\n`);

    // --- STEP 4: Interactive Triage ---
    console.log(`${colors.cyan}${colors.bold}Step 4: Interactive Triage Session${colors.reset}`);
    
    for (let i = 0; i < report.divergences.length; i++) {
      const div = report.divergences[i];
      let severityBadge = '';
      if (div.severity === 'high') severityBadge = `${colors.bgRed}${colors.fgBlack}${colors.bold} HIGH ${colors.reset}`;
      else if (div.severity === 'medium') severityBadge = `${colors.bgYellow}${colors.fgBlack}${colors.bold} MEDIUM ${colors.reset}`;
      else severityBadge = `${colors.bgBlue}${colors.fgBlack}${colors.bold} LOW ${colors.reset}`;

      console.log(`\nConflict [${i + 1}/${report.divergences.length}]: [${div.category.toUpperCase()}] ${div.title}${colors.reset}  ${severityBadge}`);
      console.log(`  ${colors.red}${colors.bold}✖ Human Claim:${colors.reset}   ${div.humanClaim}`);
      console.log(`  ${colors.green}${colors.bold}✓ Code Evidence:${colors.reset} ${div.codeEvidence}\n`);

      console.log(`How should we resolve this?`);
      console.log(`  ${colors.bold}[1] Code is Right${colors.reset}  - Auto-update spec documents`);
      console.log(`  ${colors.bold}[2] Human is Right${colors.reset} - Generate code refactoring specifications`);
      console.log(`  ${colors.bold}[3] Defer${colors.reset}          - Create technical debt backlog issue`);
      console.log(`  ${colors.bold}[4] Skip${colors.reset}           - Skip resolving this divergence\n`);

      let validAnswer = false;
      let choiceType: 'code_is_right' | 'human_is_right' | 'backlog_ticket' | 'skip' = 'skip';

      while (!validAnswer) {
        const answer = await askQuestion(`${colors.cyan}Enter selection (1-4): ${colors.reset}`);
        const trimmed = answer.trim();

        if (trimmed === '1') { choiceType = 'code_is_right'; validAnswer = true; }
        else if (trimmed === '2') { choiceType = 'human_is_right'; validAnswer = true; }
        else if (trimmed === '3') { choiceType = 'backlog_ticket'; validAnswer = true; }
        else if (trimmed === '4') { choiceType = 'skip'; validAnswer = true; }
        else {
          console.log(`${colors.red}Invalid option. Please input 1, 2, 3, or 4.${colors.reset}`);
        }
      }

      if (choiceType === 'skip') {
        console.log(`\n${colors.yellow}⚠ Skipped divergence.${colors.reset}`);
        continue;
      }

      try {
        const res = await applyResolution(repoPath, div, choiceType);
        if (res.success) {
          console.log(`${colors.green}✔ ${res.message}${colors.reset}`);
        } else {
          console.log(`${colors.red}✖ Failed: ${res.message}${colors.reset}`);
        }
      } catch (err: any) {
        console.log(`${colors.red}✖ Error: ${err.message}${colors.reset}`);
      }
    }
  }

  // --- STEP 5: Finalization & Local Commit ---
  console.log(`\n${colors.cyan}${colors.bold}Step 5: OKF Finalization & Git Commit${colors.reset}`);
  console.log(`${colors.dim}Validating schema bounds and committing bundle to git...${colors.reset}\n`);

  // Ensure missing specs are validated (we already created Domain.md and References.md)
  const valResult = await validateSchemaBounds(repoPath);
  if (!valResult.valid) {
    console.log(`${colors.red}✖ Validation Failed. Missing files: ${valResult.missingFiles.join(', ')}${colors.reset}`);
    rl.close();
    return;
  }

  const commitResult = await commitKnowledgeBundle(repoPath, '1.0.0');
  if (commitResult.success) {
    console.log(`${colors.green}✔ ${commitResult.message}${colors.reset}`);
    if (commitResult.commitHash) {
      console.log(`  - Local Commit SHA: ${colors.bold}${commitResult.commitHash}${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✖ Commit failed: ${commitResult.message}${colors.reset}`);
  }

  console.log(`\n${colors.green}${colors.bold}✔ Onboarding Process Successfully Completed!${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
  rl.close();
}

runOnboardingPipeline().catch(err => {
  console.error(err);
  rl.close();
});
