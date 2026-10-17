
import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError } from './utils/error-handler.js';

// Load environment variables from .env
dotenv.config();

/**
 * Multi-Agent Code Review CLI
 *
 * Usage:
 * npm run dev -- <owner> <repo> <pr-number>
 *
 * Example:
 * npm run dev -- udacity cd14715-simple-todo-app 1
 */

function validateRepositoryPart(
  value: string | undefined,
  fieldName: string
): string {
  if (!value || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  // GitHub repository owner/name cannot contain path separators.
  if (
    normalized === '.' ||
    normalized === '..' ||
    !/^[a-zA-Z0-9_.-]+$/.test(normalized)
  ) {
    throw new Error(
      `Invalid ${fieldName}: "${normalized}". ` +
      'Use a valid GitHub owner or repository name.'
    );
  }

  return normalized;
}

function validatePullRequestNumber(
  value: string | undefined
): number {
  if (!value || !/^[0-9]+$/.test(value)) {
    throw new Error(
      'PR number must be a positive integer.'
    );
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(
      'PR number must be a positive integer.'
    );
  }

  return number;
}

/**
 * Validate Claude authentication.
 *
 * Supported modes:
 * - Anthropic API key
 * - AWS Bedrock
 */
function validateAuthentication(): void {
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY?.trim();

  const useBedrock =
    process.env.CLAUDE_CODE_USE_BEDROCK === '1';

  const awsRegion =
    process.env.AWS_REGION?.trim() ??
    process.env.AWS_DEFAULT_REGION?.trim();

  const hasStaticAwsCredentials = Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );

  const hasAwsProfile = Boolean(
    process.env.AWS_PROFILE?.trim()
  );

  const hasAwsWebIdentity = Boolean(
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE?.trim() &&
    process.env.AWS_ROLE_ARN?.trim()
  );

  const hasAwsContainerCredentials = Boolean(
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI?.trim() ||
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI?.trim()
  );

  if (useBedrock) {
    if (!awsRegion) {
      throw new Error(
        'AWS_REGION is required when using AWS Bedrock.'
      );
    }

    // The AWS SDK may also obtain credentials from an
    // instance role, SSO, or another credential provider.
    // The SDK will validate actual access during execution.
    console.log('Authentication mode: AWS Bedrock.');
    return;
  }

  if (anthropicKey) {
    console.log('Authentication mode: Anthropic API.');
    return;
  }

  if (
    hasStaticAwsCredentials ||
    hasAwsProfile ||
    hasAwsWebIdentity ||
    hasAwsContainerCredentials
  ) {
    if (!awsRegion) {
      throw new Error(
        'AWS_REGION is required for AWS Bedrock.'
      );
    }

    process.env.CLAUDE_CODE_USE_BEDROCK = '1';

    console.log('Authentication mode: AWS Bedrock.');
    return;
  }

  throw new Error(
    'Claude authentication is missing.\n' +
    'Option 1: Set ANTHROPIC_API_KEY in .env.\n' +
    'Option 2: Configure AWS credentials, AWS_REGION, ' +
    'and CLAUDE_CODE_USE_BEDROCK=1.'
  );
}

function validateModel(): string {
  const model = process.env.ANTHROPIC_MODEL?.trim();

  if (!model) {
    throw new Error(
      'ANTHROPIC_MODEL must be configured in .env.'
    );
  }

  return model;
}

function validateGitHubToken(): void {
  if (!process.env.GITHUB_TOKEN?.trim()) {
    throw new Error(
      'GITHUB_TOKEN is missing. Configure it in .env.'
    );
  }
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    if (args.length !== 3) {
      throw new Error(
        'Usage: npm run dev -- <owner> <repo> <pr-number>\n' +
        'Example: npm run dev -- udacity cd14715-simple-todo-app 1'
      );
    }

    // 1. Validate command-line arguments.
    const owner = validateRepositoryPart(
      args[0],
      'Repository owner'
    );

    const repo = validateRepositoryPart(
      args[1],
      'Repository name'
    );

    const prNumber = validatePullRequestNumber(args[2]);

    // 2. Validate environment configuration.
    validateAuthentication();

    const model = validateModel();

    validateGitHubToken();

    // 3. Execute the review.
    console.log('\n=== MULTI-AGENT CODE REVIEW ===');
    console.log(`Repository: ${owner}/${repo}`);
    console.log(`Pull request: #${prNumber}`);
    console.log(`Model: ${model}`);

    const orchestrator = new CodeReviewOrchestrator({
      model,
      maxTurns: 100
    });

    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    // 4. Generate all required report formats.
    const generator = new ReportGenerator();

    const markdown =
      generator.generateMarkdownReport(report);

    const html =
      generator.generateHTMLReport(report);

    const json =
      generator.generateJSONReport(report);

    // 5. Create output directory.
    const reportsDir = join(
      process.cwd(),
      'reports'
    );

    await mkdir(reportsDir, {
      recursive: true
    });

    // 6. Use consistent, submission-friendly filenames.
    //
    // Example:
    // udacity_cd14715-simple-todo-app_1.json
    // udacity_cd14715-simple-todo-app_1.md
    // udacity_cd14715-simple-todo-app_1.html

    const safeOwner = owner.replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

    const safeRepo = repo.replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

    const baseName =
      `${safeOwner}_${safeRepo}_${prNumber}`;

    const markdownPath = join(
      reportsDir,
      `${baseName}.md`
    );

    const htmlPath = join(
      reportsDir,
      `${baseName}.html`
    );

    const jsonPath = join(
      reportsDir,
      `${baseName}.json`
    );

    // 7. Save the generated reports.
    await Promise.all([
      writeFile(markdownPath, markdown, 'utf8'),
      writeFile(htmlPath, html, 'utf8'),
      writeFile(jsonPath, json, 'utf8')
    ]);

    // 8. Display the review summary.
    console.log('\n=== CODE REVIEW SUMMARY ===');

    console.log(
      `Repository: ${owner}/${repo}`
    );

    console.log(
      `Pull request: #${prNumber}`
    );

    console.log(
      `Files reviewed: ${report.summary.totalFiles}`
    );

    console.log(
      `Overall score: ${report.summary.overallScore}/100`
    );

    console.log(
      `Critical issues: ${report.summary.criticalIssues}`
    );

    console.log(
      `High-priority tests: ${report.summary.highPriorityTests}`
    );

    console.log(
      'Refactoring opportunities: ' +
      report.summary.refactoringOpportunities
    );

    console.log('\nReports saved successfully:');
    console.log(`- ${jsonPath}`);
    console.log(`- ${markdownPath}`);
    console.log(`- ${htmlPath}`);

    console.log('\nCode review completed successfully.');
  } catch (error) {
    console.error(
      '\n[ERROR]',
      formatError(error)
    );

    process.exitCode = 1;
  }
}

// Run the CLI.
main().catch(error => {
  console.error(
    '\n[UNEXPECTED ERROR]',
    formatError(error)
  );

  process.exitCode = 1;
});
