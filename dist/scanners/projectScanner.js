import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
// Folders we should always ignore during recursive scanning
const IGNORED_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    '.knowledge',
    'dist',
    'build',
    'coverage',
    '.next',
    '.output'
]);
// Categories of candidate files we look for
const CANDIDATE_PATTERNS = {
    apis: /(route|controller|api|endpoint|handler)/i,
    data: /(db|database|schema|model|connection|driver)/i,
    architecture: /(app|server|index|main|config|setup)/i,
    operations: /(log|logger|metric|monitor|opentelemetry)/i
};
/**
 * Recursively scans a directory for files, applying ignore rules.
 */
async function walkDirectory(dir, baseDir) {
    const files = [];
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    }
    catch (err) {
        return [];
    }
    for (const entry of entries) {
        const resPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, resPath);
        if (entry.isDirectory()) {
            if (IGNORED_DIRECTORIES.has(entry.name)) {
                continue;
            }
            files.push(...(await walkDirectory(resPath, baseDir)));
        }
        else if (entry.isFile()) {
            files.push(relPath);
        }
    }
    return files;
}
/**
 * Scan package.json for libraries to determine frameworks and databases
 */
async function extractDependencies(repoPath) {
    const packageJsonPath = path.join(repoPath, 'package.json');
    let dependencies = {};
    let devDependencies = {};
    try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        dependencies = pkg.dependencies || {};
        devDependencies = pkg.devDependencies || {};
    }
    catch (err) {
        // If package.json doesn't exist, we return empty dependencies
    }
    const allDeps = { ...dependencies, ...devDependencies };
    // Framework detection rules
    let framework = 'unknown';
    if (allDeps['express'])
        framework = 'Express';
    else if (allDeps['koa'])
        framework = 'Koa';
    else if (allDeps['fastify'])
        framework = 'Fastify';
    else if (allDeps['@nestjs/core'])
        framework = 'NestJS';
    else if (allDeps['next'])
        framework = 'Next.js';
    // DB driver detection rules
    const detectedDBDrivers = [];
    const dbKeywords = ['pg', 'postgres', 'mysql2', 'mongodb', 'mongoose', 'redis', 'sqlite3', 'sequelize', 'prisma'];
    for (const dep of Object.keys(allDeps)) {
        if (dbKeywords.some(kw => dep.includes(kw))) {
            detectedDBDrivers.push(dep);
        }
    }
    return {
        dependencies: allDeps,
        framework,
        detectedDBDrivers
    };
}
/**
 * Classify a file into a category based on its name and contents
 */
function classifyFile(relativeFilePath) {
    const fileName = path.basename(relativeFilePath);
    if (CANDIDATE_PATTERNS.apis.test(fileName))
        return 'apis';
    if (CANDIDATE_PATTERNS.data.test(fileName))
        return 'data';
    if (CANDIDATE_PATTERNS.architecture.test(fileName))
        return 'architecture';
    if (CANDIDATE_PATTERNS.operations.test(fileName))
        return 'operations';
    return 'general';
}
/**
 * Core function to scan a codebase and return deterministic facts + candidate files
 */
export async function scanCodebase(repoPath) {
    const depInfo = await extractDependencies(repoPath);
    const allFiles = await walkDirectory(repoPath, repoPath);
    const candidateFiles = [];
    const configFiles = [];
    for (const file of allFiles) {
        const ext = path.extname(file);
        // Focus on config, script, and markdown files
        const relevantExtensions = ['.json', '.js', '.ts', '.jsx', '.tsx', '.yaml', '.yml', '.env', '.ini'];
        if (!relevantExtensions.includes(ext)) {
            continue;
        }
        const fullPath = path.join(repoPath, file);
        let sizeBytes = 0;
        try {
            const stats = await fs.stat(fullPath);
            sizeBytes = stats.size;
        }
        catch {
            continue;
        }
        // Capture generic configuration files
        if (file.endsWith('config.js') || file.endsWith('config.ts') || file.endsWith('.json') || file.endsWith('.env')) {
            configFiles.push(file);
        }
        const category = classifyFile(file);
        // Ignore general utility json/configs unless they are specific config files
        if (category !== 'general' || file.includes('config')) {
            candidateFiles.push({
                filePath: file,
                category,
                sizeBytes
            });
        }
    }
    return {
        facts: {
            dependencies: depInfo.dependencies,
            detectedDBDrivers: depInfo.detectedDBDrivers,
            detectedRoutes: [], // Handled by LLM-assisted semantic check later
            framework: depInfo.framework,
            configFiles
        },
        candidateFiles
    };
}
/**
 * Helper tool to read file contents for semantic verification
 */
