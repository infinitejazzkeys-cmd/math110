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

Mail goes out through a **dedicated Gmail account** created just for this course —
nothing is needed from IDPL's IT staff.

1. **Make the account**, e.g. `math110.instituto@gmail.com`. Keep it separate from
   your personal Gmail: students and administrators will see this address for the
   rest of the semester, and you can reuse or hand it over later.
2. **Turn on 2-Step Verification** on that account, then generate an App Password at
   <https://myaccount.google.com/apppasswords>. Gmail will not issue one until
   2-Step Verification is on, and your normal password will *not* work for SMTP.
3. Copy `mail.config.example.json` to `mail.config.json` and fill in:
   - `from` — the new Gmail address
   - `fromName` — what students see, e.g. `Prof. Collins - MATH 110`
   - `replyTo` — your real `p.collins@idpl.org`, so replies reach your normal inbox
   - `recipients` — the 5 students and your administrator
4. **Store the app password**, encrypted:

   ```bash
   powershell -File setup-mail.ps1
   ```

   Encrypted with Windows DPAPI, tied to your Windows account on this machine.
5. **Send yourself a test:**

   ```bash
   npm run test-mail
   ```

   This goes only to you — never to the class.

Yahoo works the same way (`smtp.mail.yahoo.com`, port 587, app password) if you'd
rather use it. Gmail is the default because deliverability is reliable and the
app-password flow is better documented.

**Tell the class the address** in person or from your IDPL account first, so the
first message isn't mistaken for spam.

### Everyday use

**Publishing never emails anyone.** It shows you a draft of what the class *would*
receive, and nothing leaves your machine until you say so:

```bash
npm run publish-site     # publishes the site, prints a draft, sends nothing
npm run send-email       # NOW it goes to the class
```

That's deliberate. An email you forgot to send takes ten seconds to fix; one sent
to five students and an administrator at 9pm cannot be recalled.

| Command | What it does |
|---|---|
| `npm run publish-site` | Publish and draft the email — **sends nothing** |
| `npm run send-email` | Send the current draft to the class |
| `npm run discard-email` | Throw the draft away without sending |
| `npm run test-mail` | Send the draft to yourself only |
| `npm run preview-mail` | Print what would be sent, send nothing |

`publish-quiet` still works and is identical to `publish-site`.

**Drafts accumulate.** If you publish three times before sending, the draft covers
everything since your *last email*, not just the most recent publish — so nothing
quietly drops off the list. Sending resets that point; `discard-email` does not, so
a discarded item still shows up in the next draft.

The draft always lands in `email-draft.txt`, so if sending fails you can paste it
into Outlook. **A mail failure never fails the publish** — the site goes live either way.

Everyone is **BCC'd**, so students never see each other's addresses. You get a copy,
and because `replyTo` points at your IDPL address, their replies land in your normal
inbox — you never have to watch the Gmail account.

### If it stops working

- **`535` / "Username and Password not accepted"** — you used the normal password
  instead of the app password, or 2-Step Verification got switched off. Generate a
  fresh app password and re-run `setup-mail.ps1`.
- **Revoked app password** — if you ever change the Gmail password, existing app
  passwords stop working. Generate a new one and re-run setup.
- **Sending limits** — free Gmail allows roughly 500 recipients a day. With 6
  recipients you will not come close.

Nothing here depends on IDPL, so none of it can be switched off by their IT team.

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
