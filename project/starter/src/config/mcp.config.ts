import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * MCP server configuration for Windows, Linux, and macOS.
 *
 * Uses Node.js to execute npx-cli.js directly,
 * avoiding Windows .cmd subprocess issues.
 */

const nodeExecutable = process.execPath;

const npxCli = join(
  dirname(nodeExecutable),
  'node_modules',
  'npm',
  'bin',
  'npx-cli.js'
);

if (!existsSync(npxCli)) {
  throw new Error(
    `Cannot find npm npx CLI at: ${npxCli}`
  );
}

const githubToken = process.env.GITHUB_TOKEN ?? '';

if (!githubToken.trim()) {
  console.warn(
    '[MCP] Warning: GITHUB_TOKEN is not configured.'
  );
}

export const mcpServersConfig = {
  github: {
    type: 'stdio' as const,
    command: nodeExecutable,
    args: [
      npxCli,
      '-y',
      '@modelcontextprotocol/server-github'
    ],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: githubToken
    }
  },

  eslint: {
    type: 'stdio' as const,
    command: nodeExecutable,
    args: [
      npxCli,
      '-y',
      '@eslint/mcp@latest'
    ],
    env: {}
  }
};
