
import type { ReviewReport } from '../types/report-types.js';

/**
 * Report Generator
 *
 * Converts a validated ReviewReport into:
 * - Markdown
 * - HTML
 * - JSON
 */
export class ReportGenerator {

  /**
   * Escape untrusted text before inserting it into HTML.
   */
  private escapeHTML(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape characters that can break Markdown tables.
   */
  private escapeMarkdown(value: string): string {
    return value
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ');
  }

  /**
   * Format duration.
   *
   * Assumes metadata.duration is measured in milliseconds.
   */
  private formatDuration(milliseconds: number): string {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      return 'Unknown';
    }

    if (milliseconds < 1000) {
      return `${milliseconds} ms`;
    }

    return `${(milliseconds / 1000).toFixed(1)} seconds`;
  }

  /**
   * Generate a detailed Markdown report.
   */
  generateMarkdownReport(report: ReviewReport): string {
    const {
      pullRequest,
      summary,
      recommendations,
      fileReviews,
      metadata
    } = report;

    const sections: string[] = [
      '# Code Review Report',
      '',
      `**Repository:** ${pullRequest.owner}/${pullRequest.repo}`,
      `**Pull Request:** #${pullRequest.number}`,
      '',
      '## Summary',
      '',
      '| Metric | Value |',
      '|---|---:|',
      `| Overall Score | ${summary.overallScore}/100 |`,
      `| Files Reviewed | ${summary.totalFiles} |`,
      `| Critical Issues | ${summary.criticalIssues} |`,
      `| High Priority Tests | ${summary.highPriorityTests} |`,
      `| Refactoring Opportunities | ${summary.refactoringOpportunities} |`,
      '',
      '## Top Recommendations',
      ''
    ];

    if (recommendations.length === 0) {
      sections.push('No recommendations were generated.');
    } else {
      recommendations.forEach((rec, index) => {
        sections.push(
          `${index + 1}. **[${rec.priority.toUpperCase()}] ${this.escapeMarkdown(rec.category)}**`,
          '',
          rec.description,
          '',
          `   **Files:** ${rec.files.join(', ') || 'Not specified'}`,
          ''
        );
      });
    }

    sections.push(
      '',
      '## Detailed File Reviews',
      ''
    );

    if (fileReviews.length === 0) {
      sections.push('No files were reviewed.');
    }

    for (const review of fileReviews) {
      const {
        file,
        codeQuality,
        testCoverage,
        refactorings
      } = review;

      sections.push(
        `### ${file}`,
        '',
        `**Quality Score:** ${codeQuality.overallScore}/100`,
        '',
        `**Estimated Test Coverage:** ${testCoverage.coverageEstimate}%`,
        '',
        `**Tests Present:** ${testCoverage.hasTests ? 'Yes' : 'No'}`,
        '',
        '#### Code Quality',
        '',
        codeQuality.summary,
        ''
      );

      if (codeQuality.issues.length === 0) {
        sections.push('No code-quality issues identified.', '');
      } else {
        for (const issue of codeQuality.issues) {
          sections.push(
            `**[${issue.severity.toUpperCase()}] ${issue.category} — Line ${issue.line}**`,
            '',
            issue.description,
            '',
            `**Suggestion:** ${issue.suggestion}`,
            ''
          );
        }
      }

      sections.push(
        '#### Test Coverage',
        '',
        testCoverage.summary,
        '',
        `**Related test files:** ${testCoverage.testFiles.join(', ') || 'None identified'}`,
        ''
      );

      if (testCoverage.untestedPaths.length === 0) {
        sections.push('No untested paths identified.', '');
      } else {
        for (const gap of testCoverage.untestedPaths) {
          sections.push(
            `**[${gap.priority.toUpperCase()}] ${gap.type}: ${gap.location}**`,
            '',
            `**Reason:** ${gap.reasoning}`,
            '',
            `**Suggested test:** ${gap.suggestedTest}`,
            ''
          );
        }
      }

      sections.push(
        '#### Refactoring Suggestions',
        '',
        refactorings.summary,
        ''
      );

      if (refactorings.suggestions.length === 0) {
        sections.push('No refactoring suggestions identified.', '');
      } else {
        for (const suggestion of refactorings.suggestions) {
          sections.push(
            `**[${suggestion.impact.toUpperCase()} IMPACT] ${suggestion.type}**`,
            '',
            `**Location:** ${suggestion.location}`,
            '',
            suggestion.description,
            '',
            `**Benefits:** ${suggestion.benefits}`,
            '',
            '**Before:**',
            '',
            '~~~text',
            suggestion.before,
            '~~~',
            '',
            '**After:**',
            '',
            '~~~text',
            suggestion.after,
            '~~~',
            ''
          );
        }
      }

      sections.push('---', '');
    }

    sections.push(
      '## Report Metadata',
      '',
      `**Generated at:** ${metadata.analyzedAt}`,
      '',
      `**Duration:** ${this.formatDuration(metadata.duration)}`,
      '',
      '### Agent Versions',
      ''
    );

    for (const [agent, version] of Object.entries(metadata.agentVersions)) {
      sections.push(`- ${agent}: ${version}`);
    }

    return sections.join('\n');
  }

