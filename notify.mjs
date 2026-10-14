#!/usr/bin/env node
/**
 * Work out what the last publish actually changed and write a ready-to-send
 * email about it to email-draft.txt (and print it).
 *
 * Runs automatically as part of `npm run publish-site`.
 *
 * This only DRAFTS the message - it does not send anything, and it never sees
 * a recipient list. Student addresses stay out of this repo, which is public.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT  = path.join(ROOT, 'email-draft.txt');

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return '';
  }
};

/* ---- where does the site live? ---- */
let url = '';
const m = git('remote', 'get-url', 'origin')
  .match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
if (m) url = 'https://' + m[1].toLowerCase() + '.github.io/' + m[2] + '/';

/* ---- what changed in the last commit? ---- */
// Defaults to the commit just published. Pass a commit to redo an older one,
// e.g. `node notify.mjs ab03ec7` to regenerate that publish's draft.
const target = process.argv[2] || 'HEAD';
const hasParent = git('rev-parse', '--verify', target + '~1') !== '';
const diff = hasParent
  ? git('diff', '--name-status', target + '~1', target, '--', 'content')
  : git('show', '--name-status', '--format=', target, '--', 'content');

const LABEL = {
  slides:   'Lecture slides',
  homework: 'Homework',
  exams:    'Exam material',
  handouts: 'Handouts',
  syllabus: 'Syllabus',
};

const added = [], updated = [];
let announced = false;

for (const line of diff.split('\n').filter(Boolean)) {
  const [status, file] = line.split('\t');
  if (!file) continue;

  if (file.endsWith('announcements.md')) { announced = true; continue; }
  if (file.endsWith('.md')) continue;

  const parts = file.split('/');            // content/<category>/<name>
  const cat   = parts[1];
  const base  = path.basename(parts[parts.length - 1], path.extname(file));
  // strip the ordering prefix: "02 - Homework 2" -> "Homework 2"
  const title = base.replace(/^\s*\d+\s*[-–—.)]\s*/, '').trim();
  const entry = (LABEL[cat] || cat) + ': ' + title;

  if (status === 'A') added.push(entry);
  else if (status === 'M') updated.push(entry);
}

/* ---- newest announcement headline ---- */
let headline = '', headlineDate = '';
const annFile = path.join(ROOT, 'content', 'announcements.md');
if (fs.existsSync(annFile)) {
  const raw = fs.readFileSync(annFile, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const first = raw.split(/^##\s+/m)[1];
  if (first) {
    const head = first.split('\n')[0].trim();
    const dm = head.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/);
    headline = dm ? dm[2] : head;
    headlineDate = dm ? dm[1] : '';
  }
}

if (!added.length && !updated.length && !announced) {
  console.log('\nNothing student-facing changed - no email draft written.');
  process.exit(0);
}

/* ---- compose ---- */
const bits = [];
if (announced) bits.push('a new announcement');
if (added.length)   bits.push(added.length === 1 ? 'a new file' : 'new files');
if (updated.length && !added.length) bits.push('updated material');

const subject = announced && headline
  ? 'MATH 110 - ' + headline
  : 'MATH 110 - new material posted';

const lines = ['Hi everyone,', ''];
lines.push('There is ' + bits.join(' and ') + ' on the course website.');
lines.push('');

if (announced && headline) {
  lines.push('Announcement: ' + headline);
  if (headlineDate) lines.push('  Read it here: ' + url + 'announcements.html');
  lines.push('');
}
if (added.length) {
  lines.push('Newly posted:');
  for (const a of added) lines.push('  - ' + a);
  lines.push('');
}
if (updated.length) {
  lines.push('Updated:');
  for (const u of updated) lines.push('  - ' + u);
  lines.push('');
}

lines.push('Course website: ' + url);
lines.push('');
lines.push('Best,');
lines.push('Prof. Collins');

const draft = 'Subject: ' + subject + '\n\n' + lines.join('\n') + '\n';
fs.writeFileSync(OUT, draft);

console.log('\n' + '-'.repeat(60));
console.log(draft.trimEnd());
console.log('-'.repeat(60));
console.log('Also saved to email-draft.txt');
