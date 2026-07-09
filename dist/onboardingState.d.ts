export type OnboardingStep = 'DOCUMENT_COLLECTION' | 'PRE_FLIGHT_SCAN' | 'INTERVIEW' | 'TRIAGE' | 'FINALIZATION' | 'COMPLETED';
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
/**
 * Loads or initializes the onboarding state from the local repository directory.
 */
export declare function loadOnboardingState(repoPath: string): Promise<OnboardingState>;
/**
 * Saves the onboarding state back to the local repository directory.
 */
export declare function saveOnboardingState(repoPath: string, state: OnboardingState): Promise<void>;
/**
 * Reset onboarding state.
 */
export declare function resetOnboardingState(repoPath: string): Promise<void>;
