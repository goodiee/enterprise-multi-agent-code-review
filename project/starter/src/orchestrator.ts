
import { query } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ReviewReportSchema,
  ReviewReportJSONSchema
} from './types/report-types.js';

import type { ReviewReport } from './types/report-types.js';

import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents/index.js';

import { orchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { globalRateLimiter } from './utils/index.js';

export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
}

/**
 * Enterprise Multi-Agent Code Review Orchestrator
 *
 * Coordinates:
 * 1. Code Quality Analyzer
 * 2. Test Coverage Analyzer
 * 3. Refactoring Suggester
 */
export class CodeReviewOrchestrator {
  private readonly options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    // 1. Validate input
    if (!owner.trim() || !repo.trim()) {
      throw new Error(
        'Repository owner and name are required.'
      );
    }

    if (
      !Number.isSafeInteger(prNumber) ||
      prNumber <= 0
    ) {
      throw new Error(
        'Pull request number must be a positive integer.'
      );
    }

    // 2. Configure model
    const model =
      this.options.model ??
      process.env.ANTHROPIC_MODEL ??
      'claude-sonnet-4-5-20250929';

    const maxTurns = this.options.maxTurns ?? 100;

    // 3. Resolve and validate working directory
    const workingDirectory = resolve(
      process.env.PROJECT_ROOT || process.cwd()
    );

    if (!existsSync(workingDirectory)) {
      throw new Error(
        `Working directory does not exist: ${workingDirectory}`
      );
    }

    console.log('Working directory:', workingDirectory);
    console.log('Node executable:', process.execPath);

    // 4. Validate GitHub configuration
    if (!process.env.GITHUB_TOKEN?.trim()) {
      throw new Error(
        'GITHUB_TOKEN is missing. Configure it in your .env file.'
      );
    }

    // 5. Build review prompt
    const prompt = `
Review GitHub pull request ${owner}/${repo}#${prNumber}.

MANDATORY WORKFLOW:

1. Use the GitHub MCP server to retrieve:
   - Pull request metadata
   - Changed files
   - Diffs
   - Relevant source code

2. Verify that the pull request data was retrieved.

3. For EVERY relevant changed source file,
   invoke ALL THREE specialized agents:

   - code-quality-analyzer
   - test-coverage-analyzer
   - refactoring-suggester

4. Each agent must analyze the actual file content
   and return findings supported by evidence.

5. Aggregate the agent outputs into a structured
   review report matching ReviewReportSchema.

6. Calculate summary statistics from the findings.

7. Do not invent code, issues, tests, or results.

8. If GitHub access fails, do not fabricate
   a successful review.

9. If the pull request has no reviewable source
   files, explain that limitation.

10. Return the complete structured report.
`;

    let report: ReviewReport | undefined;

    const invokedAgents = new Set<string>();

    const requiredAgents = [
      'code-quality-analyzer',
      'test-coverage-analyzer',
      'refactoring-suggester'
    ];

    let githubConnected = false;
    let githubToolUsed = false;

    console.log(
      `Starting multi-agent review: ${owner}/${repo}#${prNumber}`
    );

    // 6. Acquire a rate-limited execution slot.
    // This reservation covers the entire review operation.
    console.log('[RATE LIMITER] Waiting for available capacity...');

    await globalRateLimiter.acquire(1000);

    console.log('[RATE LIMITER] Execution slot acquired.');

