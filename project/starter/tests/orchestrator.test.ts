
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach
} from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock Claude SDK and rate limiter before importing the orchestrator.
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn()
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mocks.query
}));

vi.mock('../src/utils/index.js', () => ({
  globalRateLimiter: {
    acquire: mocks.acquire,
    release: mocks.release
  }
}));

import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ReviewReportSchema } from '../src/types/report-types.js';

// Use an actual generated report as a valid schema fixture.
const fixturePath = resolve(
  process.cwd(),
  'reports',
  'udacity_cd14715-simple-todo-app_1.json'
);

const validReport = JSON.parse(
  readFileSync(fixturePath, 'utf8')
);

// Simulated Claude SDK messages.
const initMessage = {
  type: 'system',
  subtype: 'init',
  mcp_servers: [
    { name: 'github', status: 'connected' },
    { name: 'eslint', status: 'connected' }
  ],
  tools: [
    'Task',
    'mcp__github__get_pull_request',
    'mcp__github__get_pull_request_files',
    'mcp__eslint__lint-files'
  ]
};

const githubMessage = {
  type: 'assistant',
  message: {
    content: [
      {
        type: 'tool_use',
        name: 'mcp__github__get_pull_request',
        input: {
          owner: 'udacity',
          repo: 'cd14715-simple-todo-app',
          pull_number: 1
        }
      },
      {
        type: 'tool_use',
        name: 'mcp__github__get_pull_request_files',
        input: {
          owner: 'udacity',
          repo: 'cd14715-simple-todo-app',
          pull_number: 1
        }
      }
    ]
  }
};

const agentNames = [
  'code-quality-analyzer',
  'test-coverage-analyzer',
  'refactoring-suggester'
];

const agentMessage = {
  type: 'assistant',
  message: {
    content: agentNames.map((name) => ({
      type: 'tool_use',
      name: 'Task',
      input: {
        subagent_type: name,
        prompt: 'Analyze the changed file'
      }
    }))
  }
};

function successMessage(report: unknown = validReport) {
  return {
    type: 'result',
    subtype: 'success',
    structured_output: report
  };
}

// Simulate streaming SDK messages without network requests.
function mockSDKMessages(messages: unknown[]) {
  mocks.query.mockImplementation(() => {
    return (async function* () {
      for (const message of messages) {
        yield message;
      }
    })();
  });
}

function mockSuccessfulReview(report: unknown = validReport) {
  mockSDKMessages([
    initMessage,
    githubMessage,
    agentMessage,
    successMessage(report)
  ]);
}

