export function runValidation(repositoryPath, interview, facts) {
    const divergences = [];
    let divergenceCounter = 1;
    function createId() {
        return `DIV-${String(divergenceCounter++).padStart(3, '0')}`;
    }
    // 1. Architecture Check (Primary Framework Mismatch)
    const interviewFramework = interview.architecture.primaryFramework.toLowerCase();
    const codebaseFramework = facts.framework.toLowerCase();
    if (interviewFramework !== codebaseFramework) {
        divergences.push({
            id: createId(),
            category: 'architecture',
            title: 'Primary Web Framework Mismatch',
            humanClaim: `Interview state indicates primary framework is "${interview.architecture.primaryFramework}" (v${interview.architecture.frameworkVersion}).`,
            codeEvidence: `Codebase relies on dependencies matching "${facts.framework}" (found ${JSON.stringify(facts.dependencies)}).`,
            severity: 'high',
            status: 'divergent',
            suggestedActions: [
                {
                    type: 'code_is_right',
                    description: `Update the Architecture knowledge spec to set primary framework to "${facts.framework}".`,
                    resolutionPlan: {
                        fileToModify: '.knowledge/Architecture.md',
                        description: `Change primary framework to ${facts.framework}.`
                    }
                },
                {
                    type: 'human_is_right',
                    description: `Flag code architecture for migration to "${interview.architecture.primaryFramework}".`,
                    resolutionPlan: {
                        description: `Create ticket to migrate framework from ${facts.framework} to ${interview.architecture.primaryFramework}.`
                    }
                },
                {
                    type: 'backlog_ticket',
                    description: 'Defer resolution and create an architectural alignment backlog issue.'
                }
            ]
        });
    }
    // 2. Database Driver Mismatch
    const interviewDB = interview.architecture.databaseType.toLowerCase();
    const usesPostgresDrivers = facts.detectedDBDrivers.some(d => d.includes('pg') || d.includes('postgres') || d.includes('sequelize'));
    const usesMongoDrivers = facts.detectedDBDrivers.some(d => d.includes('mongo') || d.includes('mongoose'));
    if (interviewDB.includes('postgres') && !usesPostgresDrivers && usesMongoDrivers) {
        divergences.push({
            id: createId(),
            category: 'data',
            title: 'Database Engine Mismatch',
            humanClaim: `Interview claims service stores data in a "${interview.architecture.databaseType}" database.`,
            codeEvidence: `No PostgreSQL driver packages found. Found MongoDB drivers: ${JSON.stringify(facts.detectedDBDrivers)}. Config file found: ${JSON.stringify(facts.configFiles)}.`,
            severity: 'high',
            status: 'divergent',
            suggestedActions: [
                {
                    type: 'code_is_right',
                    description: 'Update the Data knowledge spec to reflect MongoDB instead of PostgreSQL.',
                    resolutionPlan: {
                        fileToModify: '.knowledge/Data.md',
                        description: 'Change database type to MongoDB and update table specs to collection schemas.'
                    }
                },
                {
                    type: 'human_is_right',
                    description: 'Mark code as requiring database migration from MongoDB to PostgreSQL.',
                    resolutionPlan: {
                        description: 'Refactor database connectivity module to use PostgreSQL pg/sequelize drivers.'
                    }
                },
                {
                    type: 'backlog_ticket',
                    description: 'Log backlog item: Reconcile MongoDB code usage with target PostgreSQL DB architecture.'
                }
            ]
        });
    }
    // 3. API Endpoints Routes Divergence
    const missingRoutes = [];
    interview.apis.endpoints.forEach(interviewEP => {
        // Check if there is an exact or prefix match in the codebase routes
        const hasMatch = facts.detectedRoutes.some(route => {
            // Normalize comparison (e.g. check if code route `/users` matches `/api/v1/users`)
            const codePath = route.path.replace(/^\/+/, '');
            const interviewPath = interviewEP.path.replace(/^\/+/, '');
            return interviewPath.endsWith(codePath) && route.method === interviewEP.method;
        });
        if (!hasMatch) {
            missingRoutes.push(`${interviewEP.method} ${interviewEP.path}`);
        }
    });
    // Check prefix mismatch (e.g., code routes miss '/api/v1' prefix from interview endpoints)
    const interviewPrefixes = interview.apis.endpoints.map(ep => {
        const parts = ep.path.split('/');
        return parts.slice(0, -1).join('/'); // Get prefix like /api/v1
    }).filter((v, i, self) => self.indexOf(v) === i && v.length > 0);
    const codePrefixesMatch = interviewPrefixes.length > 0 && facts.detectedRoutes.every(r => !interviewPrefixes.some(p => r.path.startsWith(p)));
    if (codePrefixesMatch) {
        divergences.push({
            id: createId(),
            category: 'apis',
            title: 'API Path Prefix Divergence',
            humanClaim: `Interview lists endpoints with prefix(es): ${interviewPrefixes.join(', ')}.`,
            codeEvidence: `Code routes are registered without these prefixes. Detected endpoints: ${JSON.stringify(facts.detectedRoutes.map(r => `${r.method} ${r.path}`))}.`,
            severity: 'medium',
            status: 'divergent',
            suggestedActions: [
                {
                    type: 'code_is_right',
                    description: 'Update the APIs knowledge spec to remove path prefixes, matching direct router registration.',
                    resolutionPlan: {
                        fileToModify: '.knowledge/APIs.md',
                        description: 'Align route endpoints to match raw code routes without prefix.'
                    }
                },
                {
                    type: 'human_is_right',
                    description: 'Update Router config in code to apply the API version prefix (e.g., /api/v1).',
                    resolutionPlan: {
                        description: 'Apply API version router middleware prefix in Koa application.'
                    }
                }
            ]
        });
    }
    else if (missingRoutes.length > 0) {
        divergences.push({
            id: createId(),
            category: 'apis',
            title: 'Missing API Route Registrations',
            humanClaim: `Interview lists endpoints that code is expected to serve: ${missingRoutes.join(', ')}.`,
            codeEvidence: `No matching endpoints registered in codebase router definitions.`,
            severity: 'high',
            status: 'divergent',
            suggestedActions: [
                {
                    type: 'code_is_right',
                    description: 'Remove endpoints from APIs knowledge spec since they do not exist in the code.',
                    resolutionPlan: {
                        fileToModify: '.knowledge/APIs.md',
                        description: 'Delete missing endpoints from API registry.'
                    }
                },
                {
                    type: 'human_is_right',
                    description: 'Code needs implementation. Flag missing endpoints for immediate implementation.',
                    resolutionPlan: {
                        description: `Implement missing controller logic and routes for: ${missingRoutes.join(', ')}.`
                    }
                }
            ]
        });
    }
    // 4. Logging Operations Schema Check
    if (interview.operations.loggingFormat === 'JSON' && !facts.dependencies['winston'] && !facts.dependencies['pino']) {
        divergences.push({
            id: createId(),
            category: 'operations',
            title: 'Structured Logging Engine Missing',
            humanClaim: 'Interview states operations require structured JSON output for log aggregators.',
            codeEvidence: `No enterprise JSON loggers (like winston or pino) found in package dependencies. Found dependencies: ${JSON.stringify(Object.keys(facts.dependencies))}.`,
            severity: 'low',
            status: 'divergent',
            suggestedActions: [
                {
                    type: 'code_is_right',
                    description: 'Update Operations knowledge spec to reflect unstructured/console logging.',
                    resolutionPlan: {
                        fileToModify: '.knowledge/Operations.md',
                        description: 'Downgrade logging specification to plain-text/console outputs.'
                    }
                },
                {
                    type: 'human_is_right',
                    description: 'Install structured logger (e.g., winston or pino) and update standard logger initialization.',
                    resolutionPlan: {
                        description: 'Run npm install winston and configure JSON transports.'
                    }
                }
            ]
        });
    }
    // Calculate Summary metrics
    const totalDivergences = divergences.length;
    const highSeverity = divergences.filter(d => d.severity === 'high').length;
    const mediumSeverity = divergences.filter(d => d.severity === 'medium').length;
    const lowSeverity = divergences.filter(d => d.severity === 'low').length;
    return {
        timestamp: new Date().toISOString(),
        repositoryPath,
        divergences,
        summary: {
            totalDivergences,
            highSeverity,
            mediumSeverity,
            lowSeverity
        }
    };
}
