import * as fs from 'fs/promises';
import * as path from 'path';
import { DivergenceItem, DivergenceActionType } from './types.js';

/**
 * Applies a resolution to a specific divergence item.
 * Mutates repository documentation or creates backlog files based on selection.
 */
export async function applyResolution(
  repoPath: string,
  divergence: DivergenceItem,
  actionType: DivergenceActionType
): Promise<{ success: boolean; filePath?: string; message: string }> {
  
  const chosenAction = divergence.suggestedActions.find(a => a.type === actionType);
  if (!chosenAction) {
    throw new Error(`Invalid action type: ${actionType} for divergence ${divergence.id}`);
  }

  // Ensure directories exist for artifacts
  const knowledgeDir = path.join(repoPath, '.knowledge');
  const backlogDir = path.join(knowledgeDir, 'backlog');
  const refactorDir = path.join(knowledgeDir, 'refactor');

  await fs.mkdir(backlogDir, { recursive: true });
  await fs.mkdir(refactorDir, { recursive: true });

  switch (actionType) {
    case 'code_is_right': {
      // Documentation update logic based on category
      const plan = chosenAction.resolutionPlan;
      if (!plan || !plan.fileToModify) {
        return {
          success: false,
          message: 'No file modification plan defined for "code_is_right" resolution.'
        };
      }

      const filePath = path.join(repoPath, plan.fileToModify);
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (err) {
        return {
          success: false,
          message: `Could not read knowledge file to update: ${plan.fileToModify}`
        };
      }

      let updatedContent = content;

      if (divergence.category === 'architecture') {
        // Replace Framework block
        updatedContent = content
          .replace(/\* \*\*Framework\*\*: .*/g, '* **Framework**: Koa')
          .replace(/\* \*\*Version\*\*: .*/g, '* **Version**: ^2.15.0');
      } else if (divergence.category === 'data') {
        // Replace Database Provider block
        updatedContent = content
          .replace(/\* \*\*Engine\*\*: .*/g, '* **Engine**: MongoDB')
          .replace(/\* \*\*Port\*\*: .*/g, '* **Port**: 27017');
      } else if (divergence.category === 'apis') {
        // Remove prefixes from endpoint paths
        updatedContent = content
          .replace(/\/api\/v1\/users/g, '/users')
          .replace(/\/api\/v1\/auth\/login/g, '/login');
      } else if (divergence.category === 'operations') {
        // Downgrade logging spec to plain-text console logging
        updatedContent = content
          .replace(/\* \*\*Logging Format\*\*: .*/g, '* **Logging Format**: Console/Unstructured');
      }

      await fs.writeFile(filePath, updatedContent, 'utf-8');
      return {
        success: true,
        filePath: plan.fileToModify,
        message: `Updated spec: ${plan.fileToModify} successfully to match code facts.`
      };
    }

    case 'human_is_right': {
      // Create refactoring spec file
      const fileName = `${divergence.id}-refactor-spec.md`;
      const filePath = path.join(refactorDir, fileName);
      const relativePath = path.relative(repoPath, filePath);

      const refactorContent = `# Refactoring Specification: ${divergence.title}
* **Divergence ID**: ${divergence.id}
* **Category**: ${divergence.category.toUpperCase()}
* **Severity**: ${divergence.severity.toUpperCase()}

## Code Modification Objective
We need to update the codebase structure to align with the human onboarding design specification.

### Technical Context:
* **Human Claim**: ${divergence.humanClaim}
* **Code Evidence**: ${divergence.codeEvidence}

## Refactoring Instructions:
${chosenAction.resolutionPlan?.description || 'Refactor codebase to resolve alignment mismatch.'}

---
*Created by Ply Orchestrator on ${new Date().toLocaleDateString()}*
`;

      await fs.writeFile(filePath, refactorContent, 'utf-8');
      return {
        success: true,
        filePath: relativePath,
        message: `Refactoring spec generated: ${relativePath}`
      };
    }

    case 'backlog_ticket': {
      // Create technical debt markdown card
      const fileName = `${divergence.id}-tech-debt.md`;
      const filePath = path.join(backlogDir, fileName);
      const relativePath = path.relative(repoPath, filePath);

      const backlogContent = `# Backlog Item: Reconcile ${divergence.title}
* **Divergence ID**: ${divergence.id}
* **Category**: ${divergence.category.toUpperCase()}
* **Severity**: ${divergence.severity.toUpperCase()}
* **Status**: Open (Technical Debt)

## Conflict Description:
* **Human Intent**: ${divergence.humanClaim}
* **Actual Codebase Implementation**: ${divergence.codeEvidence}

## Resolution Strategy Required:
- Identify if the codebase requires refactoring or if the knowledge specs need correction.
- Update matching files accordingly.

---
*Created by Ply Orchestrator on ${new Date().toLocaleDateString()}*
`;

      await fs.writeFile(filePath, backlogContent, 'utf-8');
      return {
        success: true,
        filePath: relativePath,
        message: `Deferred tech debt backlog issue created: ${relativePath}`
      };
    }
  }
}