  /**
   * Generate a complete, self-contained HTML report.
   */
  generateHTMLReport(report: ReviewReport): string {
    const {
      pullRequest,
      summary,
      recommendations,
      fileReviews,
      metadata
    } = report;

    const esc = (value: unknown): string =>
      this.escapeHTML(value);

    const renderMetric = (
      value: number,
      label: string
    ): string => `
      <div class="metric">
        <div class="metric-value">${esc(value)}</div>
        <div class="metric-label">${esc(label)}</div>
      </div>
    `;

    const recommendationHTML = recommendations.length
      ? recommendations.map(rec => `
        <li class="recommendation priority-${esc(rec.priority)}">
          <div>
            <span class="priority-label">
              ${esc(rec.priority.toUpperCase())}
            </span>
            <strong>${esc(rec.category)}</strong>
          </div>

          <p>${esc(rec.description)}</p>

          <small>
            Files: ${esc(rec.files.join(', ') || 'Not specified')}
          </small>
        </li>
      `).join('')
      : '<li class="empty">No recommendations generated.</li>';

    const fileReviewHTML = fileReviews.length
      ? fileReviews.map(review => {
        const {
          file,
          codeQuality,
          testCoverage,
          refactorings
        } = review;

        const issuesHTML = codeQuality.issues.length
          ? codeQuality.issues.map(issue => `
            <div class="finding severity-${esc(issue.severity)}">
              <div class="finding-heading">
                <span class="tag">${esc(issue.severity.toUpperCase())}</span>
                <strong>${esc(issue.category)}</strong>
                <span class="muted">Line ${esc(issue.line)}</span>
              </div>

              <p>${esc(issue.description)}</p>

              <p>
                <strong>Suggestion:</strong>
                ${esc(issue.suggestion)}
              </p>
            </div>
          `).join('')
          : '<p class="empty">No code-quality issues identified.</p>';

        const testGapsHTML = testCoverage.untestedPaths.length
          ? testCoverage.untestedPaths.map(gap => `
            <div class="finding priority-${esc(gap.priority)}">
              <div class="finding-heading">
                <span class="tag">${esc(gap.priority.toUpperCase())}</span>
                <strong>${esc(gap.type)}</strong>
              </div>

              <p><strong>Location:</strong> ${esc(gap.location)}</p>
              <p><strong>Reason:</strong> ${esc(gap.reasoning)}</p>
              <p><strong>Suggested test:</strong> ${esc(gap.suggestedTest)}</p>
            </div>
          `).join('')
          : '<p class="empty">No untested paths identified.</p>';

        const refactorHTML = refactorings.suggestions.length
          ? refactorings.suggestions.map(suggestion => `
            <div class="finding">
              <div class="finding-heading">
                <span class="tag">${esc(suggestion.impact.toUpperCase())} IMPACT</span>
                <strong>${esc(suggestion.type)}</strong>
              </div>

              <p><strong>Location:</strong> ${esc(suggestion.location)}</p>
              <p>${esc(suggestion.description)}</p>
              <p><strong>Benefits:</strong> ${esc(suggestion.benefits)}</p>

              <div class="code-comparison">
                <div>
                  <h5>Before</h5>
                  <pre><code>${esc(suggestion.before)}</code></pre>
                </div>

                <div>
                  <h5>After</h5>
                  <pre><code>${esc(suggestion.after)}</code></pre>
                </div>
              </div>
            </div>
          `).join('')
          : '<p class="empty">No refactoring suggestions identified.</p>';

        return `
          <section class="file-card">
            <h3>${esc(file)}</h3>

            <div class="file-metrics">
              <span><strong>Quality:</strong> ${esc(codeQuality.overallScore)}/100</span>
              <span><strong>Estimated coverage:</strong> ${esc(testCoverage.coverageEstimate)}%</span>
              <span><strong>Tests present:</strong> ${testCoverage.hasTests ? 'Yes' : 'No'}</span>
            </div>

            <details open>
              <summary>
                Code Quality
                <span class="count">${codeQuality.issues.length} issues</span>
              </summary>

              <div class="details-content">
                <p>${esc(codeQuality.summary)}</p>
                ${issuesHTML}
              </div>
            </details>

            <details>
              <summary>
                Test Coverage
                <span class="count">${testCoverage.untestedPaths.length} gaps</span>
              </summary>

              <div class="details-content">
                <p>${esc(testCoverage.summary)}</p>

                <p>
                  <strong>Related test files:</strong>
                  ${esc(testCoverage.testFiles.join(', ') || 'None identified')}
                </p>

                ${testGapsHTML}
              </div>
            </details>

            <details>
              <summary>
                Refactoring Suggestions
                <span class="count">${refactorings.suggestions.length} suggestions</span>
              </summary>

              <div class="details-content">
                <p>${esc(refactorings.summary)}</p>
                ${refactorHTML}
              </div>
            </details>
          </section>
        `;
      }).join('')
      : '<p class="empty">No files were reviewed.</p>';

    const agentVersionsHTML = Object.entries(metadata.agentVersions)
      .map(([agent, version]) => `
        <li>
          <strong>${esc(agent)}</strong>: ${esc(version)}
        </li>
      `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Code Review Report — ${esc(pullRequest.owner)}/${esc(pullRequest.repo)} #${esc(pullRequest.number)}</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        Roboto, Arial, sans-serif;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
      background: #f7f9fc;
      color: #243447;
      line-height: 1.6;
    }

    h1 {
      font-size: 2rem;
      border-bottom: 3px solid #3498db;
      padding-bottom: 12px;
      margin-bottom: 8px;
    }

    h2 {
      margin-top: 34px;
      margin-bottom: 16px;
    }

    h3 {
      overflow-wrap: anywhere;
    }

    .subtitle,
    .muted {
      color: #66788a;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      background: white;
      padding: 24px;
      margin: 24px 0;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
    }

    .metric {
      text-align: center;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      color: #2980b9;
    }

    .metric-label {
      font-size: 0.85rem;
      color: #66788a;
    }

    .recommendations {
      list-style: none;
      padding: 0;
    }

    .recommendation,
    .file-card {
      background: white;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 12px;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.05);
    }

