import * as fs from 'fs/promises';
import * as path from 'path';

export type OnboardingStep = 
  | 'DOCUMENT_COLLECTION'
  | 'PRE_FLIGHT_SCAN'
  | 'INTERVIEW'
  | 'TRIAGE'
  | 'FINALIZATION'
  | 'COMPLETED';

export interface OnboardingState {
  step: OnboardingStep;
  ingestedDocuments: string[];
  interviewAnswers?: {
    domainRules?: string[];
    glossary?: Record<string, string>;
    slaMetrics?: string;
  };
  currentDivergenceIndex: number;
}

const DEFAULT_STATE: OnboardingState = {
  step: 'DOCUMENT_COLLECTION',
  ingestedDocuments: [],
  currentDivergenceIndex: 0
};

/**
 * Loads or initializes the onboarding state from the local repository directory.
 */
export async function loadOnboardingState(repoPath: string): Promise<OnboardingState> {
  const stateFilePath = path.join(repoPath, '.knowledge', 'onboarding_state.json');
  try {
    const data = await fs.readFile(stateFilePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Saves the onboarding state back to the local repository directory.
 */
export async function saveOnboardingState(repoPath: string, state: OnboardingState): Promise<void> {
  const knowledgeDir = path.join(repoPath, '.knowledge');
  await fs.mkdir(knowledgeDir, { recursive: true });
  
  const stateFilePath = path.join(knowledgeDir, 'onboarding_state.json');
  await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Reset onboarding state.
 */
export async function resetOnboardingState(repoPath: string): Promise<void> {
  const stateFilePath = path.join(repoPath, '.knowledge', 'onboarding_state.json');
  try {
    await fs.unlink(stateFilePath);
  } catch {
    // Ignore if file doesn't exist
  }
}
