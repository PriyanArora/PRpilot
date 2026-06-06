# P10 App Permission and Installation Hardening Walkthrough

## Manual Actions Still Needed

The P10 code is locally proven, but live GitHub App authorization evidence is still manual:

- Show accepted installed same-repo webhook logs.
- Show accepted fork PR webhook logs where the installed base repository is used for authorization.
- Show rejected non-installed repository events.
- Show rejected out-of-selected-scope events.
- Show stale or mismatched deep-action rejection from a real `check_run.requested_action` event.
- Show the GitHub App permission screen still matches the least-privilege matrix.

## P10.1 Enforce the documented permission matrix

The MVP permission matrix is now represented in code as `githubAppPermissionMatrix`.

File: `packages/github/installation-authorization.ts`

## P10.2 Resolve installation identity

`resolveInstallationIdentity` extracts installation ID, repository ID, and the authorization repository ID from supported event shapes.

File: `packages/github/installation-authorization.ts`

## P10.3 Accept installed same-repo repositories

`authorizeInstallationEvent` accepts events when the authorization repository is both installed and selected.

Local proof: `tests/unit/installation-authorization.test.ts`

## P10.4 Resolve fork PR context safely

Fork PRs authorize against the base repository, not `check_suite.pull_requests`.

File: `packages/github/installation-authorization.ts`

## P10.5-P10.6 Reject unauthorized paths

Authorization returns explicit reasons for non-installed repositories, unselected repositories, and disallowed installation IDs.

Local proof: `tests/unit/installation-authorization.test.ts`

## P10.7 Validate PRPilot-owned requested actions

Deep-scan actions are accepted only from `PRPilot Fast` or `PRPilot Deep` checks, with PRPilot `external_id` when present.

File: `packages/github/installation-authorization.ts`

## P10.8 Reject stale or mismatched deep-scan actions

Requested action SHAs must match the current PR head SHA before optional deep work starts.

Local proof: `tests/unit/installation-authorization.test.ts`

## P10.9-P10.12 Local Proof

Run:

```bash
npm test -- tests/unit/installation-authorization.test.ts
```

Expected local proof:

- Least-privilege matrix is documented in code.
- Installed selected same-repo events are accepted.
- Fork PRs authorize using base repository identity.
- Non-installed, unselected, and disallowed installation events are rejected.
- Fresh PRPilot-owned deep actions are accepted.
- Foreign checks, unsupported actions, stale SHAs, and invalid external IDs are rejected.
