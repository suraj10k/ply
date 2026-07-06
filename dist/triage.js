import * as readline from 'readline';
import * as path from 'path';
import { scanCodebase } from './scanners/projectScanner.js';
import { runValidation } from './engine.js';
import { mockInterviewState } from './mockData.js';
import { applyResolution } from './resolution.js';
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
const askQuestion = (query) => {
    return new Promise((resolve) => rl.question(query, resolve));
};
async function startTriageLoop() {
    console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}  P L Y  //  Interactive Triage Mode (Step 4 Demo)  ${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
    const mockRepoPath = path.resolve('./mock-microservice');
    console.log(`Scanning target repository: ${colors.blue}${mockRepoPath}${colors.reset}`);
    // 1. Scan codebase
    const scanResult = await scanCodebase(mockRepoPath);
    // 2. Mock LLM route extraction
    const completedCodebaseFacts = {
        ...scanResult.facts,
        detectedRoutes: [
            { path: '/users', method: 'GET' },
            { path: '/login', method: 'POST' }
        ]
    };
    // 3. Validation
    const report = runValidation(mockRepoPath, mockInterviewState, completedCodebaseFacts);
    if (report.divergences.length === 0) {
        console.log(`${colors.green}${colors.bold}✔ No divergences found. Codebase is aligned!${colors.reset}\n`);
        rl.close();
        return;
    }
    console.log(`Found ${colors.red}${report.divergences.length}${colors.reset} divergence(s) requiring resolution.\n`);
    // 4. Guided resolution loop
    for (let i = 0; i < report.divergences.length; i++) {
        const div = report.divergences[i];
        let severityBadge = '';
        if (div.severity === 'high')
            severityBadge = `${colors.bgRed}${colors.fgBlack}${colors.bold} HIGH ${colors.reset}`;
        else if (div.severity === 'medium')
            severityBadge = `${colors.bgYellow}${colors.fgBlack}${colors.bold} MEDIUM ${colors.reset}`;
        else
            severityBadge = `${colors.bgBlue}${colors.fgBlack}${colors.bold} LOW ${colors.reset}`;
        console.log(`${colors.bold}Conflict [${i + 1}/${report.divergences.length}]: [${div.category.toUpperCase()}] ${div.title}${colors.reset}  ${severityBadge}`);
        console.log(`  ${colors.red}${colors.bold}✖ Human Claim:${colors.reset}   ${div.humanClaim}`);
        console.log(`  ${colors.green}${colors.bold}✓ Code Evidence:${colors.reset} ${div.codeEvidence}\n`);
        console.log(`${colors.bold}How would you like to resolve this?${colors.reset}`);
        console.log(`  ${colors.bold}[1] Code is Right${colors.reset}  - Auto-update spec document`);
        console.log(`  ${colors.bold}[2] Human is Right${colors.reset} - Generate code refactoring specifications`);
        console.log(`  ${colors.bold}[3] Defer${colors.reset}          - Create technical debt backlog issue`);
        console.log(`  ${colors.bold}[4] Skip${colors.reset}           - Skip resolving this divergence for now\n`);
        let validAnswer = false;
        let choiceType = 'skip';
        while (!validAnswer) {
            const answer = await askQuestion(`${colors.cyan}Enter selection (1-4): ${colors.reset}`);
            const trimmed = answer.trim();
            if (trimmed === '1') {
                choiceType = 'code_is_right';
                validAnswer = true;
            }
            else if (trimmed === '2') {
                choiceType = 'human_is_right';
                validAnswer = true;
            }
            else if (trimmed === '3') {
                choiceType = 'backlog_ticket';
                validAnswer = true;
            }
            else if (trimmed === '4') {
                choiceType = 'skip';
                validAnswer = true;
            }
            else {
                console.log(`${colors.red}Invalid option. Please input 1, 2, 3, or 4.${colors.reset}`);
            }
        }
        if (choiceType === 'skip') {
            console.log(`\n${colors.yellow}⚠ Skipped divergence resolution.${colors.reset}\n`);
            continue;
        }
        console.log(`\nApplying resolution choice: ${colors.bold}${choiceType}${colors.reset}...`);
        try {
            const res = await applyResolution(mockRepoPath, div, choiceType);
            if (res.success) {
                console.log(`${colors.green}✔ ${res.message}${colors.reset}\n`);
            }
            else {
                console.log(`${colors.red}✖ Failed to apply resolution: ${res.message}${colors.reset}\n`);
            }
        }
        catch (err) {
            console.log(`${colors.red}✖ Error applying resolution: ${err.message}${colors.reset}\n`);
        }
    }
    console.log(`${colors.green}${colors.bold}Triage session complete.${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
    rl.close();
}
startTriageLoop().catch(err => {
    console.error(err);
    rl.close();
});