    try {
      // 7. Execute Claude Agent SDK
      try {
        for await (const message of query({
          prompt,
          options: {
            model,
            maxTurns,

            cwd: workingDirectory,

            systemPrompt: orchestratorPrompt,

            permissionMode: 'default',

            // Use the installed Node.js executable on Windows.
            executable: 'node',

            spawnClaudeCodeProcess: (options) => {
              const command =
                options.command === 'node' ||
                options.command === 'node.exe'
                  ? process.execPath
                  : options.command;

              return spawn(command, options.args, {
                cwd: options.cwd,
                env: options.env,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
              });
            },

            allowedTools: [
              'Task',
              'Agent',
              'Read',
              'Glob',
              'Grep',
              'Skill',
              'mcp__github__*',
              'mcp__eslint__*'
            ],

            agents: {
              'code-quality-analyzer':
                codeQualityAnalyzer,

              'test-coverage-analyzer':
                testCoverageAnalyzer,

              'refactoring-suggester':
                refactoringSuggester
            },

            mcpServers: mcpServersConfig,

            outputFormat: {
              type: 'json_schema',
              schema: ReviewReportJSONSchema
            }
          }
        })) {
          // 8. Inspect SDK initialization
          if (
            message.type === 'system' &&
            message.subtype === 'init'
          ) {
            console.log('\n=== CLAUDE SDK INITIALIZED ===');

            console.log(
              'Available MCP servers:',
              JSON.stringify(message.mcp_servers, null, 2)
            );

            console.log(
              'Available tools:',
              JSON.stringify(message.tools, null, 2)
            );

            const servers = message.mcp_servers ?? [];

            githubConnected = servers.some(
              (server) =>
                server.name === 'github' &&
                server.status === 'connected'
            );

            if (!githubConnected) {
              console.warn(
                '[WARNING] GitHub MCP is not connected.'
              );
            } else {
              console.log(
                '[OK] GitHub MCP connected.'
              );
            }
          }

          // 9. Log tool usage and agent delegation
          if (message.type === 'assistant') {
            for (const block of message.message.content) {
              if (block.type !== 'tool_use') {
                continue;
              }

              console.log(`[TOOL] ${block.name}`);

              if (block.name.startsWith('mcp__github__')) {
                githubToolUsed = true;
              }

              if (
                block.name === 'Task' ||
                block.name === 'Agent'
              ) {
                const input = block.input;

                if (
                  typeof input === 'object' &&
                  input !== null &&
                  'subagent_type' in input &&
                  typeof input.subagent_type === 'string'
                ) {
                  const agentName = input.subagent_type;

                  invokedAgents.add(agentName);

                  console.log(
                    `[AGENT INVOKED] ${agentName}`
                  );
                }
              }
            }
          }

          // 10. Process final result
          if (message.type === 'result') {
            if (message.subtype !== 'success') {
              throw new Error(
                `Code review failed: ${message.subtype}`
              );
            }

            const parsed = ReviewReportSchema.safeParse(
              message.structured_output
            );

            if (!parsed.success) {
              throw new Error(
                'Invalid review report: ' +
                parsed.error.message
              );
            }

            report = parsed.data;
          }
        }
      } catch (error) {
        throw new Error(
          'Orchestrator execution failed: ' +
          (
            error instanceof Error
              ? error.message
              : String(error)
          )
        );
      }

      // 11. Ensure a report exists
      if (!report) {
        throw new Error(
          'The orchestrator did not generate a review report.'
        );
      }

      // 12. Reject empty reviews
      if (report.fileReviews.length === 0) {
        throw new Error(
          'Review produced zero file analyses. ' +
          'Check GitHub MCP connectivity, repository access, ' +
          'and whether the pull request contains source files.'
        );
      }

      // 13. Verify GitHub MCP access
      if (!githubConnected) {
        throw new Error(
          'GitHub MCP did not report a connected status.'
        );
      }

      if (!githubToolUsed) {
        throw new Error(
          'The orchestrator did not invoke any GitHub MCP tools.'
        );
      }

      // 14. Verify all required agents were invoked
      const missingAgents = requiredAgents.filter(
        (agent) => !invokedAgents.has(agent)
      );

      if (missingAgents.length > 0) {
        throw new Error(
          'Required agents were not invoked: ' +
          missingAgents.join(', ')
        );
      }

      // 15. Verify summary consistency
      if (
        report.summary.totalFiles !==
        report.fileReviews.length
      ) {
        throw new Error(
          'Report summary totalFiles does not match ' +
          'the number of file reviews.'
        );
      }

      // 16. Print execution summary
      console.log('\n=== AGENT EXECUTION SUMMARY ===');

      console.log(
        'GitHub MCP connected:',
        githubConnected
      );

      console.log(
        'GitHub MCP tools used:',
        githubToolUsed
      );

      console.log(
        'Agents invoked:',
        [...invokedAgents].join(', ')
      );

      console.log(
        'Files reviewed:',
        report.fileReviews.length
      );

      console.log(
        '\nMulti-agent code review completed successfully.'
      );

      return report;
    } finally {
      // Always release the slot, including on failure.
      globalRateLimiter.release();

      console.log('[RATE LIMITER] Execution slot released.');
    }
  }
}
