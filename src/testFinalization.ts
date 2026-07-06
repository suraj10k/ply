import * as path from 'path';
import { validateSchemaBounds, commitKnowledgeBundle } from './finalization.js';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

async function testFinalizationFlow() {
  console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  P L Y  //  Finalization & Local Commit Test (Step 5 Demo)  ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);

  const mockRepoPath = path.resolve('./mock-microservice');
  console.log(`Target Repository: ${colors.bold}${mockRepoPath}${colors.reset}\n`);

  // 1. Verify schema bounds
  console.log('Step 1: Validating OKF Schema Bounds (Checking 6 Mandatory Files)...');
  const validation = await validateSchemaBounds(mockRepoPath);
  
  if (validation.valid) {
    console.log(`${colors.green}✔ OKF Schema is fully valid! All 6 mandatory specs exist and are populated.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✖ Schema Validation Failed!${colors.reset}`);
    validation.errors.forEach(err => console.log(`  - ${err}`));
    console.log('\nCannot proceed with commit.\n');
    return;
  }

  // 2. Local Commit
  console.log('Step 2: Staging and Committing OKF Knowledge Bundle locally...');
  const commit = await commitKnowledgeBundle(mockRepoPath, '1.0.0');

  if (commit.success) {
    console.log(`${colors.green}✔ ${commit.message}${colors.reset}`);
    if (commit.commitHash) {
      console.log(`  - Local Commit SHA: ${colors.bold}${commit.commitHash}${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✖ Commit failed: ${commit.message}${colors.reset}`);
  }

  console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
}

testFinalizationFlow().catch(console.error);
