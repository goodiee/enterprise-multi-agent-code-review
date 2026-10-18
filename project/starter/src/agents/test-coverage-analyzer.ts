
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

import { testCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code and associated tests to identify ' +
    'untested functions, branches, classes, and edge cases.',

  prompt: testCoverageAnalyzerPrompt,

  tools: [
    'Read',
    'Glob',
    'Grep',
    'Skill'
  ],

  model: 'inherit'
};
