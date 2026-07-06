import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { scanCodebase, readCandidateFile } from './scanners/projectScanner.js';
import { runValidation } from './engine.js';
import { applyResolution } from './resolution.js';
import { validateSchemaBounds, commitKnowledgeBundle } from './finalization.js';

const server = new Server(
  {
    name: 'ply-mcp-server',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

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
        name: 'ply_validate_onboarding',
        description: 'Run the validation engine comparing the human onboarding interview state with codebase facts to generate a Divergence Report.',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: {
              type: 'string',
              description: 'Absolute path to the microservice repository.'
            },
            interviewState: {
              type: 'object',
              description: 'The JSON state representing the human onboarding interview answers.'
            },
            codebaseFacts: {
              type: 'object',
              description: 'The JSON state representing extracted codebase facts (including LLM-resolved routes).'
            }
          },
          required: ['repoPath', 'interviewState', 'codebaseFacts']
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
      case 'ply_validate_onboarding': {
        const repoPath = String(args?.repoPath);
        const interviewState = args?.interviewState as any;
        const codebaseFacts = args?.codebaseFacts as any;
        
        const report = runValidation(repoPath, interviewState, codebaseFacts);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2)
            }
          ]
        };
      }
      case 'ply_resolve_divergence': {
        const repoPath = String(args?.repoPath);
        const divergence = args?.divergence as any;
        const actionType = String(args?.actionType) as any;
        
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
      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
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