describe('CodeReviewOrchestrator', () => {
  const originalGitHubToken = process.env.GITHUB_TOKEN;
  const originalProjectRoot = process.env.PROJECT_ROOT;

  beforeEach(() => {
    vi.clearAllMocks();

    // A dummy value is sufficient because the SDK is mocked.
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.PROJECT_ROOT = process.cwd();

    mocks.acquire.mockResolvedValue(undefined);
    mocks.release.mockReturnValue(undefined);
  });

  afterEach(() => {
    if (originalGitHubToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalGitHubToken;
    }

    if (originalProjectRoot === undefined) {
      delete process.env.PROJECT_ROOT;
    } else {
      process.env.PROJECT_ROOT = originalProjectRoot;
    }
  });

  describe('Configuration', () => {
    it('should initialize with default options', async () => {
      mockSuccessfulReview();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1
      );

      expect(mocks.query).toHaveBeenCalledOnce();

      const call = mocks.query.mock.calls[0][0];

      expect(call.options.maxTurns).toBe(100);
      expect(call.options.model).toBe(
        process.env.ANTHROPIC_MODEL ??
          'claude-sonnet-4-5-20250929'
      );
    });

    it('should accept custom model and maxTurns', async () => {
      mockSuccessfulReview();

      const orchestrator = new CodeReviewOrchestrator({
        model: 'custom-test-model',
        maxTurns: 25
      });

      await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1
      );

      const call = mocks.query.mock.calls[0][0];

      expect(call.options.model).toBe('custom-test-model');
      expect(call.options.maxTurns).toBe(25);
    });
  });

  describe('Input validation', () => {
    it('should reject an empty repository owner', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          '',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow(
        'Repository owner and name are required'
      );

      expect(mocks.query).not.toHaveBeenCalled();
    });

    it('should reject invalid PR numbers', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      for (const number of [0, -1, 1.5, NaN]) {
        await expect(
          orchestrator.reviewPullRequest(
            'udacity',
            'cd14715-simple-todo-app',
            number
          )
        ).rejects.toThrow(
          'Pull request number must be a positive integer'
        );
      }

      expect(mocks.query).not.toHaveBeenCalled();
    });

    it('should reject missing GitHub credentials', async () => {
      delete process.env.GITHUB_TOKEN;

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow('GITHUB_TOKEN is missing');

      expect(mocks.query).not.toHaveBeenCalled();
    });
  });

  describe('reviewPullRequest', () => {
    it('should request GitHub PR data through MCP', async () => {
      mockSuccessfulReview();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1
      );

      const call = mocks.query.mock.calls[0][0];

      expect(call.prompt).toContain(
        'udacity/cd14715-simple-todo-app#1'
      );

      expect(call.prompt).toContain(
        'Use the GitHub MCP server'
      );

      expect(call.options.allowedTools).toContain(
        'mcp__github__*'
      );

      expect(call.options.mcpServers).toHaveProperty(
        'github'
      );
    });

    it('should configure and verify all three agents', async () => {
      mockSuccessfulReview();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1
      );

      const call = mocks.query.mock.calls[0][0];

      for (const name of agentNames) {
        expect(call.options.agents).toHaveProperty(name);
        expect(call.prompt).toContain(name);
      }
    });

    it('should aggregate a valid ReviewReport', async () => {
      mockSuccessfulReview();

      const orchestrator = new CodeReviewOrchestrator();

      const report = await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1
      );

      expect(report.fileReviews).toHaveLength(1);

      expect(report.summary.totalFiles).toBe(
        report.fileReviews.length
      );

      expect(report.summary.overallScore).toBe(72);

      expect(mocks.acquire).toHaveBeenCalledWith(1000);
      expect(mocks.release).toHaveBeenCalledOnce();
    });

    it('should validate output with Zod schema', async () => {
      mockSuccessfulReview();

      const orchestrator = new CodeReviewOrchestrator();

      const report = await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1
      );

      const result = ReviewReportSchema.safeParse(report);

      expect(result.success).toBe(true);
    });

    it('should reject invalid structured output', async () => {
      mockSuccessfulReview({
        summary: {
          overallScore: 'invalid'
        },
        fileReviews: 'not-an-array'
      });

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow('Invalid review report');

      expect(mocks.release).toHaveBeenCalledOnce();
    });

    it('should reject a disconnected GitHub MCP', async () => {
      mockSDKMessages([
        {
          ...initMessage,
          mcp_servers: [
            { name: 'github', status: 'failed' }
          ]
        },
        githubMessage,
        agentMessage,
        successMessage()
      ]);

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow(
        'GitHub MCP did not report a connected status'
      );

      expect(mocks.release).toHaveBeenCalledOnce();
    });

    it('should reject reviews without GitHub tool usage', async () => {
      mockSDKMessages([
        initMessage,
        agentMessage,
        successMessage()
      ]);

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow(
        'The orchestrator did not invoke any GitHub MCP tools'
      );
    });

    it('should reject missing specialized agents', async () => {
      mockSDKMessages([
        initMessage,
        githubMessage,
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Task',
                input: {
                  subagent_type: 'code-quality-analyzer'
                }
              }
            ]
          }
        },
        successMessage()
      ]);

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow(
        'Required agents were not invoked'
      );

      expect(mocks.release).toHaveBeenCalledOnce();
    });

    it('should reject inconsistent file counts', async () => {
      const inconsistentReport = structuredClone(validReport);

      inconsistentReport.summary.totalFiles = 99;

      mockSuccessfulReview(inconsistentReport);

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow(
        'Report summary totalFiles does not match'
      );
    });

    it('should release the rate limiter on SDK failure', async () => {
      mockSDKMessages([
        initMessage,
        {
          type: 'result',
          subtype: 'error_during_execution'
        }
      ]);

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'udacity',
          'cd14715-simple-todo-app',
          1
        )
      ).rejects.toThrow('Orchestrator execution failed');

      expect(mocks.acquire).toHaveBeenCalledOnce();
      expect(mocks.release).toHaveBeenCalledOnce();
    });
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      // Requires actual Claude API access.
      // Run manually only when explicitly needed.
    });
  });
});
