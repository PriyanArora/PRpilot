Quick next-step check only.

Read `codex-folder/codex/Progress.md` and `codex-folder/codex/BuildFlow.md`.

Find:
- the current phase
- the first unchecked checkbox `[ ]` inside that phase

Reply in exactly this shape:

Current phase: `P[N] — [Name]`
Next step: `[first unchecked checkbox text]`
What it means: `[1 short plain-language sentence]`
Do this now: `[single exact command to run, or the single file to create/edit next]`
Proof to show next: `[one concrete observable result]`

Rules:
- Keep it brief.
- Do not ask a question unless the user explicitly asks for explanation.
- Do not list future steps.
- Assume the student is a beginner and keep the wording plain.
- Do not auto-run checks just because the user says a step is done.
- If the user explicitly says "check it", run the local proof command yourself instead of asking them to paste local output.
- If the user asks Codex to implement the step, show the planned code or diff before asking for approval.
- If the user approves Codex to do the explained step after seeing the planned code or diff, make the scoped current-step change yourself and report back.
