import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { scanCodebase, readCandidateFile, ingestReferenceDocument } from './scanners/projectScanner.js';
import { applyResolution } from './resolution.js';
import { validateSchemaBounds, commitKnowledgeBundle } from './finalization.js';
import { AGENT_ONBOARDING_PROMPT, OKF_SCHEMAS, generateValidationChecklist } from './guidelines.js';
const server = new Server({
    name: 'ply-mcp-server',
    version: '0.1.0'
}, {
    capabilities: {
        tools: {},
        prompts: {},
        resources: {}
    }
});
// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'ply_scan_codebase',
                description: 'Scan a microservice repository path to detect frameworks, dependencies, and list candidate files for semantic validation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoPath: {
                            type: 'string',
                            description: 'Absolute path to the microservice repository.'
                        }
                    },
                    required: ['repoPath']
                }
            },
            {
                name: 'ply_read_file',
                description: 'Read the contents of a specific file inside the repository for semantic inspection.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoPath: {
                            type: 'string',
                            description: 'Absolute path to the microservice repository.'
                        },
                        filePath: {
                            type: 'string',
                            description: 'Relative path to the target file.'
                        }
                    },
                    required: ['repoPath', 'filePath']
                }
            },
            {
                name: 'ply_generate_validation_checklist',
                description: 'Generate a stack-specific validation checklist based on local codebase facts to guide the AI agent during semantic verification.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codebaseFacts: {
                            type: 'object',
                            description: 'The JSON state representing extracted codebase facts.'
                        }
                    },
                    required: ['codebaseFacts']
                }
            },
            {
                name: 'ply_resolve_divergence',
                description: 'Apply a resolution to a specific divergence item (mutating docs or generating backlog/refactor specs).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoPath: {
                            type: 'string',
                            description: 'Absolute path to the microservice repository.'
                        },
                        divergence: {
                            type: 'object',
                            description: 'The divergence item object to resolve.'
                        },
                        actionType: {
                            type: 'string',
                            enum: ['code_is_right', 'human_is_right', 'backlog_ticket'],
                            description: 'The selected resolution action type.'
                        }
                    },
                    required: ['repoPath', 'divergence', 'actionType']
                }
            },
            {
                name: 'ply_finalize_onboarding',
                description: 'Verify schema bounds of the .knowledge directory and commit the knowledge bundle locally to git.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoPath: {
                            type: 'string',
                            description: 'Absolute path to the microservice repository.'
                        },
                        version: {
                            type: 'string',
                            description: 'Optional version number for the OKF bundle (defaults to 0.1.0).'
                        }
                    },
                    required: ['repoPath']
                }
            },
            {
                name: 'ply_ingest_reference',
                description: 'Ingest an existing documentation source (GitHub URL or local Markdown file path) to help seed the knowledge base.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoPath: {
                            type: 'string',
                            description: 'Absolute path to the microservice repository.'
                        },
                        sourceType: {
                            type: 'string',
                            enum: ['github', 'file'],
                            description: 'Type of documentation source.'
                        },
                        sourcePath: {
                            type: 'string',
                            description: 'The GitHub repository URL or absolute/relative local Markdown file path.'
                        }
                    },
                    required: ['repoPath', 'sourceType', 'sourcePath']
                }
            }
        ]
    };
});
// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'ply_scan_codebase': {
                const repoPath = String(args?.repoPath);
                const result = await scanCodebase(repoPath);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            case 'ply_read_file': {
                const repoPath = String(args?.repoPath);
                const filePath = String(args?.filePath);
                const content = await readCandidateFile(repoPath, filePath);
                return {
                    content: [
                        {
                            type: 'text',
                            text: content
                        }
                    ]
                };
            }
            case 'ply_generate_validation_checklist': {
                const codebaseFacts = args?.codebaseFacts;
                const result = generateValidationChecklist(codebaseFacts);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            case 'ply_resolve_divergence': {
                const repoPath = String(args?.repoPath);
                const divergence = args?.divergence;
                const actionType = String(args?.actionType);
                const result = await applyResolution(repoPath, divergence, actionType);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            case 'ply_finalize_onboarding': {
                const repoPath = String(args?.repoPath);
                const version = args?.version ? String(args.version) : '0.1.0';
                // 1. Run schema validation
                const valResult = await validateSchemaBounds(repoPath);
                if (!valResult.valid) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    success: false,
                                    errors: valResult.errors,
                                    message: 'Schema bounds validation failed. Ensure all 6 OKF specs exist.'
                                }, null, 2)
                            }
                        ]
                    };
                }
                // 2. Run local git commit
                const commitResult = await commitKnowledgeBundle(repoPath, version);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(commitResult, null, 2)
                        }
                    ]
                };
            }
            case 'ply_ingest_reference': {
                const repoPath = String(args?.repoPath);
                const sourceType = String(args?.sourceType);
                const sourcePath = String(args?.sourcePath);
                const result = await ingestReferenceDocument(repoPath, sourceType, sourcePath);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            default:
                throw new Error(`Tool not found: ${name}`);
        }
    }
    catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Error executing tool: ${error.message}`
                }
            ]
        };
    }
});
// Define Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: 'ply_onboarding_guide',
                description: 'Guided instructions for the AI Harness to perform Step 3 (Validation) and Step 4 (Triage) of microservice onboarding.'
            }
        ]
    };
});
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    if (name !== 'ply_onboarding_guide') {
        throw new Error(`Prompt not found: ${name}`);
    }
    return {
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: AGENT_ONBOARDING_PROMPT
                }
            }
        ]
    };
});
// Define Resources (OKF Schemas)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: Object.entries(OKF_SCHEMAS).map(([id, schema]) => ({
            uri: schema.uri,
            name: schema.name,
            description: schema.description,
            mimeType: 'text/markdown'
        }))
    };
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const match = Object.values(OKF_SCHEMAS).find(s => s.uri === uri);
    if (!match) {
        throw new Error(`Resource not found: ${uri}`);
    }
    return {
        contents: [
            {
                uri,
                mimeType: 'text/markdown',
                text: match.content
            }
        ]
    };
});
// Start the server using stdio transport
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Ply MCP server running on stdio transport.');
}
main().catch((error) => {
    console.error('Failed to start Ply MCP server:', error);
    process.exit(1);
});
