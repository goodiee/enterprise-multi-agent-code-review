
import { describe, it, expect } from 'vitest';

import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema
} from '../src/types/analysis-results.js';

import {
  ReviewReportSchema,
  ReviewReportJSONSchema
} from '../src/types/report-types.js';

// Reusable valid test data.
const validCodeQuality = {
  file: 'src/example.ts',
  issues: [
    {
      line: 10,
      severity: 'high',
      category: 'maintainability',
      description: 'Function is too complex.',
      suggestion: 'Split it into smaller functions.'
    }
  ],
  overallScore: 85,
  summary: 'Code quality is generally good.'
};

const validTestCoverage = {
  file: 'src/example.ts',
  hasTests: true,
  testFiles: ['tests/example.test.ts'],
  untestedPaths: [
    {
      type: 'branch',
      location: 'src/example.ts:20',
      priority: 'high',
      reasoning: 'Error handling is not tested.',
      suggestedTest: 'Add a test for invalid input.'
    }
  ],
  coverageEstimate: 75,
  summary: 'Some branches are missing tests.'
};

const validRefactoring = {
  file: 'src/example.ts',
  suggestions: [
    {
      type: 'extract-function',
      location: 'src/example.ts:10',
      impact: 'medium',
      description: 'Extract validation logic.',
      before: 'function process() { /* validation */ }',
      after: 'function validate() { /* validation */ }',
      benefits: 'Improves readability and testability.'
    }
  ],
  summary: 'One refactoring opportunity was identified.'
};

const validReport = {
  pullRequest: {
    owner: 'udacity',
    repo: 'cd14715-simple-todo-app',
    number: 1
  },
  fileReviews: [
    {
      file: 'src/example.ts',
      codeQuality: validCodeQuality,
      testCoverage: validTestCoverage,
      refactorings: validRefactoring
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 85,
    criticalIssues: 0,
    highPriorityTests: 1,
    refactoringOpportunities: 1
  },
  recommendations: [
    {
      priority: 'high',
      category: 'testing',
      description: 'Add tests for error handling.',
      files: ['src/example.ts']
    }
  ],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 1200,
    agentVersions: {
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0'
    }
  }
};

describe('CodeQualityResultSchema', () => {
  it('accepts valid code quality results', () => {
    expect(
      CodeQualityResultSchema.safeParse(validCodeQuality).success
    ).toBe(true);
  });

  it('rejects invalid severity values', () => {
    const invalid = {
      ...validCodeQuality,
      issues: [
        {
          ...validCodeQuality.issues[0],
          severity: 'extreme'
        }
      ]
    };

    expect(
      CodeQualityResultSchema.safeParse(invalid).success
    ).toBe(false);
  });

  it('rejects invalid issue categories', () => {
    const invalid = {
      ...validCodeQuality,
      issues: [
        {
          ...validCodeQuality.issues[0],
          category: 'unknown-category'
        }
      ]
    };

    expect(
      CodeQualityResultSchema.safeParse(invalid).success
    ).toBe(false);
  });

  it('accepts scores at 0 and 100', () => {
    for (const score of [0, 100]) {
      const result = {
        ...validCodeQuality,
        overallScore: score
      };

      expect(
        CodeQualityResultSchema.safeParse(result).success
      ).toBe(true);
    }
  });

  it('rejects scores outside 0 to 100', () => {
    for (const score of [-1, 101]) {
      const result = {
        ...validCodeQuality,
        overallScore: score
      };

      expect(
        CodeQualityResultSchema.safeParse(result).success
      ).toBe(false);
    }
  });

  it('accepts an empty issues array', () => {
    const result = {
      ...validCodeQuality,
      issues: []
    };

    expect(
      CodeQualityResultSchema.safeParse(result).success
    ).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { file, ...missingFile } = validCodeQuality;

    expect(
      CodeQualityResultSchema.safeParse(missingFile).success
    ).toBe(false);
  });
});

describe('TestCoverageResultSchema', () => {
  it('accepts valid test coverage results', () => {
    expect(
      TestCoverageResultSchema.safeParse(validTestCoverage).success
    ).toBe(true);
  });

  it('accepts empty test file and untested path arrays', () => {
    const result = {
      ...validTestCoverage,
      hasTests: false,
      testFiles: [],
      untestedPaths: []
    };

    expect(
      TestCoverageResultSchema.safeParse(result).success
    ).toBe(true);
  });

  it('accepts coverage estimates at 0 and 100', () => {
    for (const score of [0, 100]) {
      expect(
        TestCoverageResultSchema.safeParse({
          ...validTestCoverage,
          coverageEstimate: score
        }).success
      ).toBe(true);
    }
  });

  it('rejects coverage estimates outside 0 to 100', () => {
    for (const score of [-1, 101]) {
      expect(
        TestCoverageResultSchema.safeParse({
          ...validTestCoverage,
          coverageEstimate: score
        }).success
      ).toBe(false);
    }
  });

  it('rejects invalid test priorities', () => {
    const result = {
      ...validTestCoverage,
      untestedPaths: [
        {
          ...validTestCoverage.untestedPaths[0],
          priority: 'urgent'
        }
      ]
    };

    expect(
      TestCoverageResultSchema.safeParse(result).success
    ).toBe(false);
  });

  it('rejects non-boolean hasTests values', () => {
    expect(
      TestCoverageResultSchema.safeParse({
        ...validTestCoverage,
        hasTests: 'yes'
      }).success
    ).toBe(false);
  });
});

