import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Validate the exact directory handed to upload-pages-artifact.
// Keep unknown files out of the public bundle until their purpose is reviewed.
export async function validatePages(directory, base) {
  if (!/^\/[\w.-]+\/$/.test(base) || ['/../', '/./'].includes(base))
    throw new Error('Expected an absolute repository base path ending in /.');
  const entries = await readdir(directory, { withFileTypes: true });
  for (const file of entries) {
    if (file.name === 'assets' && file.isDirectory()) continue;
    if (['index.html', '_headers'].includes(file.name) && file.isFile()) continue;
    throw new Error('Unexpected file or directory in public artifact.');
  }
  const assets = await readdir(join(directory, 'assets'), { withFileTypes: true });
  const names = new Set();
  for (const file of assets) {
    if (!file.isFile() || !/^[\w.-]+-[\w-]{8,}\.(css|js)$/.test(file.name))
      throw new Error('Unexpected or unhashed public asset.');
    names.add(file.name);
  }
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].map(m => m[0]);
  const references = tags.map(tag => tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1]);
  for (const ref of references) {
    if (!ref || ref !== base + 'assets/' + basename(ref) || !names.has(basename(ref)))
      throw new Error('HTML asset is missing or outside the Pages base path.');
  }
  if (!references.some(ref => ref.endsWith('.js')) || !references.some(ref => ref.endsWith('.css')))
    throw new Error('Missing application script or stylesheet.');
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => match[0])
    .find(tag => /http-equiv=["']Content-Security-Policy["']/i.test(tag));
  const policy = meta?.match(/\bcontent="([^"]+)"/i)?.[1] || '';
  const directives = policy.split(';').map(directive => directive.trim().replace(/\s+/g, ' '));
  if (!directives.includes("script-src 'self'") ||
      !directives.includes("connect-src 'self' https://api.linear.app"))
    throw new Error('Missing required shell CSP directives.');
  const suspicious = /lin_api_[A-Za-z0-9]{16,}|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|appgprj_[0-9a-f]{20,}/;
  const rootFiles = entries.filter(entry => entry.isFile()).map(entry => entry.name);
  const worker = [...names].find(name => name.startsWith('elk-worker.min-') && name.endsWith('.js'));
  let workerReferenced = false;
  for (const path of [...rootFiles, ...[...names].map(name => 'assets/' + name)]) {
    const data = await readFile(join(directory, path), 'utf8');
    if (path.endsWith('.js') && worker && data.includes(base + 'assets/' + worker))
      workerReferenced = true;
    if (suspicious.test(data) || /\/\/[#@]\s*sourceMappingURL=|\/\*[#@]\s*sourceMappingURL=/.test(data))
      throw new Error('Public asset contains a restricted signature or source map reference.');
  }
  if (!workerReferenced) throw new Error('ELK worker asset is missing or outside the Pages base path.');
  return { assets: names.size, base };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await validatePages(process.argv[2] || 'dist', process.argv[3]);
  console.log('Verified', result.assets, 'hashed assets for', result.base);
}