export async function readCandidateFile(repoPath, relativePath) {
    const fullPath = path.join(repoPath, relativePath);
    try {
        // Safety check: verify path is within repoPath
        const resolvedPath = path.resolve(fullPath);
        const resolvedRepo = path.resolve(repoPath);
        if (!resolvedPath.startsWith(resolvedRepo)) {
            throw new Error('Access denied: Path is outside repository root.');
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        return content;
    }
    catch (err) {
        return `Error reading file: ${err.message}`;
    }
}
/**
 * Ingests an existing document (GitHub Repository URL or local Markdown file)
 * to help fill the knowledge bundle.
 */
export async function ingestReferenceDocument(repoPath, sourceType, sourcePath) {
    if (sourceType === 'file') {
        try {
            const targetPath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(repoPath, sourcePath);
            const content = await fs.readFile(targetPath, 'utf-8');
            const snippet = content.length > 500 ? content.slice(0, 500) + '...' : content;
            return {
                success: true,
                title: path.basename(targetPath),
                contentSnippet: snippet
            };
        }
        catch (err) {
            return {
                success: false,
                title: sourcePath,
                contentSnippet: '',
                error: `Could not read file: ${err.message}`
            };
        }
    }
    else {
        // GitHub repository URL ingestion (clones repo to temp folder and extracts README)
        if (!sourcePath.toLowerCase().includes('github.com')) {
            return {
                success: false,
                title: sourcePath,
                contentSnippet: '',
                error: 'Not a valid GitHub URL.'
            };
        }
        // Parse GitHub repo name
        const parts = sourcePath.split('github.com/')[1]?.split('/') || [];
        const repoName = parts.slice(0, 2).join('/') || 'unknown-repo';
        const tempClonePath = path.join(repoPath, '.knowledge', 'temp_clone');
        try {
            // Clean up any existing temp clone
            await fs.rm(tempClonePath, { recursive: true, force: true });
            // Perform shallow clone (fast, clones only HEAD)
            await execAsync(`git clone --depth 1 "${sourcePath}" "${tempClonePath}"`);
            // Locate README.md in the cloned directory
            const readmePath = path.join(tempClonePath, 'README.md');
            let content = '';
            try {
                content = await fs.readFile(readmePath, 'utf-8');
            }
            catch {
                // If no README.md, list directory files
                const files = await fs.readdir(tempClonePath);
                content = `# GitHub Repository: ${repoName}\nNo README.md found. Files present:\n` + files.map(f => `- ${f}`).join('\n');
            }
            const snippet = content.length > 800 ? content.slice(0, 800) + '...' : content;
            // Clean up temp folder
            await fs.rm(tempClonePath, { recursive: true, force: true });
            return {
                success: true,
                title: `GitHub Repo: ${repoName}`,
                contentSnippet: snippet
            };
        }
        catch (err) {
            // Ensure temp folder is cleaned up even on failure
            await fs.rm(tempClonePath, { recursive: true, force: true }).catch(() => { });
            return {
                success: false,
                title: sourcePath,
                contentSnippet: '',
                error: `Could not clone and read repository: ${err.message}`
            };
        }
    }
}
