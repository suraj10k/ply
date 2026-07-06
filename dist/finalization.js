import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const MANDATORY_SPECS = [
    'Domain.md',
    'APIs.md',
    'Architecture.md',
    'Data.md',
    'References.md',
    'Operations.md'
];
/**
 * Validates that all 6 mandatory OKF files exist in /.knowledge/ and contain content.
 */
export async function validateSchemaBounds(repoPath) {
    const knowledgePath = path.join(repoPath, '.knowledge');
    const missingFiles = [];
    const errors = [];
    try {
        const stats = await fs.stat(knowledgePath);
        if (!stats.isDirectory()) {
            return { valid: false, missingFiles: MANDATORY_SPECS, errors: ['/.knowledge/ is not a directory.'] };
        }
    }
    catch (err) {
        return { valid: false, missingFiles: MANDATORY_SPECS, errors: ['/.knowledge/ directory does not exist.'] };
    }
    for (const file of MANDATORY_SPECS) {
        const filePath = path.join(knowledgePath, file);
        try {
            const fileStats = await fs.stat(filePath);
            if (fileStats.size === 0) {
                errors.push(`${file} exists but is empty.`);
            }
        }
        catch {
            missingFiles.push(file);
        }
    }
    if (missingFiles.length > 0) {
        errors.push(`Missing mandatory files: ${missingFiles.join(', ')}`);
    }
    return {
        valid: errors.length === 0,
        missingFiles,
        errors
    };
}
/**
 * Stages the /.knowledge/ directory and commits it locally.
 */
export async function commitKnowledgeBundle(repoPath, version = '0.1.0') {
    const knowledgePath = path.join(repoPath, '.knowledge');
    try {
        // 1. Verify if git is initialized in the repository
        try {
            await execAsync('git status', { cwd: repoPath });
        }
        catch {
            // Initialize git if it doesn't exist (for demo/mock purposes)
            await execAsync('git init', { cwd: repoPath });
            // Configure dummy user for local environment if not set
            try {
                await execAsync('git config user.name "Ply Orchestrator"', { cwd: repoPath });
                await execAsync('git config user.email "ply@okf.internal"', { cwd: repoPath });
            }
            catch {
                // Ignore config errors if already set globally
            }
        }
        // 2. Stage the .knowledge directory
        await execAsync(`git add "${knowledgePath}"`, { cwd: repoPath });
        // 3. Check if there are changes staged for commit
        const { stdout: diffOutput } = await execAsync('git diff --cached --name-only', { cwd: repoPath });
        if (diffOutput.trim().length === 0) {
            return {
                success: true,
                message: 'No changes to commit in .knowledge/. Files are already up-to-date.'
            };
        }
        // 4. Create the commit
        const commitMsg = `docs(ply): commit generated OKF knowledge bundle [v${version}]`;
        await execAsync(`git commit -m "${commitMsg}"`, { cwd: repoPath });
        // 5. Get the commit hash
        const { stdout: hashOutput } = await execAsync('git rev-parse --short HEAD', { cwd: repoPath });
        return {
            success: true,
            commitHash: hashOutput.trim(),
            message: `Committed OKF knowledge bundle [v${version}] successfully.`
        };
    }
    catch (err) {
        return {
            success: false,
            message: `Git operation failed: ${err.message}`
        };
    }
}
