/**
 * System guide prompt injected into the AI agent context to run Step 3 (Validation) and Step 4 (Triage).
 */
export const AGENT_ONBOARDING_PROMPT = `You are the Connected AI Harness for Ply, a developer-first tool for onboarding microservices into OKF knowledge bundles.

Your job is to act as the "Brain" of the onboarding process, using the tools exposed by the local Ply MCP server (which acts as the "Hands").

IMPORTANT: You must execute this onboarding process interactively. Do NOT automate everything in a single run. You MUST ask the user questions and wait for their responses at the specified steps.

For a detailed manual on how to execute this lifecycle, please read the resource 'okf://docs/mcp_instructions'.

Follow this step-by-step guideline:

STEP 0: DOCUMENT COLLECTION (INTERACTIVE)
1. Ask the user in chat: "Do you have any existing documentation (local Markdown files or GitHub repository URLs) you would like to share to seed the knowledge base?"
2. If they provide any paths or URLs, invoke the 'ply_ingest_reference' tool to process them.
3. Show the user a summary of what was ingested, and ask if they have any more documents. Repeat until they say they have no more documents to share.

STEP 1: PRE-FLIGHT SCAN (BACKGROUND)
1. Invoke the 'ply_scan_codebase' tool to detect frameworks, dependencies, and get the list of candidate files.
2. Read the contents of important candidate files using the 'ply_read_file' tool (e.g. read files containing routes, db connections, configuration settings).

STEP 2: ADAPTIVE INTERVIEW PASS (INTERACTIVE)
1. Based on the files you read and documents ingested, formulate and ask the user questions to gather missing business logic context that code cannot reveal:
   - What are the core Domain business rules/invariants?
   - What is the glossary of terms?
   - What is the service uptime SLA/operations metrics prefix?
2. Wait for the user's answers. Do NOT generate placeholders or make up answers yourself.

STEP 3 & 4: VALIDATION & INTERACTIVE TRIAGE (INTERACTIVE)
1. Call 'ply_generate_validation_checklist' to retrieve the stack-specific checklist of checks to run.
2. Compare the user's interview answers against the codebase facts you parsed.
3. Identify contradictions (e.g. Mismatched database drivers, path prefixes, framework versions, or missing security middleware).
4. Present these contradictions one-by-one to the user in chat. Ask the user how they want to resolve each:
   - [Option 1] Code is Right: Mutates the spec documents. Calls 'ply_resolve_divergence' with 'code_is_right'.
   - [Option 2] Human is Right: Creates refactoring specifications. Calls 'ply_resolve_divergence' with 'human_is_right'.
   - [Option 3] Defer: Creates backlog cards. Calls 'ply_resolve_divergence' with 'backlog_ticket'.
5. Wait for the user's choice for each conflict and call the matching tool before moving to the next.

STEP 5: FINALIZATION & COMMIT (BACKGROUND)
1. Invoke the 'ply_finalize_onboarding' tool to run OKF schema checks, stage files, and commit the knowledge bundle locally to Git.
2. Output the final commit hash and summarize the onboarded knowledge spec.
`;
/**
 * OKF Schema Descriptions exposed as MCP resources.
 */