describe('RefactoringSuggestionSchema', () => {
  it('accepts valid refactoring suggestions', () => {
    expect(
      RefactoringSuggestionSchema.safeParse(validRefactoring).success
    ).toBe(true);
  });

  it('accepts an empty suggestions array', () => {
    expect(
      RefactoringSuggestionSchema.safeParse({
        ...validRefactoring,
        suggestions: []
      }).success
    ).toBe(true);
  });

  it('rejects invalid refactoring types', () => {
    const result = {
      ...validRefactoring,
      suggestions: [
        {
          ...validRefactoring.suggestions[0],
          type: 'rewrite-everything'
        }
      ]
    };

    expect(
      RefactoringSuggestionSchema.safeParse(result).success
    ).toBe(false);
  });

  it('rejects invalid impact values', () => {
    const result = {
      ...validRefactoring,
      suggestions: [
        {
          ...validRefactoring.suggestions[0],
          impact: 'critical'
        }
      ]
    };

    expect(
      RefactoringSuggestionSchema.safeParse(result).success
    ).toBe(false);
  });
});

describe('ReviewReportSchema', () => {
  it('accepts a complete valid review report', () => {
    expect(
      ReviewReportSchema.safeParse(validReport).success
    ).toBe(true);
  });

  it('rejects an invalid pull request number', () => {
    const result = {
      ...validReport,
      pullRequest: {
        ...validReport.pullRequest,
        number: 'one'
      }
    };

    expect(
      ReviewReportSchema.safeParse(result).success
    ).toBe(false);
  });

  it('rejects missing required report fields', () => {
    const { summary, ...missingSummary } = validReport;

    expect(
      ReviewReportSchema.safeParse(missingSummary).success
    ).toBe(false);
  });

  it('rejects invalid nested code quality results', () => {
    const result = {
      ...validReport,
      fileReviews: [
        {
          ...validReport.fileReviews[0],
          codeQuality: {
            ...validCodeQuality,
            overallScore: 150
          }
        }
      ]
    };

    expect(
      ReviewReportSchema.safeParse(result).success
    ).toBe(false);
  });

  it('accepts an empty recommendations array', () => {
    expect(
      ReviewReportSchema.safeParse({
        ...validReport,
        recommendations: []
      }).success
    ).toBe(true);
  });

  it('rejects invalid recommendation priorities', () => {
    const result = {
      ...validReport,
      recommendations: [
        {
          ...validReport.recommendations[0],
          priority: 'urgent'
        }
      ]
    };

    expect(
      ReviewReportSchema.safeParse(result).success
    ).toBe(false);
  });

  it('accepts empty agentVersions metadata', () => {
    const result = {
      ...validReport,
      metadata: {
        ...validReport.metadata,
        agentVersions: {}
      }
    };

    expect(
      ReviewReportSchema.safeParse(result).success
    ).toBe(true);
  });
});

describe('ReviewReportJSONSchema', () => {
  it('exports a JSON Schema object', () => {
    expect(ReviewReportJSONSchema).toBeDefined();
    expect(typeof ReviewReportJSONSchema).toBe('object');
    expect(ReviewReportJSONSchema).not.toBeNull();
  });

  it('contains report properties', () => {
    const schema = ReviewReportJSONSchema as {
      properties?: Record<string, unknown>;
    };

    expect(schema.properties).toBeDefined();

    expect(schema.properties).toHaveProperty(
      'pullRequest'
    );

    expect(schema.properties).toHaveProperty(
      'fileReviews'
    );

    expect(schema.properties).toHaveProperty(
      'summary'
    );

    expect(schema.properties).toHaveProperty(
      'recommendations'
    );

    expect(schema.properties).toHaveProperty(
      'metadata'
    );
  });

  it('marks required report fields', () => {
    const schema = ReviewReportJSONSchema as {
      required?: string[];
    };

    expect(schema.required).toEqual(
      expect.arrayContaining([
        'pullRequest',
        'fileReviews',
        'summary',
        'recommendations',
        'metadata'
      ])
    );
  });
});
