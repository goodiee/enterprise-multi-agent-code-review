
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

import { refactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Analyzes code for refactoring opportunities, including ' +
    'simplification, modernization, naming improvements, ' +
    'and better software design patterns.',

  prompt: refactoringSuggesterPrompt,

  tools: [
    'Read',
    'Glob',
    'Grep',
    'Skill'
  ],

  model: 'inherit'
};
