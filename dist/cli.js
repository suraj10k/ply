import { runValidation } from './engine.js';
import { mockInterviewState, mockCodebaseFacts } from './mockData.js';
// ANSI terminal color utilities
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
function printBanner() {
    console.log(`\n${colors.cyan}${colors.bold}================================================================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}  K N O P L Y  //  Divergence Validation Engine (Step 3 Mock Run)  ${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}================================================================================${colors.reset}\n`);
}
function runMockValidation() {
    const repoPath = '/home/suraj/dev/ply-microservice';
    printBanner();
    console.log(`${colors.bold}Scanning repository:${colors.reset} ${colors.blue}${repoPath}${colors.reset}`);
    console.log(`${colors.dim}Comparing Step 2 Interview answers against AST codebase parsing facts...${colors.reset}\n`);
    const report = runValidation(repoPath, mockInterviewState, mockCodebaseFacts);
    if (report.divergences.length === 0) {
        console.log(`${colors.green}${colors.bold}✔ No divergences found! Human input is fully aligned with codebase structure.${colors.reset}\n`);
        return;
    }
    console.log(`${colors.magenta}${colors.bold}Found ${report.divergences.length} explicit contradictions between human input and actual source code:${colors.reset}\n`);
    report.divergences.forEach((div, idx) => {
        let severityBadge = '';
        if (div.severity === 'high') {
            severityBadge = `${colors.bgRed}${colors.fgBlack}${colors.bold} HIGH ${colors.reset}`;
        }
        else if (div.severity === 'medium') {
            severityBadge = `${colors.bgYellow}${colors.fgBlack}${colors.bold} MEDIUM ${colors.reset}`;
        }
        else {
            severityBadge = `${colors.bgBlue}${colors.fgBlack}${colors.bold} LOW ${colors.reset}`;
        }
        console.log(`${colors.bold}${idx + 1}. [${div.category.toUpperCase()}] ${div.title}${colors.reset}  ${severityBadge}`);
        console.log(`   ${colors.red}${colors.bold}✖ Human Claim:${colors.reset}   ${div.humanClaim}`);
        console.log(`   ${colors.green}${colors.bold}✓ Code Evidence:${colors.reset} ${div.codeEvidence}`);
        console.log(`   ${colors.bold}Suggested Triage Options:${colors.reset}`);
        div.suggestedActions.forEach(action => {
            let typeLabel = '';
            if (action.type === 'code_is_right') {
                typeLabel = `${colors.green}[Use Code Data]${colors.reset}`;
            }
            else if (action.type === 'human_is_right') {
                typeLabel = `${colors.yellow}[Keep Human Data / Refactor Code]${colors.reset}`;
            }
            else {
                typeLabel = `${colors.blue}[Create Backlog Ticket]${colors.reset}`;
            }
            console.log(`     - ${typeLabel} ${action.description}`);
            if (action.resolutionPlan?.fileToModify) {
                console.log(`       ${colors.gray}Target file mutation:${colors.reset} ${colors.cyan}${action.resolutionPlan.fileToModify}${colors.reset}`);
            }
        });
        console.log();
    });
    // Summary section
    console.log(`${colors.cyan}${colors.bold}--------------------------------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bold}Validation Summary:${colors.reset}`);
    console.log(`  - Total Divergences: ${colors.bold}${report.summary.totalDivergences}${colors.reset}`);
    console.log(`  - ${colors.red}High Severity: ${report.summary.highSeverity}${colors.reset}`);
    console.log(`  - ${colors.yellow}Medium Severity: ${report.summary.mediumSeverity}${colors.reset}`);
    console.log(`  - ${colors.blue}Low Severity: ${report.summary.lowSeverity}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}--------------------------------------------------------------------------------${colors.reset}\n`);
    console.log(`${colors.dim}Run matching Step 4 (Triage) to resolve individual conflicts interactively.${colors.reset}\n`);
}
runMockValidation();
