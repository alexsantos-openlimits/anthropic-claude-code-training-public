# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- `docs/tickets/` — the tickets engineers work, written as they arrive on a sprint board. There are several (`NWP-101`, `NWP-102`, `NWP-201`, plus `BACKLOG.md`); `build-battle/CLAUDE.md` only walks through NWP-201, so check which ticket the branch name refers to
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

Work is submitted as a pull request and scored automatically. Nobody has push access to the workshop repository: `/submit` pushes the branch to your fork and opens the PR against `JJFromTenex/claude-code-training` (see `.claude/skills/submit/SKILL.md`). It needs `gh auth status` to show a logged-in account. Never submit from `main`.

- Branch from `main` with the ticket ID: `NWP-201-issue-cards`
- Commit subjects carry the ticket ID: `NWP-201: issue virtual cards`
- Fill in the pull request template. The grader reads it.
