import * as fs from 'fs/promises';
import * as path from 'path';
const DEFAULT_STATE = {
    step: 'PRE_FLIGHT_SCAN',
    ingestedDocuments: [],
    currentDivergenceIndex: 0
};
/**
 * Loads or initializes the onboarding state from the local repository directory.
 */
export async function loadOnboardingState(repoPath) {
    const stateFilePath = path.join(repoPath, '.knowledge', 'onboarding_state.json');
    try {
        const data = await fs.readFile(stateFilePath, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return { ...DEFAULT_STATE };
    }
}
/**
 * Saves the onboarding state back to the local repository directory.
 */
export async function saveOnboardingState(repoPath, state) {
    const knowledgeDir = path.join(repoPath, '.knowledge');
    await fs.mkdir(knowledgeDir, { recursive: true });
    const stateFilePath = path.join(knowledgeDir, 'onboarding_state.json');
    await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
}
/**
 * Reset onboarding state.
 */
export async function resetOnboardingState(repoPath) {
    const stateFilePath = path.join(repoPath, '.knowledge', 'onboarding_state.json');
    try {
        await fs.unlink(stateFilePath);
    }
    catch {
        // Ignore if file doesn't exist
    }
}
