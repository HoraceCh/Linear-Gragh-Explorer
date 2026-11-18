import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validatePages } from './validate-pages.mjs';

const base = '/example/';
const script = 'index-01234567.js';
const style = 'index-01234567.css';
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pages-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'assets'));
  const worker = 'elk-worker.min-01234567.js';
  await writeFile(join(root, 'assets', worker), '');
  await writeFile(join(root, 'assets', script), `new Worker('${base}assets/${worker}')`);
  await writeFile(join(root, 'assets', style), '');
  const html = `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; connect-src 'self' https://api.linear.app"><script src="${base}assets/${script}"></script><link href="${base}assets/${style}">`;
  await writeFile(join(root, 'index.html'), html);
  return { root, html };
}
test('valid repository-subpath artifact', async t => {
  const { root } = await fixture(t);
  assert.equal((await validatePages(root, base)).assets, 3);
});
test('broken root-relative references block release', async t => {
  const { root, html } = await fixture(t);
  await writeFile(join(root, 'index.html'), html.replaceAll(base, '/'));
  await assert.rejects(validatePages(root, base), /outside/);
});
test('additional snapshot files block release', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'example.json'), '{}');
  await assert.rejects(validatePages(root, base), /Unexpected/);
});
test('symlinks in assets block release', async t => {
  const { root } = await fixture(t);
  await symlink(join(root, 'index.html'), join(root, 'assets', 'leak-01234567.js'));
  await assert.rejects(validatePages(root, base), /Unexpected/);
});
test('inline source maps block release', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'assets', script), '//# sourceMappingURL=data:application/json,{}');
  await assert.rejects(validatePages(root, base), /source map/);
});
test('credential signature in a bundled asset blocks release', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'assets', script), 'lin_api_' + 'A'.repeat(24));
  await assert.rejects(validatePages(root, base), /restricted signature/);
});

test('incorrect worker URL blocks release', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'assets', script), "new Worker('/assets/elk-worker.min-01234567.js')");
  await assert.rejects(validatePages(root, base), /worker asset/);
});
test('expanded script policy blocks release', async t => {
  const { root, html } = await fixture(t);
  await writeFile(join(root, 'index.html'), html.replace("script-src 'self'", "script-src 'self' *"));
  await assert.rejects(validatePages(root, base), /CSP/);
});
