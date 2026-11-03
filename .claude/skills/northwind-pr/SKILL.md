---
name: northwind-pr
description: Write a pull request description in Marcus's house format for a Northwind branch, from the branch's real diff, commits, ticket, and verification evidence. Use when the user asks for a PR description, asks to fix a bounced PR description, or invokes /northwind-pr with an optional branch name.
---

# /northwind-pr

Write the pull request description the way Marcus wants it, every time, without anyone retyping the format from memory.

## Usage

```
/northwind-pr                          # the current branch
/northwind-pr NWP-101-export-options   # another branch in this repository
```

Worktrees share one repository, so a branch checked out in another worktree can be read from here with `git diff main...<branch>` and `git log main..<branch>`. Do not check it out.

## The house format

1. **Title**: `<TICKET-ID>: <what it does>`, for example `NWP-101: add export options`. The ticket ID comes from the branch name.
2. **What changed**: plain language, one short paragraph. What can someone do now that they could not before.
3. **How I verified it**: the commands that were run and what they printed, and what was clicked and what appeared.
4. **Acceptance criteria**: the ticket's checkboxes, copied verbatim, ticked only when the code meets them.
5. **What I left out**: anything not done, half done, or deliberately skipped, and why.

Use `.github/pull_request_template.md` as the skeleton and put these five into its sections. Where the template has a section the format does not (for example "Bugs fixed along the way"), fill it from the diff or write "None".

## What to do

### 1. Gather the facts

- The branch: the argument, or `git branch --show-current`.
- `git diff main...<branch> --stat`, then the diff itself.
- `git log main..<branch> --format='%h %s%n%b'`: commit subjects and bodies.
- The ticket: `docs/tickets/<TICKET-ID>.md`, read from the branch with `git show <branch>:docs/tickets/<TICKET-ID>.md`.
- The spec, if one exists on the branch: `docs/specs/<TICKET-ID>-*.md`.
- An existing PR, if there is one: `gh pr list --repo tenex-labs/anthropic-claude-code-training-public --state open --author @me --head <branch> --json number,url,body`. Keep `--author @me`: every learner uses the same branch names, so `--head` alone returns other people's PRs. Its body is evidence of what was already verified; its format is what Marcus bounced.

### 2. Collect verification evidence, and only evidence

Verification is the section Marcus reads hardest. Fill it only from things you can point at:

- A command you run now, with its output: `npm test` in `build-battle/merchant-console`, `npm run lint`, a `curl` against the dev server if it is running.
- Verification stated in the existing PR body or in commit messages, attributed as such.
- Something the user tells you in this conversation.

If a check has no evidence, leave it unticked and write "Not verified" next to it. Never write that something was clicked, run, or observed unless one of the sources above says so.

### 3. Tick the acceptance criteria honestly

Copy each criterion from the ticket word for word. For each, find the code in the diff that meets it.

- Met: tick it and name the file.
- Partly met: leave it unticked and say which part is missing.
- Not met: leave it unticked and say so.

### 4. Write it and show it

Write the description to a file in the scratchpad or a temp directory, not in the repository, and print it in full.

If a PR already exists for the branch, offer to update it:

```bash
gh pr edit <number> --repo <owner/repo> --title "<TICKET-ID>: <what it does>" --body-file <file>
```

Otherwise offer `gh pr create` with the same title and body file. Ask before running either. Changing a pull request is the user's call.

## Rules

- **Plain language.** "Ops can choose which columns go into the export" beats "implemented configurable export column selection".
- **No invented verification.** Not run means not written. A blank is honest; a guess is not.
- **Say what was left out.** Unfinished work, known rough edges, bugs noticed and not fixed. Stating a limit is part of the format.
- **One ticket per PR.** If the diff touches things outside the ticket, list them under "What I left out" or the reviewer notes; do not hide them in "What changed".
- **Scannable.** Short paragraphs and real bullets. No emoji, no filler, no summary of the summary.
