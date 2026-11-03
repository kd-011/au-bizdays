import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { connect, root } from './helpers.mjs';

const readme = readFileSync(join(root, 'README.md'), 'utf8');
const commands = readFileSync(join(root, 'docs', 'commands.md'), 'utf8');
const data = readFileSync(join(root, 'docs', 'data.md'), 'utf8');
const docs = `${readme}\n${commands}\n${data}`;

test('generated blocks in the README and docs are the real, current output of the code and data', async () => {
  const { render, FILES } = await import('../scripts/render-demo.mjs');
  for (const file of FILES) {
    const text = readFileSync(join(root, file), 'utf8');
    assert.equal(render(file, text), text, `${file} is stale: run npm run assets`);
  }
});

test('the README shows real output above the first heading, including the refusal outside the data', () => {
  const demo = /<!-- demo:start -->\n```console\n([\s\S]*?)\n```\n<!-- demo:end -->/.exec(readme);
  assert.ok(demo, 'README needs a demo block');
  assert.ok(readme.indexOf('<!-- demo:start -->') < readme.indexOf('\n## '), 'the demo belongs above the first section');
  assert.match(demo[1], /^\$ au-bizdays add /m);
  assert.match(demo[1], /\(exit 3\)/);
});

test('the full demo in docs/commands.md shows every command', () => {
  const demo = /<!-- demo-full:start -->\n```console\n([\s\S]*?)\n```\n<!-- demo-full:end -->/.exec(commands);
  assert.ok(demo, 'docs/commands.md needs a demo-full block');
  for (const c of ['add', 'diff', 'is', 'next', 'prev', 'roll', 'add-calendar', 'holidays']) {
    assert.match(demo[1], new RegExp(`^\\$ au-bizdays ${c} `, 'm'), `demo is missing ${c}`);
  }
  assert.match(demo[1], /--from today/);
  assert.match(demo[1], /\(exit 3\)/);
});

test('every relative link in the README and docs points at a file that exists', () => {
  for (const [name, text] of [['README.md', readme], ['docs/commands.md', commands], ['docs/data.md', data]]) {
    const base = name.includes('/') ? join(root, 'docs') : root;
    for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)) {
      assert.ok(existsSync(join(base, m[1])), `${name} links to missing ${m[1]}`);
    }
  }
});

test('README states the business-day definition and the legal caveat', () => {
  assert.match(readme, /Monday to Friday and not a statewide public holiday/);
  assert.match(readme, /not legal advice/i);
  assert.match(readme, /own definition wins/i);
});

test('the README and docs do not claim novelty', () => {
  assert.doesNotMatch(docs, /(?<!read-)\b(first|only|novel|unique|no other)\b[^.]*\b(tool|server|library|cli|mcp)\b/i);
});

test('the docs list every MCP tool', async () => {
  const c = await connect();
  try {
    const { tools } = await c.client.listTools();
    for (const t of tools) assert.ok(docs.includes(`\`${t.name}\``), `docs missing tool ${t.name}`);
  } finally {
    await c.close();
  }
});

test('the docs document every JSON result field', async () => {
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
    for (const k of Object.keys(ok(args).result)) assert.ok(docs.includes(`\`${k}\``), `docs do not mention result field ${k} (${args[0]})`);
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
