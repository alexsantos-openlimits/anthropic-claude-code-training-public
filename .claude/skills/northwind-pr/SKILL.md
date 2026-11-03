---
name: northwind-pr
description: Write a pull request description for the work on the current branch in the Northwind team format (ticket title, plain-language summary, verified commands, honest acceptance criteria, deliberate exclusions). Use when the user asks to write, draft, or update a PR description for Northwind work, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work on this branch, in the team's format.

The description is for a reviewer who has not seen the work. Every claim in it must trace back to something that was actually done in this session or is visible in the repository.

## Output format

The title and body use these parts, in this order:

- **Title:** `<TICKET-ID>: <what it does>`. For example, `NWP-101: add export options`. Use the ticket's ID and a short phrase describing what the app can now do.
- **What changed:** one plain-language paragraph. Describe what the app can do now that it could not do before. Do not list files; the diff already does that.
- **How I verified it:** the actual commands that were run, each followed by what it printed (for example, the test summary line). Name any browser or manual check: what was clicked and what appeared. Include nothing that was not run.
- **Acceptance criteria:** the checkboxes copied from the ticket, verbatim. Tick only the ones that are fully met. For any partial one, leave it unticked and add a note saying which part is done and which is not.
- **Deliberately not done:** anything out of scope for the ticket, anything left for a follow-up, and any part of the acceptance criteria that is not met. Name the follow-up if one exists.

## Steps

### 1. Read the facts before writing anything

- `git diff main...HEAD --stat`, then the diff itself. This is what actually changed.
- `git log main..HEAD --oneline`. This is how the work was sequenced.
- The ticket in `docs/tickets/`, matching the ID in the branch name or commit subjects. Copy its acceptance criteria verbatim.
- Any spec in `docs/specs/` for the ticket, if one exists. Note where the build departed from it.

If the ticket cannot be found, stop and ask for the ticket ID. Do not invent one.

### 2. Establish what was verified

Build the verification section only from evidence in this session. Look for:

- Commands that were run and their output, such as `npm test`, `npx tsc --noEmit`, `npx next lint`, `curl`, and any `git` commands.
- Browser or UI checks that were performed, with the actions taken and what appeared on screen.

For each acceptance criterion, decide whether it was verified, checked by reading the code only, or not verified. Keep those three states separate in the description.

### 3. Write the description

Follow the output format above. Keep paragraphs short and use real bullets.

If a check was not run, do not write it under "How I verified it." Put it under "Deliberately not done" or in the acceptance-criteria note, and say it has not been run.

### 4. Print it and stop

Print the finished title and body. Do not run `gh pr create` or push anything. Opening a pull request is the user's decision, and they will say when to do it.

## Rules

- **Never claim a verification step that was not actually run.** If a test was not run, a check was not clicked, or a command's output was not seen, it does not appear as verified. A reviewer who finds an overclaim will stop trusting the rest of the description.
- **Report unmet criteria as unmet.** A partial criterion is unticked, with a note. Ticking it because the intent was there is an overclaim.
- **Plain language over ceremony.** "Ops can now export only the columns they choose" beats "implemented column selection functionality."
- **Commands are quoted exactly.** Copy the command and the relevant output line. Do not paraphrase a test result.
- **No emoji, no filler, no summary of the summary.** A repository attribution line required by a separate instruction is not part of this format and is not added here.
- **Scannable.** Short paragraphs, real bullets, one blank line between sections.
