import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { scanCodebase, readCandidateFile, ingestReferenceDocument } from './scanners/projectScanner.js';
import { runValidation } from './engine.js';
import { applyResolution } from './resolution.js';
import { validateSchemaBounds, commitKnowledgeBundle } from './finalization.js';
import { AGENT_ONBOARDING_PROMPT, OKF_SCHEMAS, generateValidationChecklist } from './guidelines.js';
import { loadOnboardingState, saveOnboardingState, resetOnboardingState } from './onboardingState.js';

const server = new Server(
  {
    name: 'ply-mcp-server',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {}
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
      },
      {
        name: 'ply_get_onboarding_status',
        description: 'Check the current step, instructions, and checklist prompts for the microservice onboarding pipeline.',
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
        name: 'ply_submit_interview_answers',
        description: 'Submit gathered human interview answers to advance the onboarding state to validation/triage.',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: {
              type: 'string',
              description: 'Absolute path to the microservice repository.'
            },
            answers: {
              type: 'object',
              description: 'The answers object containing domain rules, glossary, and SLAs.'
            }
          },
          required: ['repoPath', 'answers']
        }
      },
      {
        name: 'ply_advance_onboarding_step',
        description: 'Advance the onboarding state machine to the next specified step.',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: {
              type: 'string',
              description: 'Absolute path to the microservice repository.'
            },
            nextStep: {
              type: 'string',
              enum: ['DOCUMENT_COLLECTION', 'PRE_FLIGHT_SCAN', 'INTERVIEW', 'TRIAGE', 'FINALIZATION', 'COMPLETED'],
              description: 'The step to advance to.'
            }
          },
          required: ['repoPath', 'nextStep']
        }
      },
      {
        name: 'ply_reset_onboarding',
        description: 'Reset the onboarding state machine to the beginning.',
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
        const codebaseFacts = args?.codebaseFacts as any;
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
      case 'ply_ingest_reference': {
        const repoPath = String(args?.repoPath);
        const sourceType = String(args?.sourceType) as 'github' | 'file';
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
      case 'ply_get_onboarding_status': {
        const repoPath = String(args?.repoPath);
        const state = await loadOnboardingState(repoPath);
        let instructions = '';
        let targetPrompt = '';

        if (state.step === 'DOCUMENT_COLLECTION') {
          instructions = 'Prompt the user in chat: "Do you have any existing documentation (local Markdown files or GitHub repository URLs) you would like to share to seed the knowledge base?". Use the ply_ingest_reference tool to process any paths they share. Once the user states they have no more documents, call ply_advance_onboarding_step with nextStep="PRE_FLIGHT_SCAN".';
        } else if (state.step === 'PRE_FLIGHT_SCAN') {
          instructions = 'Call ply_scan_codebase to inspect repository framework and dependencies, and read relevant routing or data files using ply_read_file. Once done, call ply_advance_onboarding_step with nextStep="INTERVIEW".';
        } else if (state.step === 'INTERVIEW') {
          instructions = 'Analyze the codebase scan and files. Formulate and ask the user exactly 3 specific questions to collect business glossary terms, core domain rules, and operations SLA metrics. Wait for the user to answer in chat, then call ply_submit_interview_answers with their answers.';
          targetPrompt = 'Collect domain rules, business glossary mappings, and metrics prefixes.';
        } else if (state.step === 'TRIAGE') {
          instructions = 'Generate the stack-specific validation checklist using ply_generate_validation_checklist. Compare the interview state against the codebase facts to find discrepancies. Present the conflicts one-by-one to the user in chat and let them choose the resolution. Invoke ply_resolve_divergence for each resolved conflict. Once all conflicts are triaged, call ply_advance_onboarding_step with nextStep="FINALIZATION".';
        } else if (state.step === 'FINALIZATION') {
          instructions = 'Call ply_finalize_onboarding to run OKF schema checks, stage files, and commit the knowledge bundle locally to git.';
        } else {
          instructions = 'Onboarding complete! Report the final status to the user.';
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                step: state.step,
                instructions,
                targetPrompt,
                ingestedDocumentsCount: state.ingestedDocuments.length,
                interviewAnswersExist: !!state.interviewAnswers
              }, null, 2)
            }
          ]
        };
      }
      case 'ply_submit_interview_answers': {
        const repoPath = String(args?.repoPath);
        const answers = args?.answers as any;
        const state = await loadOnboardingState(repoPath);
        state.interviewAnswers = answers;
        state.step = 'TRIAGE';
        await saveOnboardingState(repoPath, state);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Interview answers submitted. Transitioned to TRIAGE step.', nextStep: 'TRIAGE' }, null, 2)
            }
          ]
        };
      }
      case 'ply_advance_onboarding_step': {
        const repoPath = String(args?.repoPath);
        const nextStep = String(args?.nextStep) as any;
        const state = await loadOnboardingState(repoPath);
        state.step = nextStep;
        await saveOnboardingState(repoPath, state);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Advanced onboarding step to ${nextStep}.`, nextStep }, null, 2)
            }
          ]
        };
      }
      case 'ply_reset_onboarding': {
        const repoPath = String(args?.repoPath);
        await resetOnboardingState(repoPath);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Onboarding state reset successfully.' }, null, 2)
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
