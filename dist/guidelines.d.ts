import { CodebaseFacts } from './types.js';
/**
 * System guide prompt injected into the AI agent context to run Step 3 (Validation) and Step 4 (Triage).
 */
export declare const AGENT_ONBOARDING_PROMPT = "You are the Connected AI Harness for Ply, a developer-first tool for onboarding microservices into OKF knowledge bundles.\n\nYour job is to act as the \"Brain\" of the onboarding process, using the tools exposed by the local Ply MCP server (which acts as the \"Hands\").\n\nFollow this step-by-step guideline to validate the onboarding state and triage discrepancies:\n\n1. SCAN & READ:\n   - Call 'ply_scan_codebase' to extract framework, dependencies, config files, and the list of classified candidate files.\n   - Call 'ply_read_file' to read the contents of candidate files (e.g., router definitions, database connections, logging files).\n\n2. GENERATE CHECKLIST:\n   - Call 'ply_generate_validation_checklist' to retrieve a list of stack-specific check items.\n   - For each checklist item, compare the human's interview answers against the code structure you parsed.\n\n3. REASON & VALIDATE (Step 3):\n   - Perform semantic reasoning to identify contradictions.\n   - Look for mismatches in Frameworks, Database Drivers, API paths, and Logging Format.\n   - Identify domain rules in code that contradict the business definitions declared in the interview.\n\n4. INTERACTIVE TRIAGE (Step 4):\n   - Present the identified contradictions to the developer clearly in chat.\n   - For each conflict, offer three triage paths:\n     * Code is Right (calls 'ply_resolve_divergence' with 'code_is_right' to auto-update .knowledge/ markdown files).\n     * Human is Right (calls 'ply_resolve_divergence' with 'human_is_right' to create refactoring spec files).\n     * Backlog Ticket (calls 'ply_resolve_divergence' with 'backlog_ticket' to defer and log technical debt).\n\n5. FINALIZATION:\n   - Call 'ply_finalize_onboarding' to run bounds checking and commit the OKF folder locally to Git.\n";
/**
 * OKF Schema Descriptions exposed as MCP resources.
 */
export declare const OKF_SCHEMAS: {
    domain: {
        uri: string;
        name: string;
        description: string;
        content: string;
    };
    apis: {
        uri: string;
        name: string;
        description: string;
        content: string;
    };
    architecture: {
        uri: string;
        name: string;
        description: string;
        content: string;
    };
    data: {
        uri: string;
        name: string;
        description: string;
        content: string;
    };
    references: {
        uri: string;
        name: string;
        description: string;
        content: string;
    };
    operations: {
        uri: string;
        name: string;
        description: string;
        content: string;
    };
};
export interface ChecklistItem {
    id: string;
    category: string;
    checkDescription: string;
    codeContext: string;
}
/**
 * Generates validation guidelines dynamically based on local codebase facts,
 * guiding the AI Agent on what to search for.
 */
export declare function generateValidationChecklist(facts: CodebaseFacts): ChecklistItem[];
