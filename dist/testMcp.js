import { spawn } from 'child_process';
import * as path from 'path';
async function verifyMcpServer() {
    console.log('Testing MCP Server tool registration over stdio...');
    const serverPath = path.resolve('./dist/server.js');
    const child = spawn('node', [serverPath]);
    let stdoutData = '';
    child.stdout.on('data', (data) => {
        stdoutData += data.toString();
    });
    child.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) {
            console.log(`[Server Stderr]: ${msg}`);
        }
    });
    // Wait for server to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Construct a JSON-RPC request for ListTools
    const listToolsRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
    };
    // Send request followed by a newline (standard JSON-RPC framing for stdio)
    child.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    // Wait for the response
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('\n--- Received Response from MCP Server ---');
    try {
        // Parse the JSON-RPC response
        // The server output might contain logs, so find the JSON-RPC response part
        const lines = stdoutData.split('\n').filter(l => l.trim().startsWith('{'));
        if (lines.length > 0) {
            const response = JSON.parse(lines[0]);
            console.log('JSON-RPC Structure Validated ✔');
            console.log('Registered Tools:');
            response.result.tools.forEach((tool) => {
                console.log(`  - ${tool.name}: ${tool.description}`);
            });
        }
        else {
            console.log('Error: No JSON-RPC response found on stdout. Raw output:', stdoutData);
        }
    }
    catch (err) {
        console.error('Failed to parse server response:', err.message, stdoutData);
    }
    // Clean up
    child.kill();
}
verifyMcpServer().catch(console.error);
