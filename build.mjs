#!/usr/bin/env node
/**
 * MATH 110 course site generator.
 *
 * Reads:   site.config.json  +  everything under content/
 * Writes:  docs/             (this is what GitHub Pages serves)
 *
 * No dependencies. Run with:  npm run build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const OUT     = path.join(ROOT, 'docs');

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const C   = cfg.course;

/* ------------------------------------------------------------------ helpers */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slug = s => String(s).toLowerCase().normalize('NFKD')
  .replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

const bytes = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB'
  : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';

/** "2026-11-04" -> "Wed, Nov 4". Parsed at local noon so the date never slips. */
function fmtDate(iso, opts) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US',
    opts || { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------- tiny markdown subset */
function inline(t) {
  return esc(t)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, txt, href) => '<a href="' + href + '">' + txt + '</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Block-level markdown: "## " headings, "- " bullets, paragraphs. */
function md(src) {
  const lines = src.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const out = [];
  let para = [], list = [];

  const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushL = () => {
    if (list.length) {
      out.push('<ul>' + list.map(li => '<li>' + inline(li) + '</li>').join('') + '</ul>');
      list = [];
    }
  };
  const flush = () => { flushP(); flushL(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    let m;
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      flush();
      const h = Math.min(m[1].length + 1, 4);
      out.push('<h' + h + '>' + inline(m[2]) + '</h' + h + '>');
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushP();
      list.push(m[1]);
    } else if (list.length && /^\s{2,}\S/.test(raw)) {
      list[list.length - 1] += ' ' + line.trim();   // continuation of a bullet
    } else {
      flushL();
      para.push(line.trim());
    }
  }
  flush();
  return out.join('\n');
}

/* ------------------------------------------------------------- categories */
const CATS = [
  {
    key: 'slides', nav: 'Slides', h1: 'Lecture Slides',
    lede: 'Slides for each unit, posted as we cover the material. Review these if you miss a class.',
    empty: 'No slides posted yet.',
  },
  {
    key: 'homework', nav: 'Homework', h1: 'Homework',
    lede: 'Assignments are handed out at the end of class on Wednesday and due at the beginning of class the following Monday. Solutions appear here once an assignment has been graded and returned.',
    empty: 'No assignments posted yet.',
  },
  {
    key: 'exams', nav: 'Exams', h1: 'Exams & Review',
    lede: 'Review material, practice problems, and past exams.',
    empty: 'No exam material posted yet.',
  },
  {
    key: 'handouts', nav: 'Handouts', h1: 'Handouts & Resources',
    lede: 'Reference sheets, worksheets, and anything else that does not fit the categories above.',
    empty: 'No handouts posted yet.',
  },
];

const NAV = [
  { href: 'index.html', label: 'Home' },
  ...CATS.map(c => ({ href: c.key + '.html', label: c.nav })),
  { href: 'schedule.html', label: 'Schedule' },
  { href: 'syllabus.html', label: 'Syllabus' },
];

/**
 * Scan a content folder into display items.
 *
 * Naming convention:  "01 - Homework 1.pdf"
 *   - the leading number sets the order (optional)
 *   - a file whose title ends in "Solutions" attaches to the item sharing its
 *     number, e.g. "01 - Homework 1 Solutions.pdf"
 */
function scan(key) {
  const dir = path.join(CONTENT, key);
  if (!fs.existsSync(dir)) return [];
  const items = new Map();

  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    if (name.startsWith('.') || /^README/i.test(name) || /\.md$/i.test(name)) continue;

    const ext   = path.extname(name);
    const base  = path.basename(name, ext);
    const m     = base.match(/^\s*(\d+)\s*[-–—.)]\s*(.+)$/);
    const order = m ? parseInt(m[1], 10) : 9999;
    let title   = (m ? m[2] : base).trim();

    const isSol = /\b(solutions?|answer key|answers)\s*$/i.test(title);
    if (isSol) title = title.replace(/\s*\b(solutions?|answer key|answers)\s*$/i, '').trim();

    const id = order === 9999 ? 't:' + title.toLowerCase() : 'o:' + order;
    if (!items.has(id)) items.set(id, { order, title, main: null, sol: null });

    const it = items.get(id);
    if (!isSol && title) it.title = title;

    const st = fs.statSync(full);
    const rec = {
      src: full,
      out: slug(title) + (isSol ? '-solutions' : '') + ext.toLowerCase(),
      size: st.size,
      mtime: st.mtime,
    };
    if (isSol) it.sol = rec; else it.main = rec;
  }

  return [...items.values()]
    .filter(it => it.main || it.sol)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function copyItems(key, items) {
  const dest = path.join(OUT, 'files', key);
  fs.mkdirSync(dest, { recursive: true });
  for (const it of items) {
    for (const rec of [it.main, it.sol]) {
      if (rec) fs.copyFileSync(rec.src, path.join(dest, rec.out));
    }
  }
}

