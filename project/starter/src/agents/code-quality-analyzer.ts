
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

import { codeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Reviews source code for security vulnerabilities, performance ' +
    'issues, maintainability concerns, bugs, and coding best practices.',

  prompt: codeQualityAnalyzerPrompt,

  tools: [
    'Read',
    'Glob',
    'Grep',
    'Skill'
  ],

  model: 'inherit'
};
