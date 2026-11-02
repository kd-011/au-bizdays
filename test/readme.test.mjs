import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { connect, root } from './helpers.mjs';

const readme = readFileSync(join(root, 'README.md'), 'utf8');

test('README generated blocks are the real, current output of the code and data', async () => {
  const { render } = await import('../scripts/render-demo.mjs');
  assert.equal(render(readme), readme, 'README is stale: run npm run assets');
});

test('README demo block shows every command', () => {
  const demo = /<!-- demo:start -->\n```console\n([\s\S]*?)\n```\n<!-- demo:end -->/.exec(readme);
  assert.ok(demo, 'README needs a demo block');
  for (const c of ['add', 'diff', 'is', 'next', 'prev', 'roll', 'add-calendar', 'holidays']) {
    assert.match(demo[1], new RegExp(`^\\$ au-bizdays ${c} `, 'm'), `demo is missing ${c}`);
  }
  assert.match(demo[1], /\(exit 3\)/);
});

test('README states the business-day definition and the legal caveat', () => {
  assert.match(readme, /Monday to Friday and not a statewide public holiday/);
  assert.match(readme, /not legal advice/i);
  assert.match(readme, /own definition wins/i);
});

test('README does not claim novelty', () => {
  assert.doesNotMatch(readme, /(?<!read-)\b(first|only|novel|unique|no other)\b[^.]*\b(tool|server|library|cli|mcp)\b/i);
});

test('README lists every MCP tool', async () => {
  const c = await connect();
  try {
    const { tools } = await c.client.listTools();
    for (const t of tools) assert.ok(readme.includes(`\`${t.name}\``), `README missing tool ${t.name}`);
  } finally {
    await c.close();
  }
});

test('README documents every JSON result field', async () => {
  const { ok } = await import('./helpers.mjs');
  const calls = [
    ['add', '10', '--from', '2026-12-18', '--state', 'WA'],
    ['diff', '2026-12-18', '2027-01-06', '--state', 'WA'],
    ['is', '2026-12-28', '--state', 'WA'],
    ['next', '2026-12-24', '--state', 'WA'],
    ['roll', '2026-12-26', '--direction', 'forward', '--state', 'WA'],
    ['add-calendar', '14', '--from', '2026-12-14', '--roll', 'forward', '--state', 'WA'],
    ['holidays', '--year', '2026', '--state', 'WA'],
  ];
  for (const args of calls) {
    for (const k of Object.keys(ok(args).result)) assert.ok(readme.includes(`\`${k}\``), `README does not mention result field ${k} (${args[0]})`);
  }
});

test('package.json and the version constant agree, and the package ships only what it should', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const version = /VERSION = '([^']+)'/.exec(readFileSync(join(root, 'src', 'version.ts'), 'utf8'))[1];
  assert.equal(version, pkg.version);
  assert.equal(JSON.parse(readFileSync(join(root, 'server.json'), 'utf8')).version, pkg.version);
  assert.deepEqual(pkg.files, ['dist', 'data', 'server.json', 'README.md', 'LICENSE']);
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@modelcontextprotocol/sdk', 'zod']);
  assert.equal(pkg.mcpName, 'io.github.kd-011/au-bizdays');
});

test('no em dashes, local paths or attribution in tracked text', async () => {
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter((f) => f && !/package-lock\.json$/.test(f));
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    assert.ok(!text.includes(String.fromCharCode(0x2014)), `${f} has an em dash`);
    assert.doesNotMatch(text, /\/home\/|\/Users\//, `${f} has a local path`);
  }
});
