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

## Emailing the class automatically

When you publish, the site works out what changed and emails the class from your
IDPL address. Nothing is sent if only internal things changed (a typo in the build
script, say) — only new or updated student-facing material and new announcements.

### One-time setup

1. Copy `mail.config.example.json` to `mail.config.json` and put your real
   recipients in it — the 5 students and your administrator.
2. Store your password, encrypted:

   ```bash
   powershell -File setup-mail.ps1
   ```

   It prompts you; the password is encrypted with Windows DPAPI, tied to your
   Windows account on this machine. **If your account uses MFA you need an
   app password, not your normal one.**
3. Send yourself a test:

   ```bash
   npm run test-mail
   ```

   This goes only to you — never to the class.

### Everyday use

`npm run publish-site` now does: build → commit → push → draft the email → send it.

| Command | What it does |
|---|---|
| `npm run publish-site` | Publish **and** email the class |
| `npm run publish-quiet` | Publish, write the draft, **send nothing** |
| `npm run test-mail` | Send the current draft to yourself only |
| `npm run preview-mail` | Print what would be sent, send nothing |

Use `publish-quiet` for small corrections you don't want to email about.

The draft always lands in `email-draft.txt`, so if sending fails you can paste it
into Outlook. **A mail failure never fails the publish** — the site goes live either way.

Everyone is **BCC'd**, so students never see each other's addresses. You get a copy.

### If it stops working

Two likely causes:

- **IDPL has SMTP AUTH disabled for your mailbox.** You'll see a `5.7.30` or
  `SmtpAuthenticationDisabled` error. Ask IT to enable "Authenticated SMTP" for
  your account, or fall back to pasting `email-draft.txt`.
- **It's past December 2026.** Microsoft is disabling basic authentication for
  SMTP by default at the end of that month. It should last through this semester,
  but it will need revisiting afterward.

### What must never be committed

`mail.config.json` (student addresses) and `mail.cred.xml` (your password) are
git-ignored, and `npm run publish-site` refuses to run if either ever becomes
tracked. This repository is public — that matters.

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
