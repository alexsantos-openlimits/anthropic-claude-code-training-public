---
name: northwind-pr
description: Write a Northwind pull request description that meets the Release Standards — pasted test evidence, a business-impact line, honest criteria and a deliberately-not-done list. Use when opening or updating a PR on this repo, or when the user invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for this branch, in the format Northwind
reviewers expect.

This is not `/pr` with a house style. `/pr` tells you what to write.
This one **runs the checks first and writes only what it saw**, because the
three Release Standards in `CLAUDE.md` are checkable and a reviewer will check
them:

1. Test evidence before merge — the command and its output, pasted.
2. No direct commits to `main` — every change arrives through a PR.
3. A one-line business-impact summary at the top, in the reporter's language.

## What to do

### 1. Read the branch before you describe it

```bash
git log main..HEAD --oneline          # how it was sequenced
git diff main...HEAD --stat           # what moved
git diff main...HEAD                  # what it actually says
```

Then the ticket in `docs/tickets/`, the spec in `docs/specs/` if there is one,
and `docs/ORG-STANDARDS.md` for anything the diff touches.

If the branch has several commits, note which one is the ticket and which are
not. A reviewer scoring a ticket needs to know where it ends.

### 2. Run the checks. Now, not from memory.

```bash
cd build-battle/merchant-console
npm install        # a fresh clone or a new worktree has no node_modules
npm test
npx tsc --noEmit
npm run lint
```

Keep the output. You will paste the real summary line, not a paraphrase of it.

`sh: vitest: command not found` is not a failing suite. It means this checkout
has never had `npm install` run in it, which is the normal state of a worktree
you just created. Install, then run the checks again. Reporting that as a test
failure, or as "not run" without trying the install, is a bad reading of the
evidence.

**If a check did not run, the description says `not run`.** Not "should pass",
not silence. A claim about a check you did not run is the one thing that costs
more than a failing check.

### 3. Write it

Use `.github/pull_request_template.md`, every section filled, in this order.

**Title** — `<TICKET-ID>: <what it does>`, lower case after the colon, no
trailing period, under about 60 characters.

> `NWP-201: issue virtual cards from the console`

**The business-impact line** comes first, above the template's own headings,
in bold. One sentence, in the words the person who reported the ticket would
use: who is unblocked, and what it saves them. Standard 3 is not met by a
sentence that restates the diff.

> Bad: *Refactors the export route and adds a dialog.*
> Good: **Ops stops hand-editing exports before sending them to merchants —
> roughly 3–4 hours a month back.**

**What changed** — one short paragraph per commit group, plain language. What
can the console do now that it could not do before. Never a file list; the diff
is already that.

**How I verified it** — the pasted output, in a fenced block:

````
```
$ npm test
 Test Files  3 passed (3)
      Tests  54 passed (54)
```
````

Then the manual check: what you opened, what you clicked, what appeared. Then
the template's three checkboxes, ticked only for what you did.

**Acceptance criteria** — the ticket's checkboxes, copied verbatim, ticked
honestly. Half done is written as half done, naming which half. An unmet
criterion reported plainly reads as judgement; the same criterion left
unmentioned reads as a lie, and the reviewer finds it either way.

**Bugs fixed along the way** — anything found beyond the ticket, named by file
and root cause. A bug you found and deliberately did not fix belongs here too,
with the reason.

**Notes for the reviewer** — the judgement calls worth checking, then a
**deliberately not done** list. This section is required and must not be empty.
Every change leaves something out; saying so is the point. Scope you declined,
a stretch goal you skipped, a test you meant to write, a refactor you left
alone.

### 4. Check yourself before you hand it over

Read your own draft and answer these. Fix anything that fails, then print it.

- Does every claim about a check correspond to output you actually have?
- Does the business-impact line name a person and a cost, not a code change?
- Is every acceptance criterion accounted for, including the unmet ones?
- Is the deliberately-not-done list non-empty and specific?
- Does the title carry the ticket ID?
- Would the reviewer learn anything from this that the diff does not already say?

### 5. Offer to open or update it

Print the description. Then offer, and wait:

```bash
gh pr create --title "<TICKET-ID>: <what it does>" --body-file <file>
gh pr edit <n> --body-file <file>     # when the PR already exists
```

**Ask first, every time.** Opening or editing a pull request publishes text
under the user's name. That is their call, never yours, and a PR whose
description has drifted from its code is a Release Standards violation of its
own — so offer the edit whenever you push to a branch that already has one.

## Rules

- **Never write a check you did not run.** This is the whole point of the skill.
- **Plain language over ceremony.** "Ops can issue a card and see it in the
  list" beats "implemented card issuance functionality".
- **Paste, do not paraphrase.** `54 passed (54)` is evidence; "all tests pass"
  is a claim.
- **Say what you did not do.** Every time.
- **No emoji, no filler, no summary of the summary.**
