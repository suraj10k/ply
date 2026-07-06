export interface ValidationResult {
    valid: boolean;
    missingFiles: string[];
    errors: string[];
}
export interface CommitResult {
    success: boolean;
    commitHash?: string;
    message: string;
}
/**
 * Validates that all 6 mandatory OKF files exist in /.knowledge/ and contain content.
 */
export declare function validateSchemaBounds(repoPath: string): Promise<ValidationResult>;
/**
 * Stages the /.knowledge/ directory and commits it locally.
 */
export declare function commitKnowledgeBundle(repoPath: string, version?: string): Promise<CommitResult>;
