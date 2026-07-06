import * as fs from 'fs/promises';
import * as path from 'path';
import { scanCodebase } from './scanners/projectScanner.js';
import { runValidation } from './engine.js';
import { mockInterviewState } from './mockData.js';
import { applyResolution } from './resolution.js';
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m'
};
async function testResolutionFlow() {
    console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}  P L Y  //  Resolution Engine Test (Step 4 Demo)  ${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
    const mockRepoPath = path.resolve('./mock-microservice');
    // 1. Initial State: Read original Architecture.md
    const archPath = path.join(mockRepoPath, '.knowledge/Architecture.md');
    const originalArch = await fs.readFile(archPath, 'utf-8');
    console.log(`${colors.bold}Original Architecture.md content:${colors.reset}`);
    console.log(originalArch.trim().split('\n').map(l => `  | ${l}`).join('\n') + '\n');
    // 2. Scan and Validate to get current divergences
    const scanResult = await scanCodebase(mockRepoPath);
    const completedCodebaseFacts = {
        ...scanResult.facts,
        detectedRoutes: [
            { path: '/users', method: 'GET' },
            { path: '/login', method: 'POST' }
        ]
    };
    const report = runValidation(mockRepoPath, mockInterviewState, completedCodebaseFacts);
    // 3. Resolve Divergence 1 (Framework Mismatch) using 'code_is_right' (Auto-update Architecture.md)
    const div1 = report.divergences.find(d => d.category === 'architecture');
    console.log(`Applying ${colors.green}code_is_right${colors.reset} resolution for: ${colors.bold}${div1.title}${colors.reset}...`);
    const res1 = await applyResolution(mockRepoPath, div1, 'code_is_right');
    console.log(`✔ ${res1.message}\n`);
    // Verify Architecture.md was mutated
    const updatedArch = await fs.readFile(archPath, 'utf-8');
    console.log(`${colors.bold}Updated Architecture.md content:${colors.reset}`);
    console.log(updatedArch.trim().split('\n').map(l => `  | ${l}`).join('\n') + '\n');
    // 4. Resolve Divergence 2 (Database Engine Mismatch) using 'backlog_ticket' (Defer resolution)
    const div2 = report.divergences.find(d => d.category === 'data');
    console.log(`Applying ${colors.blue}backlog_ticket${colors.reset} resolution for: ${colors.bold}${div2.title}${colors.reset}...`);
    const res2 = await applyResolution(mockRepoPath, div2, 'backlog_ticket');
    console.log(`✔ ${res2.message}\n`);
    // Read the created backlog ticket
    if (res2.filePath) {
        const backlogTicketContent = await fs.readFile(path.join(mockRepoPath, res2.filePath), 'utf-8');
        console.log(`${colors.bold}Created Backlog Ticket (${res2.filePath}):${colors.reset}`);
        console.log(backlogTicketContent.trim().split('\n').map(l => `  | ${l}`).slice(0, 10).join('\n') + '\n  | ... (truncated)\n');
    }
    // 5. Resolve Divergence 3 (API Path Prefix Mismatch) using 'human_is_right' (Generate refactoring instructions)
    const div3 = report.divergences.find(d => d.category === 'apis');
    console.log(`Applying ${colors.magenta}human_is_right${colors.reset} resolution for: ${colors.bold}${div3.title}${colors.reset}...`);
    const res3 = await applyResolution(mockRepoPath, div3, 'human_is_right');
    console.log(`✔ ${res3.message}\n`);
    // Read the created refactoring spec
    if (res3.filePath) {
        const refactorContent = await fs.readFile(path.join(mockRepoPath, res3.filePath), 'utf-8');
        console.log(`${colors.bold}Created Refactoring Spec (${res3.filePath}):${colors.reset}`);
        console.log(refactorContent.trim().split('\n').map(l => `  | ${l}`).slice(0, 10).join('\n') + '\n  | ... (truncated)\n');
    }
    console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
}
testResolutionFlow().catch(console.error);
