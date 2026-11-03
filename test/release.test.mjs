import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { changelogSection, planRelease } from '../scripts/release.mjs';
import { root } from './helpers.mjs';

describe('planRelease', () => {
  test('a version npm does not have is published and released', () => {
    const p = planRelease('0.2.0', ['0.1.0'], false);
    assert.equal(p.publish, true);
    assert.equal(p.release, true);
  });

  test('a published version with no GitHub Release only finishes the release', () => {
    const p = planRelease('0.2.0', ['0.2.0'], false);
    assert.equal(p.publish, false);
    assert.equal(p.release, true);
  });

  test('a published and released version does nothing', () => {
    const p = planRelease('0.2.0', ['0.2.0'], true);
    assert.equal(p.publish || p.release || p.skipped, false);
  });

  test('a version older than the newest on npm is refused, so "latest" never goes backwards', () => {
    assert.throws(() => planRelease('0.1.5', ['0.2.0'], false), /older than 0\.2\.0/);
  });

  test('pre-release versions are refused', () => {
    assert.throws(() => planRelease('0.2.0-rc.1', [], false), /not x\.y\.z/);
  });

  test('not on npm and no NPM_TOKEN: nothing is planned and the run is not a failure', () => {
    const p = planRelease('0.2.0', [], false, false);
    assert.equal(p.publish, false);
    assert.equal(p.release, false);
    assert.equal(p.skipped, true);
    assert.match(p.reason, /NPM_TOKEN/);
  });

  test('not on npm with an NPM_TOKEN: the first publish goes ahead', () => {
    const p = planRelease('0.2.0', [], false, true);
    assert.equal(p.publish, true);
    assert.equal(p.skipped, false);
  });

  test('once the package is on npm, a missing token no longer skips (trusted publishing takes over)', () => {
    const p = planRelease('0.3.0', ['0.2.0'], false, false);
    assert.equal(p.publish, true);
  });
});

describe('release.mjs plan, as the workflow runs it', () => {
  const plan = (args, env = {}) => {
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'release.mjs'), 'plan', ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };

  test('exits 0 with a notice when there is no token and nothing on npm', () => {
    const r = plan(['--published', '', '--release-exists', 'false'], { HAVE_NPM_TOKEN: 'false' });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /::notice title=Nothing published::/);
    assert.equal(JSON.parse(r.out.split('\n')[0]).skipped, true);
  });

  test('plans a publish when the token exists', () => {
    const r = plan(['--published', '', '--release-exists', 'false'], { HAVE_NPM_TOKEN: 'true' });
    assert.equal(r.code, 0, r.err);
    assert.equal(JSON.parse(r.out.split('\n')[0]).publish, true);
  });
});

describe('changelogSection', () => {
  test('returns the body of one version and stops at the next heading', () => {
    const text = '# Changelog\n\n## [0.2.0] - 2026-11-03\n\n### Added\n- a\n\n## [0.1.0] - 2026-11-02\n\n- b\n';
    assert.equal(changelogSection(text, '0.2.0'), '### Added\n- a');
  });

  test('a missing or empty section is an error', () => {
    assert.throws(() => changelogSection('## [0.1.0]\n- x\n', '0.2.0'), /no "## \[0\.2\.0\]" section/);
    assert.throws(() => changelogSection('## [0.2.0]\n\n## [0.1.0]\n- x\n', '0.2.0'), /empty/);
  });

  test('the real CHANGELOG.md has a section for the version in package.json', () => {
    const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
    assert.ok(changelogSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version).length > 20);
  });
});
