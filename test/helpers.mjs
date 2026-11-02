import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

/** Run the built CLI and return exit code, output and parsed JSON (when --json was passed). */
export function run(args, env = {}) {
  const r = spawnSync(process.execPath, [join(root, 'dist', 'cli.js'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  let json;
  if (args.includes('--json')) {
    try { json = JSON.parse(r.stdout); } catch { json = undefined; }
  }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

/** Run with --json and require exit 0. */
export function ok(args, env) {
  const r = run([...args, '--json'], env);
  if (r.code !== 0) throw new Error(`exit ${r.code} for ${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.json;
}

/** Spawn the real MCP binary over stdio and connect an SDK client to it. */
export async function connect(env = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, 'dist', 'mcp.js')],
    env: { PATH: process.env.PATH ?? '', ...env },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}
export const call = (client, name, args = {}) => client.callTool({ name, arguments: args });
export const textOf = (result) => result.content.map((c) => c.text ?? '').join('\n');