function cardHTML(key, it) {
  const shown = it.main || it.sol;
  const meta = [];
  if (shown) {
    meta.push(bytes(shown.size));
    meta.push('posted ' + shown.mtime.toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }));
  }

  const btns = [];
  if (it.main) btns.push('<a class="btn primary" href="files/' + key + '/' + it.main.out + '">View / download</a>');
  if (it.sol)  btns.push('<a class="btn" href="files/' + key + '/' + it.sol.out + '">Solutions</a>');

  return '<div class="card">\n'
    + '  <div class="ct">' + esc(it.title) + '</div>\n'
    + '  <div class="cm">' + esc(meta.join(' · ')) + '</div>\n'
    + '  <div class="btns">' + btns.join('') + '</div>\n'
    + '</div>';
}

/* ------------------------------------------------------------- page shell */
function page({ title, active, body, h1, lede }) {
  const nav = NAV.map(n =>
    '<a href="' + n.href + '"' + (n.href === active ? ' aria-current="page"' : '') + '>'
    + esc(n.label) + '</a>'
  ).join('');

  const updated = fmtDate(new Date().toISOString().slice(0, 10),
    { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} &middot; ${esc(C.code)} ${esc(C.term)}</title>
<link rel="icon" href="assets/logo.jpg">
<link rel="stylesheet" href="assets/styles.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
</head>
<body>
<header class="site-head"><div class="wrap">
  <a href="index.html"><img src="assets/logo.jpg" alt="${esc(C.institution)}"></a>
  <div class="ht">
    <div class="code"><a href="index.html">${esc(C.code)} &mdash; ${esc(C.title)}</a></div>
    <div class="sub">${esc(C.institution)} &middot; ${esc(C.term)} &middot; ${esc(C.instructor)}</div>
  </div>
</div></header>

<nav class="site-nav"><div class="wrap">${nav}</div></nav>

<main><div class="wrap">
${h1 ? '<h1>' + esc(h1) + '</h1>' : ''}
${lede ? '<p class="lede">' + inline(lede) + '</p>' : ''}
${body}
</div></main>

<footer class="site-foot"><div class="wrap">
  <div><strong>${esc(C.institution)}</strong> &middot; 2520 S. Western Avenue, Chicago, IL 60608 &middot; 773-890-0055</div>
  <div>${esc(C.code)} ${esc(C.term)} &middot; ${esc(C.instructor)}</div>
  <div style="margin-top:8px">Course materials for enrolled students. Last updated ${updated}.</div>
</div></footer>

<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"
  onload="try{renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false})}catch(e){}"></script>
</body>
</html>
`;
}

/* ---------------------------------------------------------- safety guard */
/**
 * Everything under content/ becomes publicly readable on the internet.
 * Student work and records must never land there, so refuse to build if a
 * filename looks like one. Rename the file if a match is a false positive.
 */
const FORBIDDEN = /graded|submission|roster|grades|gradebook|attendance|contact.?info|fingerprint|\bssn\b|transcript/i;

function auditContent(dir, hits = []) {
  if (!fs.existsSync(dir)) return hits;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) auditContent(full, hits);
    else if (FORBIDDEN.test(name)) hits.push(path.relative(ROOT, full));
  }
  return hits;
}

const unsafe = auditContent(CONTENT);
if (unsafe.length) {
  console.error('\nBUILD STOPPED - these files under content/ look like student records,\n'
    + 'and everything under content/ gets published publicly:\n');
  for (const f of unsafe) console.error('  ' + f);
  console.error('\nMove them out of content/, or rename them if this is a false alarm.\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ build */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) {
  fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(OUT, 'assets', f));
}

const scanned = {};
for (const cat of CATS) {
  scanned[cat.key] = scan(cat.key);
  copyItems(cat.key, scanned[cat.key]);
}

/* ---- category pages ---- */
const hwTotal = cfg.deadlines.filter(d => d.kind === 'homework').length;

for (const cat of CATS) {
  const items = scanned[cat.key];
  let body = items.length
    ? items.map(it => cardHTML(cat.key, it)).join('\n')
    : '<p class="empty">' + esc(cat.empty) + '</p>';

  if (cat.key === 'homework' && items.length && items.length < hwTotal) {
    body += '<p class="lede" style="margin-top:18px">Assignments '
      + (items.length + 1) + '–' + hwTotal
      + ' will appear here as the semester progresses.</p>';
  }

  fs.writeFileSync(path.join(OUT, cat.key + '.html'), page({
    title: cat.h1, active: cat.key + '.html', h1: cat.h1, lede: cat.lede, body,
  }));
}

/* ---- home: announcements ---- */
const annSrc = path.join(CONTENT, 'announcements.md');
let annHTML = '';
if (fs.existsSync(annSrc)) {
  const raw = fs.readFileSync(annSrc, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  annHTML = raw.split(/^##\s+/m).slice(1).map(b => {
    const nl   = b.indexOf('\n');
    const head = (nl === -1 ? b : b.slice(0, nl)).trim();
    const rest = nl === -1 ? '' : b.slice(nl + 1);
    const dm   = head.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/);
    const when = dm ? fmtDate(dm[1], { weekday: 'long', month: 'long', day: 'numeric' }) : '';
    const titleTxt = dm ? dm[2] : head;

    return '<article class="ann">\n'
      + (when ? '  <div class="ad">' + esc(when) + '</div>\n' : '')
      + '  <h3>' + inline(titleTxt) + '</h3>\n'
      + md(rest) + '\n'
      + '</article>';
  }).join('\n');
}

const tiles = CATS.map(c => {
  const n = scanned[c.key].length;
  return '<a class="tile" href="' + c.key + '.html">\n'
    + '  <div class="tt">' + esc(c.nav) + '</div>\n'
    + '  <div class="tc">' + (n ? n + (n === 1 ? ' item' : ' items') : 'Nothing posted yet') + '</div>\n'
    + '</a>';
}).join('');

const contactOK = C.contactEmail && !/^REPLACE/i.test(C.contactEmail);
const emailRow = contactOK
  ? '<dt>Email</dt><dd><a href="mailto:' + esc(C.contactEmail) + '">' + esc(C.contactEmail) + '</a></dd>'
  : '';

const gradingTable = '<div class="tw"><table>\n'
  + '<thead><tr><th>Component</th><th>Weight</th></tr></thead>\n<tbody>\n'
  + cfg.grading.map(g => '<tr><td>' + esc(g.component) + '</td><td>' + g.weight + '%</td></tr>').join('\n')
  + '\n<tr><td><strong>Total</strong></td><td><strong>'
  + cfg.grading.reduce((s, g) => s + g.weight, 0) + '%</strong></td></tr>\n'
  + '</tbody>\n</table></div>';

const homeBody = `
<div class="panel">
  <h2>Coming up</h2>
  <div id="nextup-list"><p class="lede" style="margin:0">Loading&hellip;</p></div>
</div>

<h2>Course materials</h2>
<div class="grid">${tiles}</div>

<h2>Announcements</h2>
${annHTML || '<p class="empty">No announcements yet.</p>'}

<h2>Course information</h2>
<dl class="info">
  <dt>Instructor</dt><dd>${esc(C.instructor)}</dd>
  <dt>Class meetings</dt><dd>${esc(C.meetings)}</dd>
  <dt>Location</dt><dd>${esc(C.location)}</dd>
  <dt>Office hours</dt><dd>${esc(C.officeHours)}</dd>
  ${emailRow}
</dl>

<h2>Grading</h2>
${gradingTable}

<script id="deadlines" type="application/json">${JSON.stringify(cfg.deadlines)}</script>
<script>
(function () {
  var all;
  try { all = JSON.parse(document.getElementById('deadlines').textContent); }
  catch (e) { return; }

  var now   = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  var LABEL = { exam: 'Exam', homework: 'Homework', resub: 'Resubmission' };

  function at(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }

  var up = all
    .filter(function (d) { return at(d.date).getTime() >= today.getTime(); })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
    .slice(0, 4);

  var el = document.getElementById('nextup-list');
  if (!el) return;

  if (!up.length) {
    el.innerHTML = '<p class="lede" style="margin:0">Nothing left on the calendar \\u2014 have a great break.</p>';
    return;
  }

  el.innerHTML = up.map(function (d) {
    var dt   = at(d.date);
    var days = Math.round((dt.getTime() - today.getTime()) / 86400000);
    var rel  = days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
    var when = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return '<div class="due"><div class="dl">' + d.label
      + '<span class="tag ' + d.kind + '">' + (LABEL[d.kind] || d.kind) + '</span>'
      + (d.detail ? '<span class="det">' + d.detail + '</span>' : '')
      + '</div><div class="dd">' + when + '<br>' + rel + '</div></div>';
  }).join('');
})();
</script>
`;

fs.writeFileSync(path.join(OUT, 'index.html'), page({
  title: 'Home',
  active: 'index.html',
  h1: C.code + ': ' + C.title,
  lede: C.description,
  body: homeBody,
}));

/* ---- schedule ---- */
const rows = cfg.schedule.map((s, i, arr) => {
  const firstOfWeek = i === 0 || arr[i - 1].week !== s.week;
  return '<tr data-date="' + s.date + '" data-week="' + s.week + '"'
    + (s.highlight ? ' class="hl"' : '') + '>\n'
    + '  <td class="wk">' + (firstOfWeek ? 'Week ' + s.week : '') + '</td>\n'
    + '  <td class="dt">' + esc(s.day) + ' ' + fmtDate(s.date, { month: 'numeric', day: 'numeric' }) + '</td>\n'
    + '  <td>' + inline(s.content) + '</td>\n'
    + '</tr>';
}).join('\n');

const scheduleBody = `<div class="tw"><table>
<thead><tr><th>Week</th><th>Date</th><th>Content</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
<script>
(function () {
  var now   = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var rows  = [].slice.call(document.querySelectorAll('tr[data-date]'));
  var curWeek = null;

  rows.forEach(function (tr) {
    var p = tr.getAttribute('data-date').split('-');
    var t = new Date(+p[0], +p[1] - 1, +p[2], 12).getTime();
    if (t < today) tr.classList.add('past');
    else if (curWeek === null) curWeek = tr.getAttribute('data-week');
  });

  if (curWeek !== null) {
    var inWeek = rows.filter(function (tr) { return tr.getAttribute('data-week') === curWeek; });
    if (inWeek.length) inWeek[0].classList.add('now');
  }
})();
</script>`;

fs.writeFileSync(path.join(OUT, 'schedule.html'), page({
  title: 'Schedule',
  active: 'schedule.html',
  h1: 'Course Schedule',
  lede: C.meetings + '. ' + C.location + '.',
  body: scheduleBody,
}));

/* ---- syllabus ---- */
const sylDir = path.join(CONTENT, 'syllabus');
const sylMd  = path.join(sylDir, 'syllabus.md');
const sylFiles = fs.existsSync(sylDir)
  ? fs.readdirSync(sylDir).filter(f =>
      !/\.md$/i.test(f) && !f.startsWith('.') && !/^README/i.test(f)
      && fs.statSync(path.join(sylDir, f)).isFile())
  : [];

if (sylFiles.length) {
  fs.mkdirSync(path.join(OUT, 'files', 'syllabus'), { recursive: true });
  for (const f of sylFiles) {
    fs.copyFileSync(path.join(sylDir, f), path.join(OUT, 'files', 'syllabus', f.replace(/\s+/g, '-')));
  }
}

const dlBtns = sylFiles.length
  ? '<div class="btns" style="margin-bottom:24px">'
    + sylFiles.map(f => '<a class="btn primary" href="files/syllabus/' + f.replace(/\s+/g, '-')
        + '">Download ' + esc(path.extname(f).replace('.', '').toUpperCase()) + '</a>').join('')
    + '</div>'
  : '';

const unitsHTML = '<h2>Course Topics</h2>\n'
  + cfg.units.map((u, i) => '<h3>' + (i + 1) + '. ' + esc(u.name) + '</h3>\n<ul>'
      + u.topics.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>').join('\n');

fs.writeFileSync(path.join(OUT, 'syllabus.html'), page({
  title: 'Syllabus',
  active: 'syllabus.html',
  h1: 'Syllabus — ' + C.code + ' ' + C.term,
  lede: C.instructor + ' · ' + C.meetings + ' · ' + C.location,
  body: dlBtns
    + '<dl class="info" style="margin-bottom:26px">'
    + '<dt>Office hours</dt><dd>' + esc(C.officeHours) + '</dd>'
    + emailRow
    + '</dl>'
    + (fs.existsSync(sylMd) ? md(fs.readFileSync(sylMd, 'utf8')) : '')
    + '<h2>Grading</h2>' + gradingTable
    + unitsHTML
    + '<hr><p class="lede">The full week-by-week calendar is on the '
    + '<a href="schedule.html">Schedule</a> page.</p>',
}));

/* ---- housekeeping ---- */
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

/* ---- report ---- */
let total = 0;
console.log('Built docs/');
for (const c of CATS) {
  const its = scanned[c.key];
  total += its.length;
  const names = its.map(i => i.title + (i.sol ? ' (+solutions)' : '')).join(', ');
  console.log('  ' + c.nav.padEnd(10) + String(its.length).padStart(2) + ' item(s)'
    + (its.length ? '  - ' + names : ''));
}
console.log('  ' + 'Syllabus'.padEnd(10) + String(sylFiles.length).padStart(2) + ' download(s)');
console.log('\n' + total + ' material(s), ' + NAV.length + ' pages. Preview with: npm start');
