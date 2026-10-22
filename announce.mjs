#!/usr/bin/env node
/**
 * Turn an email (in the email-draft.txt format) into a matching announcement
 * on the site, then rebuild, commit, and push.
 *
 * Normally run for you by:   npm run send-and-announce
 * which sends the email first and then calls this with a copy of the draft.
 *
 *   node announce.mjs <draft-file>             add, build, commit, push
 *   node announce.mjs <draft-file> --preview   only show the announcement
 *   node announce.mjs <draft-file> --no-push   add, build, commit (push later)
 *
 * The class has already been emailed about this announcement, so afterwards
 * .last-emailed is moved to the new commit. That keeps the next email draft
 * from announcing it a second time.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.dirname(fileURLToPath(import.meta.url));
const ANN     = path.join(ROOT, 'content', 'announcements.md');
const MARKER  = path.join(ROOT, '.last-emailed');

const args    = process.argv.slice(2);
const preview = args.includes('--preview');
const noPush  = args.includes('--no-push');
const file    = args.find(a => !a.startsWith('--'));

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();

if (!file || !fs.existsSync(file)) {
  console.error('Usage: node announce.mjs <draft-file> [--preview] [--no-push]');
  process.exit(1);
}

/* ---- read the email ---- */
const lines = fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
const sm = (lines[0] || '').match(/^Subject:\s*(.+)$/);
if (!sm) { console.error('No Subject line - no announcement added.'); process.exit(1); }

// An email that was itself written about an announcement doesn't need another one.
if (lines.some(l => /^Announcement:\s/.test(l))) {
  console.log('This email is about an announcement that is already on the site - no new announcement added.');
  process.exit(0);
}

let headline = sm[1].trim().replace(/^MATH\s*110\s*[-–—:]\s*/i, '');
headline = headline.charAt(0).toUpperCase() + headline.slice(1);

/* ---- email body -> announcement body ---- */
let body = lines.slice(1);
while (body.length && !body[0].trim()) body.shift();
if (body.length && /^(hi|hello|dear)\b.*,\s*$/i.test(body[0])) body.shift();   // greeting
const sign = body.findIndex(l => /^(best|thanks|thank you|cheers|sincerely|regards)\b[^.]*,?\s*$/i.test(l.trim()));
if (sign >= 0) body = body.slice(0, sign);                                     // sign-off
body = body
  .filter(l => !/^course website:/i.test(l.trim()))      // the reader is already on the site
  .map(l => l.replace(/^\s+-\s+/, '- '));                // indented list items -> markdown list
let text = body.join('\n').replace(/\n{3,}/g, '\n\n').trim();

const now = new Date();
const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  + '-' + String(now.getDate()).padStart(2, '0');
const entry = '## ' + today + ' — ' + headline + '\n\n' + text;

console.log('\n--- announcement ' + '-'.repeat(42));
console.log(entry);
console.log('-'.repeat(60));
if (preview) { console.log('Preview only - nothing changed.'); process.exit(0); }

/* ---- only proceed from a clean, committed state ---- */
// Committing other unpublished changes here would sneak them past the email,
// since the marker is about to say "the class already knows about this".
if (git('status', '--porcelain')) {
  console.error('\nThere are other unpublished changes in this folder, so the announcement was NOT added.\n'
    + 'Publish those first (npm run publish-site), then add the announcement.');
  process.exit(1);
}

/* ---- add it ---- */
const raw = fs.readFileSync(ANN, 'utf8');
const close = raw.indexOf('-->');
const firstEntry = raw.search(/^##\s/m);
let out;
if (close >= 0 && (firstEntry < 0 || close < firstEntry)) {
  out = raw.slice(0, close + 3) + '\n\n' + entry + '\n\n' + raw.slice(close + 3).replace(/^\s+/, '');
} else {
  out = entry + '\n\n' + raw.replace(/^\s+/, '');
}
fs.writeFileSync(ANN, out.replace(/\s*$/, '\n'));

/* ---- build, commit, push ---- */
execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { cwd: ROOT, stdio: 'inherit' });
git('add', '-A');
git('commit', '-m', 'Add announcement: ' + headline);
fs.writeFileSync(MARKER, git('rev-parse', 'HEAD') + '\n');

if (noPush) {
  console.log('\nAnnouncement committed. Run  git push  to put it on the site.');
} else {
  try {
    git('push', 'origin', git('rev-parse', '--abbrev-ref', 'HEAD'));
    console.log('\nAnnouncement posted - live in about a minute.');
  } catch (e) {
    console.error('\nAnnouncement committed, but the push failed:\n' + (e.stderr || e.message)
      + '\nRun  git push  to put it on the site.');
  }
}
