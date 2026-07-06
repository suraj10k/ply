import { DivergenceItem, DivergenceActionType } from './types.js';
/**
 * Applies a resolution to a specific divergence item.
 * Mutates repository documentation or creates backlog files based on selection.
 */
export declare function applyResolution(repoPath: string, divergence: DivergenceItem, actionType: DivergenceActionType): Promise<{
    success: boolean;
    filePath?: string;
    message: string;
}>;
