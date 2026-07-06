import { CodebaseFacts } from '../types.js';
export interface CandidateFile {
    filePath: string;
    category: 'apis' | 'data' | 'architecture' | 'operations' | 'general';
    sizeBytes: number;
}
export interface ScanResult {
    facts: CodebaseFacts;
    candidateFiles: CandidateFile[];
}
/**
 * Core function to scan a codebase and return deterministic facts + candidate files
 */
export declare function scanCodebase(repoPath: string): Promise<ScanResult>;
/**
 * Helper tool to read file contents for semantic verification
 */
export declare function readCandidateFile(repoPath: string, relativePath: string): Promise<string>;
