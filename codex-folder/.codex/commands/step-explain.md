Read `codex-folder/codex/Progress.md`, `codex-folder/codex/BuildFlow.md`, `codex-folder/codex/Codex_guide.md`, and `codex-folder/codex/ProjectSummary.md`.

Determine the current step like this:
- Find the current phase in `codex-folder/codex/Progress.md`
- Find the first unchecked checkbox `[ ]` in that phase
- If the user passed a number argument, explain that numbered step in the current phase instead
- If the user passed a name, find the closest matching step

Explain only that single step in this exact structure:

Step: `[checkpoint item text]`
What it means: `[1-2 short sentences in plain beginner language]`
What to edit or run: `[single file or command]`
Why it matters: `[1-2 short sentences]`
How to verify it: `[exact proof to show]`
Common beginner mistake: `[1 short concrete warning]`

Rules:
- Keep it brief.
- Do not ask Socratic questions unless the user explicitly asks for deeper explanation.
- Do not list future steps.
- If the user asks Codex to implement this step, show the planned code or diff before asking for approval.
- If the user then approves Codex to do this step after seeing the planned code or diff, make the scoped current-step change yourself and report back.
