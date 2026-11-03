# Claude Code Training — Repo Rescue

Training repository for the Repo Rescue workshop. Learners take a ticket end to end against the Northwind Payments merchant console, then open a pull request here to be scored.

Context in this repo is layered on purpose, and the layering is part of what the workshop teaches:

| File | Scope | What belongs in it |
| --- | --- | --- |
| `CLAUDE.md` (this file) | Every session | What the repo is, where things live, how work is submitted |
| `build-battle/CLAUDE.md` | The exercise | The ticket, the order of operations, what is preloaded |
| `build-battle/merchant-console/CLAUDE.md` | The application | Codebase conventions and card rules |
| `build-battle/merchant-console/.claude/rules/*.md` | Matching files only | Detail that would be noise until you open that kind of file |

Read the narrowest one that applies before you write code.

## Repository layout

- `docs/tickets/` — the tickets engineers work, written as they arrive on a sprint board
- `docs/specs/` — where plans go before code does, and the template they follow
- `docs/ORG-STANDARDS.md` — the org-wide engineering standards every service is measured against
- `.claude/` — the skills (`/spec`, `/pr`, `/ship-ready`) and the `bug-investigator` subagent. Open Claude Code at this root and they are available everywhere
- `build-battle/` — the exercise brief and the scoring rubric
- `build-battle/merchant-console/` — Northwind Payments, the application itself
- `.github/` — pull request template and the grading workflow

## Conventions

- Plan before you build. `/spec` turns a ticket into a written plan that cites real files; it is scored.
- Read before you edit. A second implementation of an existing helper is a defect, not a shortcut.
- Never edit seed data to make a failing case disappear.
- Nothing in this repository may resemble real payment data. Generated card numbers use the `4242` test BIN.

## Submissions

Work is submitted as a pull request against this repository and scored automatically.

- Branch from `main` with the ticket ID: `NWP-201-issue-cards`
- Commit subjects carry the ticket ID: `NWP-201: issue virtual cards`
- Fill in the pull request template. The grader reads it.

## Release Standards

Three rules every change is held to on its way to `main`. Each names what a
violation looks like, so a reviewer can cite it.

1. **Test evidence before merge.** A pull request states the command that was run
   and the result it produced — the `npm test` summary line, pasted. "Tests pass"
   without the output is not evidence, and a claim about a check that was not run
   is the violation, not the failing check.
2. **No direct commits to `main`.** Every change reaches `main` through a pull
   request from a ticket branch. A commit whose first parent is `main` and that
   belongs to no PR is a violation, however small the change.
3. **Every pull request carries a one-line business-impact summary.** One sentence,
   at the top of the description, in the language the person who reported the ticket
   would use: who is unblocked and what it saves them. A summary that only restates
   the diff ("refactors the export route") does not meet this.
