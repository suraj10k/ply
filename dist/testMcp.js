import { spawn } from 'child_process';
import * as path from 'path';
async function verifyMcpServer() {
    console.log('Testing MCP Server tool, prompt, and resource registration over stdio...');
    const serverPath = path.resolve('./dist/server.js');
    const child = spawn('node', [serverPath]);
    let stdoutBuffer = '';
    child.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
    });
    child.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) {
            console.log(`[Server Stderr]: ${msg}`);
        }
    });
    // Wait for server to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Helper to send JSON-RPC and wait for a single JSON response
    async function queryServer(method, params = {}) {
        const request = {
            jsonrpc: '2.0',
            id: Math.floor(Math.random() * 1000),
            method,
            params
        };
        stdoutBuffer = ''; // Clear buffer before request
        child.stdin.write(JSON.stringify(request) + '\n');
        // Wait for the stdout response line starting with '{'
        await new Promise((resolve) => setTimeout(resolve, 800));
        const lines = stdoutBuffer.split('\n').filter(l => l.trim().startsWith('{'));
        if (lines.length > 0) {
            return JSON.parse(lines[0]);
        }
        throw new Error(`No response received for method ${method}`);
    }
    try {
        // 1. Verify Tools
        const toolsRes = await queryServer('tools/list');
        console.log('\n✔ Tools List Validated:');
        toolsRes.result.tools.forEach((tool) => {
            console.log(`  - [Tool] ${tool.name}: ${tool.description}`);
        });
        // 2. Verify Prompts
        const promptsRes = await queryServer('prompts/list');
        console.log('\n✔ Prompts List Validated:');
        promptsRes.result.prompts.forEach((prompt) => {
            console.log(`  - [Prompt] ${prompt.name}: ${prompt.description}`);
        });
        // 3. Verify Resources
        const resourcesRes = await queryServer('resources/list');
        console.log('\n✔ Resources List Validated:');
        resourcesRes.result.resources.forEach((resource) => {
            console.log(`  - [Resource] ${resource.name} (${resource.uri})`);
        });
        console.log('\nMCP Server verification completed successfully!');
    }
    catch (err) {
        console.error('MCP verification failed:', err.message);
    }
    // Clean up
    child.kill();
}
verifyMcpServer().catch(console.error);