    .recommendation {
      border-left: 4px solid #3498db;
    }

    .priority-critical,
    .severity-critical {
      border-left: 4px solid #e74c3c;
    }

    .priority-high,
    .severity-high {
      border-left: 4px solid #f39c12;
    }

    .priority-medium,
    .severity-medium {
      border-left: 4px solid #3498db;
    }

    .priority-low,
    .severity-low,
    .severity-info {
      border-left: 4px solid #27ae60;
    }

    .priority-label {
      font-weight: 700;
      margin-right: 8px;
      text-transform: uppercase;
    }

    .recommendation p {
      margin: 8px 0;
    }

    .file-card {
      padding: 24px;
      margin-bottom: 24px;
    }

    .file-card h3 {
      margin-top: 0;
      color: #2c3e50;
    }

    .file-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 16px 0 22px;
    }

    .file-metrics span {
      padding: 7px 12px;
      background: #edf4fb;
      border-radius: 6px;
      font-size: 0.9rem;
    }

    details {
      border: 1px solid #e0e6ed;
      border-radius: 7px;
      margin-top: 12px;
      overflow: hidden;
    }

    summary {
      cursor: pointer;
      padding: 14px 16px;
      font-weight: 600;
      background: #f4f7fa;
    }

    summary:hover {
      background: #eaf1f8;
    }

    .count {
      float: right;
      color: #66788a;
      font-size: 0.85rem;
      font-weight: 400;
    }

    .details-content {
      padding: 16px;
    }

    .finding {
      padding: 14px 16px;
      border: 1px solid #e5e9ef;
      border-left: 4px solid #3498db;
      border-radius: 5px;
      margin-top: 12px;
      overflow-wrap: anywhere;
    }

    .finding-heading {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .tag {
      display: inline-block;
      background: #edf2f7;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .code-comparison {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .code-comparison > div {
      min-width: 0;
    }

    .code-comparison h5 {
      margin: 0 0 8px;
    }

    pre {
      background: #182230;
      color: #e6edf3;
      padding: 14px;
      border-radius: 6px;
      overflow-x: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }

    .empty {
      color: #66788a;
      font-style: italic;
    }

    footer {
      border-top: 1px solid #e0e6ed;
      margin-top: 40px;
      padding-top: 20px;
      text-align: center;
      color: #66788a;
      font-size: 0.9rem;
    }

    .agent-versions {
      list-style: none;
      padding: 0;
      font-size: 0.85rem;
    }

    @media (max-width: 600px) {
      body {
        padding: 12px;
      }

      .file-card {
        padding: 14px;
      }

      .count {
        float: none;
        margin-left: 8px;
      }
    }
  </style>
</head>

<body>
  <h1>Code Review Report</h1>

  <p class="subtitle">
    Repository:
    <strong>${esc(pullRequest.owner)}/${esc(pullRequest.repo)}</strong>
    &nbsp;|&nbsp;
    Pull Request: <strong>#${esc(pullRequest.number)}</strong>
  </p>

  <section class="summary">
    ${renderMetric(summary.overallScore, 'Overall Score')}
    ${renderMetric(summary.totalFiles, 'Files Reviewed')}
    ${renderMetric(summary.criticalIssues, 'Critical Issues')}
    ${renderMetric(summary.highPriorityTests, 'Tests Needed')}
    ${renderMetric(summary.refactoringOpportunities, 'Refactorings')}
  </section>

  <h2>Top Recommendations</h2>

  <ul class="recommendations">
    ${recommendationHTML}
  </ul>

  <h2>Detailed File Reviews</h2>

  ${fileReviewHTML}

  <footer>
    <p>
      Generated at ${esc(metadata.analyzedAt)}
      &bull;
      Duration: ${esc(this.formatDuration(metadata.duration))}
    </p>

    <strong>Agent Versions</strong>

    <ul class="agent-versions">
      ${agentVersionsHTML}
    </ul>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate formatted JSON.
   */
  generateJSONReport(report: ReviewReport): string {
    return JSON.stringify(report, null, 2);
  }
}
