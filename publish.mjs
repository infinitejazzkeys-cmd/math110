#!/usr/bin/env node
/**
 * Commit and push the built site so GitHub Pages picks it up.
 * Run with:  npm run publish-site      (this runs the build first)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();

function tryGit(...args) {
  try { return { ok: true, out: git(...args) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}

/* --- sanity checks ------------------------------------------------------ */
if (!fs.existsSync(path.join(ROOT, 'docs', 'index.html'))) {
  console.error('docs/index.html is missing. Run "npm run build" first.');
  process.exit(1);
}

if (!tryGit('rev-parse', '--git-dir').ok) {
  console.error('This folder is not a git repository yet.\n'
    + 'Ask Claude to set up publishing, or run:  git init');
  process.exit(1);
}

/* --- is there anything to publish? ------------------------------------- */
const status = git('status', '--porcelain');
if (!status) {
  console.log('Nothing has changed since the last publish - site is already up to date.');
  process.exit(0);
}

console.log('Changes to publish:\n' + status + '\n');

/* --- commit ------------------------------------------------------------ */
const stamp = new Date().toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const msg = process.argv.slice(2).join(' ') || 'Update course site - ' + stamp;

git('add', '-A');
const commit = tryGit('commit', '-m', msg);
if (!commit.ok && !/nothing to commit/i.test(commit.out)) {
  console.error('Commit failed:\n' + commit.out);
  process.exit(1);
}

/* --- push -------------------------------------------------------------- */
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const push = tryGit('push', 'origin', branch);
if (!push.ok) {
  console.error('Push failed:\n' + push.out);
  process.exit(1);
}

let url = '';
const remote = tryGit('remote', 'get-url', 'origin');
if (remote.ok) {
  const m = remote.out.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (m) url = 'https://' + m[1].toLowerCase() + '.github.io/' + m[2] + '/';
}

console.log('\nPublished: ' + msg);
if (url) console.log('Live in about a minute at:  ' + url);