export const OKF_SCHEMAS = {
    domain: {
        uri: 'okf://schemas/domain',
        name: 'Domain Knowledge Schema',
        description: 'Schema rules for Domain.md (business terms, glossary, and domain lifecycle rules).',
        content: `# OKF Domain Specification Schema
Expected content:
- Terminology Glossary: Business terms mapped to concepts.
- Business Rules: Core business invariants.
- Domain Scope: Geographic, compliance, and user bounds.`
    },
    apis: {
        uri: 'okf://schemas/apis',
        name: 'APIs Knowledge Schema',
        description: 'Schema rules for APIs.md (communication contracts and router endpoints).',
        content: `# OKF APIs Specification Schema
Expected content:
- Endpoint List: Router paths, HTTP methods, and parameter shapes.
- External Integrations: Webhooks, 3rd party HTTP client definitions (e.g., Stripe, Sendgrid).`
    },
    architecture: {
        uri: 'okf://schemas/architecture',
        name: 'Architecture Knowledge Schema',
        description: 'Schema rules for Architecture.md (technologies, framework versions, structural patterns).',
        content: `# OKF Architecture Specification Schema
Expected content:
- Tech Stack: Language, runtime, framework names, and versions.
- Structural Patterns: Controller, routing, dependency injection architectures.`
    },
    data: {
        uri: 'okf://schemas/data',
        name: 'Data Knowledge Schema',
        description: 'Schema rules for Data.md (databases, collections, column schemas, foreign keys).',
        content: `# OKF Data Specification Schema
Expected content:
- Database Client: Primary connection specifications.
- Collection/Table Specs: Table layouts, types, primary keys, and relationships.`
    },
    references: {
        uri: 'okf://schemas/references',
        name: 'References Knowledge Schema',
        description: 'Schema rules for References.md (RAG offloading, wiki reference links).',
        content: `# OKF References Specification Schema
Expected content:
- Document Anchors: Links to internal wiki pages, confluence, or API specifications.`
    },
    operations: {
        uri: 'okf://schemas/operations',
        name: 'Operations Knowledge Schema',
        description: 'Schema rules for Operations.md (observability, logging specifications, metrics).',
        content: `# OKF Operations Specification Schema
Expected content:
- Logging specs: Winston/Pino JSON vs unstructured log output rules.
- Metrics specs: Datadog/Prometheus metric name prefixes.`
    },
    instructions: {
        uri: 'okf://docs/mcp_instructions',
        name: 'Ply MCP Server Lifecycle Guide',
        description: 'Detailed instructions on how to use Ply tools, resource schemas, and handle state machine transitions during onboarding.',
        content: `# Ply MCP Onboarding Lifecycle Guide
This local MCP server acts as the "Hands" of the onboarding process, guiding you, the AI Harness, through microservice knowledge bundle creation.

## Core Lifecycle Flow
1. **ply_get_onboarding_status**: ALWAYS call this tool first. It returns the current step, instructions, and checklist targets. You must follow the instructions returned by the status tool.
2. **DOCUMENT_COLLECTION**: Prompt the user for Markdown files or GitHub URLs, run ply_ingest_reference, then call ply_advance_onboarding_step with nextStep='PRE_FLIGHT_SCAN'.
3. **PRE_FLIGHT_SCAN**: Run ply_scan_codebase and read candidate files with ply_read_file. Call ply_advance_onboarding_step with nextStep='INTERVIEW'.
4. **INTERVIEW**: Ask the user questions in chat about glossary terms, domain rules, and SLAs. Submit responses using ply_submit_interview_answers (this auto-advances the step to TRIAGE).
5. **TRIAGE**: Generate the checklist via ply_generate_validation_checklist. Present divergences to the user one by one in chat. Resolve them using ply_resolve_divergence. Call ply_advance_onboarding_step with nextStep='FINALIZATION'.
6. **FINALIZATION**: Call ply_finalize_onboarding to run OKF schema checks and commit the knowledge folder.`
    }
};
/**
 * Generates validation guidelines dynamically based on local codebase facts,
 * guiding the AI Agent on what to search for.
 */
export function generateValidationChecklist(facts) {
    const checklist = [];
    // Framework Guideline
    if (facts.framework !== 'unknown') {
        checklist.push({
            id: 'CHK-ARCH-01',
            category: 'architecture',
            checkDescription: `Verify if the primary framework is declared as "${facts.framework}". Check if version numbers match the codebase package config.`,
            codeContext: `Codebase relies on framework "${facts.framework}" under dependencies.`
        });
    }
    // Database Guideline
    if (facts.detectedDBDrivers.length > 0) {
        checklist.push({
            id: 'CHK-DATA-01',
            category: 'data',
            checkDescription: `Verify if the database spec matches the detected drivers: ${facts.detectedDBDrivers.join(', ')}.`,
            codeContext: `Found database drivers in dependencies: ${JSON.stringify(facts.detectedDBDrivers)}.`
        });
    }
    // Router Guideline
    checklist.push({
        id: 'CHK-APIS-01',
        category: 'apis',
        checkDescription: 'Read route candidate files to verify that all REST endpoints matching router paths are documented correctly in APIs.md. Pay close attention to version prefixes (e.g. /api/v1).',
        codeContext: 'Examine files classified under the "apis" category to extract endpoints.'
    });
    // Logging Guideline
    checklist.push({
        id: 'CHK-OPER-01',
        category: 'operations',
        checkDescription: 'Analyze codebase logging statements. Check if JSON structured logging packages (like winston or pino) are used in dependencies and confirm that Operations.md logging formats match.',
        codeContext: `Detected package dependencies: ${JSON.stringify(Object.keys(facts.dependencies))}.`
    });
    return checklist;
}
