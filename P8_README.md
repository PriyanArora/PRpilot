# P8 Main Feature Validation Walkthrough

## Manual Actions Still Needed

P8 is a live validation phase, not a local implementation phase. Before declaring the G8 gate proven, show concrete external evidence for:

- The selected real validation repository, including repository ID and GitHub App installation scope.
- A real failing PR that triggers a blocking `PRPilot Fast` result.
- Webhook ingress logs from real GitHub delivery data.
- Check-run publication inside the target window on at least 3 real runs.
- Branch protection blocking the failing PR because `PRPilot Fast` failed.
- A fix commit that makes `PRPilot Fast` pass.
- A successful merge after the passing required check.
- One `PRPilot Deep` result or explicit deep-lane disabled/denied result that does not change the fast-lane outcome.
- One graceful operational edge case, such as unsupported repository, oversized run, quota denial, or another already-implemented required-path gap.

Do not mark P8 complete from local tests alone. The proof must come from GitHub UI, webhook logs, AWS or local queue/worker logs, check-run URLs, timestamps, and copied query or console output where relevant.

This file explains the P8 work in order. P8 ties together the P5 check publisher, P6 queue/worker path, and P7 persistence path on a real pull request.

## P8.1 Choose the selected real repository used for validation

Pick one repository that is installed for the private GitHub App and is inside the selected repository allowlist. The MVP supported-repo contract requires a root `package.json` and `package-lock.json`.

Evidence to capture:

```text
Repository full name:
Repository ID:
GitHub App installation ID:
Selected repository scope shown:
Root package.json present:
Root package-lock.json present:
Branch protection requires PRPilot Fast:
```

## P8.2 Open a real failing pull request

Open a real PR against the selected repository. Use a safe deterministic blocker. Good options are:

- Change `package.json` without changing `package-lock.json`, which should trigger `internal.lockfile-drift`.
- Change a `.github/workflows/*.yml` file, which should trigger `internal.sensitive-file-change`.
- Change `.env.example`, which should trigger `internal.sensitive-file-change`.

Do not add real secrets or credentials to create the failure.

Evidence to capture:

```text
PR URL:
PR number:
Base branch:
Head branch:
Head SHA:
Blocking file changed:
Expected blocker rule:
```

## P8.3 Show the webhook reached the system on real data

Use the live webhook logs, local `npm run webhook:dev` logs through a tunnel, or CloudWatch logs if the live path is deployed. The log must show the GitHub delivery ID, event name, repository identity, PR number, and head SHA.

Evidence to capture:

```text
GitHub delivery ID:
Event:
Action:
Repository ID:
Repository full name:
PR number:
Head SHA:
Webhook received at:
```

## P8.4 Show the required deterministic check was published inside the target window

`PRPilot Fast` is the required merge-gate check. It must publish for the same PR head SHA that arrived through the webhook.

Evidence to capture:

```text
Check name: PRPilot Fast
Check URL:
Head SHA:
Conclusion:
Webhook received at:
Check completed at:
Latency:
Target met: yes/no
```

## P8.4a Measure webhook-to-check latency across at least 3 real runs

Record the time from webhook receipt to completed check publication. Use three real deliveries or reruns.

Evidence table:

```text
Run | Delivery ID | Head SHA | Webhook received at | Check completed at | Latency | Conclusion
1   |             |          |                     |                    |         |
2   |             |          |                     |                    |         |
3   |             |          |                     |                    |         |
```

The phase target is that normal PRs complete within the documented required-check window. If one run misses the target, keep the evidence and explain the reason instead of hiding it.

## P8.5 Show a critical finding blocks the merge

The failing PR must show `PRPilot Fast` with `failure`, and branch protection must prevent merging while that required check is failing.

Evidence to capture:

```text
Branch protection rule requires PRPilot Fast:
PRPilot Fast conclusion: failure
Blocking rule ID:
Merge UI blocked: yes
Screenshot or copied GitHub UI text:
```

## P8.6 Fix the pull request

Push a fix commit that removes the blocking condition. For lockfile drift, update `package-lock.json` together with `package.json`. For sensitive-file-change proof, remove or revert the sensitive file change.

Evidence to capture:

```text
Fix commit SHA:
Files changed by fix:
Blocking condition removed:
```

## P8.7 Show the fast-lane check passes after the fix

The fixed PR head SHA must receive a new or updated `PRPilot Fast` check with `success`.

Evidence to capture:

```text
Fixed head SHA:
Check URL:
Conclusion: success
Blocking findings: 0
Coverage gaps: 0
```

## P8.8 Show the merge succeeds after the fix

After `PRPilot Fast` passes, merge the PR and capture the merge evidence.

Evidence to capture:

```text
Merged PR URL:
Merged commit SHA:
Merged at:
Required check at merge time: PRPilot Fast success
```

## P8.9 Show one optional deep-lane result or explicit denial

Deep lane is optional and must not change the required fast-lane result. Show either a `PRPilot Deep` result or an explicit disabled/denied deep-lane summary.

Evidence to capture:

```text
Fast-lane head SHA:
Fast-lane conclusion before deep action:
Deep action or denial:
PRPilot Deep conclusion, if published:
Fast-lane conclusion after deep action:
Fast lane unchanged: yes/no
```

## P8.10 Show one graceful failure-handling example

Pick one already-implemented edge case and show that PRPilot reports it honestly instead of publishing a false success.

Good P8 candidates:

- Unsupported repository: missing root `package.json` or `package-lock.json`.
- Oversized run: changed-file or diff-size limit exceeded.
- Quota denial: fast-lane or deep-lane quota exhausted.
- Required-path runtime gap: failed freshness check or applicable scanner coverage gap.

Because repository policy config is not implemented until P9, do not use invalid `.prpilot.yml` as P8 proof unless the live path already has that behavior.

Evidence to capture:

```text
Edge case:
PR or delivery URL:
Expected conclusion:
Actual conclusion:
Summary names the operational reason:
No false success published: yes/no
```

## P8 Completion Rule

P8 can be called complete only when the evidence above is attached to the project notes and the P8 checklist in `codex-folder/codex/Progress.md` is updated with concrete proof. Until then, P8 is documented but live proof remains pending.
