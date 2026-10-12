# MATH 110 course website

The site students see is generated from this folder. You never edit HTML — you drop
PDFs into `content/`, optionally type an announcement, and run one command.

---

## Posting new material (the 90% case)

1. **Copy the PDF into the right folder**, named `NN - Title.pdf`:

   | Folder | Shows up under | Example filename |
   |---|---|---|
   | `content/slides/` | Slides | `04 - Hypothesis Testing.pdf` |
   | `content/homework/` | Homework | `02 - Homework 2.pdf` |
   | `content/exams/` | Exams & Review | `01 - Midterm 1 Review.pdf` |
   | `content/handouts/` | Handouts | `02 - Z-Table.pdf` |

   The leading number controls the order on the page. The rest of the filename becomes
   the title students see, so `02 - Homework 2.pdf` displays as **Homework 2**.

2. **Publish:**

   ```bash
   npm run publish-site
   ```

   That builds the site, commits, and pushes. It's live about a minute later.

### Posting solutions

Give the solutions file the **same number** as the assignment and end the title with
`Solutions`:

```
content/homework/02 - Homework 2.pdf
content/homework/02 - Homework 2 Solutions.pdf
```

They collapse into one card with a **View / download** button and a **Solutions**
button — students don't see two separate entries. Same trick works in any folder
(`01 - Midterm 1.pdf` + `01 - Midterm 1 Solutions.pdf`).

---

## Writing an announcement

Edit `content/announcements.md`. Newest goes at the **top**. The format is one line
starting with `##`, then the date, then `—`, then the headline:

```markdown
## 2026-10-19 — Midterm 1 is in two weeks

Review material is posted under **Exams**. Office hours this week are extended to
5:00–6:30 PM on Wednesday.
```

You can use `**bold**`, `*italic*`, `[links](https://example.com)`, `- ` bullet lists,
and math between dollar signs: `$\binom{n}{k}$` renders as a real formula.

Delete old announcements whenever you like — nothing depends on them.

---

## Changing course info, dates, or the schedule

Everything else lives in **`site.config.json`**:

- `course` — your name, meeting times, room, office hours, contact email
- `units` — the topic list shown on the Syllabus page
- `grading` — the weights table
- `deadlines` — drives the **"Coming up"** panel on the home page. Dates are
  `YYYY-MM-DD`; `kind` is `homework`, `resub`, or `exam`
- `schedule` — the week-by-week table on the Schedule page

The home page and schedule recompute what's current from the student's own clock, so
"Coming up" and the "← this week" marker stay correct **without** rebuilding.

The syllabus prose is separate, in `content/syllabus/syllabus.md`. If you also want a
downloadable PDF, export one from Word into `content/syllabus/` and a download button
appears automatically.

---

## Previewing before you publish

```bash
npm start
```

Opens at <http://localhost:4110>. Ctrl+C to stop. Nothing is public until you run
`npm run publish-site`.

---

## ⚠ What must never go in `content/`

**This repository is public**, which is what makes free hosting work. Everything in
`content/` is readable by anyone with the link.

So never put in `content/`:

- graded student work or submissions
- the attendance roster or contact info
- grade spreadsheets
- anything else identifying a student

`npm run build` refuses to run if it sees a filename containing *graded*, *submission*,
*roster*, *grades*, *attendance*, *contact info*, or similar. That's a backstop, not a
guarantee — the filename is all it can check.

Search engines are asked not to index the site (`robots.txt` plus a `noindex` tag on
every page), so solutions won't turn up in Google for future semesters. But anyone with
the URL can read it. Treat the link as semi-private, not secret.

---

## How it fits together

```
site.config.json      course info, dates, schedule      ← you edit
content/              PDFs + announcements + syllabus    ← you edit
assets/styles.css     colors and layout                  ← tweak if you want
build.mjs             generator
serve.mjs             local preview server
publish.mjs           commit + push
docs/                 GENERATED — never edit by hand
```

`docs/` is what GitHub Pages serves. It's wiped and rebuilt on every build, so any
change you make there is lost.

No dependencies, no `npm install` — just Node.
