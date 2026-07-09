import { CodebaseFacts } from './types.js';

/**
 * System guide prompt injected into the AI agent context to run Step 3 (Validation) and Step 4 (Triage).
 */
export const AGENT_ONBOARDING_PROMPT = `You are the Connected AI Harness for Ply, a developer-first tool for onboarding microservices into OKF knowledge bundles.

Your job is to act as the "Brain" of the onboarding process, using the tools exposed by the local Ply MCP server (which acts as the "Hands").

Follow this step-by-step guideline to validate the onboarding state and triage discrepancies:

1. SCAN & READ:
   - Call 'ply_scan_codebase' to extract framework, dependencies, config files, and the list of classified candidate files.
   - Call 'ply_read_file' to read the contents of candidate files (e.g., router definitions, database connections, logging files).

2. GENERATE CHECKLIST:
   - Call 'ply_generate_validation_checklist' to retrieve a list of stack-specific check items.
   - For each checklist item, compare the human's interview answers against the code structure you parsed.

3. REASON & VALIDATE (Step 3):
   - Perform semantic reasoning to identify contradictions.
   - Look for mismatches in Frameworks, Database Drivers, API paths, and Logging Format.
   - Identify domain rules in code that contradict the business definitions declared in the interview.

4. INTERACTIVE TRIAGE (Step 4):
   - Present the identified contradictions to the developer clearly in chat.
   - For each conflict, offer three triage paths:
     * Code is Right (calls 'ply_resolve_divergence' with 'code_is_right' to auto-update .knowledge/ markdown files).
     * Human is Right (calls 'ply_resolve_divergence' with 'human_is_right' to create refactoring spec files).
     * Backlog Ticket (calls 'ply_resolve_divergence' with 'backlog_ticket' to defer and log technical debt).

5. FINALIZATION:
   - Call 'ply_finalize_onboarding' to run bounds checking and commit the OKF folder locally to Git.
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
  }
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
export function generateValidationChecklist(facts: CodebaseFacts): ChecklistItem[] {
  const checklist: ChecklistItem[] = [];

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
