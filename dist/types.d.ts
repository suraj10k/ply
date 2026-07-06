export type DivergenceSeverity = 'high' | 'medium' | 'low';
export type DivergenceCategory = 'domain' | 'apis' | 'architecture' | 'data' | 'references' | 'operations';
export type DivergenceActionType = 'code_is_right' | 'human_is_right' | 'backlog_ticket';
export interface DivergenceAction {
    type: DivergenceActionType;
    description: string;
    resolutionPlan?: {
        fileToModify?: string;
        description: string;
    };
}
export interface DivergenceItem {
    id: string;
    category: DivergenceCategory;
    title: string;
    humanClaim: string;
    codeEvidence: string;
    severity: DivergenceSeverity;
    status: 'divergent' | 'aligned' | 'resolved';
    suggestedActions: DivergenceAction[];
}
export interface OnboardingInterviewState {
    domain: {
        businessRules: string[];
        terminologyGlossary: Record<string, string>;
    };
    apis: {
        endpoints: Array<{
            path: string;
            method: string;
            description: string;
        }>;
        externalIntegrations: string[];
    };
    architecture: {
        primaryFramework: string;
        frameworkVersion: string;
        databaseType: string;
    };
    data: {
        tables: Array<{
            name: string;
            primaryKey: string;
            columns: string[];
        }>;
    };
    references: {
        externalDocLinks: string[];
    };
    operations: {
        loggingFormat: string;
        metricPrefix: string;
    };
}
export interface CodebaseFacts {
    dependencies: Record<string, string>;
    detectedDBDrivers: string[];
    detectedRoutes: Array<{
        path: string;
        method: string;
    }>;
    framework: string;
    configFiles: string[];
}
export interface DivergenceReport {
    timestamp: string;
    repositoryPath: string;
    divergences: DivergenceItem[];
    summary: {
        totalDivergences: number;
        highSeverity: number;
        mediumSeverity: number;
        lowSeverity: number;
    };
}
