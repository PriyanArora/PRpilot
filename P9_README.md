# P9 Repository Policy Config Walkthrough

## Manual Actions Still Needed

The P9 code is locally testable, but the live repository-policy proof still needs real or controlled PR evidence:

- Show two PR runs with different `.prpilot.yml` configs.
- Show one invalid-config PR result that publishes an explicit non-pass operational result.
- Show one scanner mode change applied by policy only.
- Show one lane assignment change by config.
- Show one quota or opt-in policy example.
- Show one manual-vs-auto deep opt-in example.
- Show one case proving repo config cannot override a deployment-owner cap.

## P9.1 Reuse and validate deployment-owner runtime policy

P9 adds `validateRuntimePolicy` so repository overrides are applied only after the owner policy is known-good.

File: `packages/config/repository-policy.ts`

## P9.2 Define the `.prpilot.yml` schema

The repository policy supports `version`, `review`, `scanners`, `deep`, and `quotas`. Missing config is allowed and means defaults apply.

File: `packages/config/repository-policy.ts`

## P9.2a Hard-code allowed enum values

The schema fixes `draft_behavior`, scanner `mode`, and scanner `lane` to explicit values. Invalid values return clear errors.

File: `packages/config/repository-policy.ts`

## P9.2b Apply path precedence

`include_paths` filters first, then `ignore_paths` wins on overlap.

File: `packages/config/repository-policy.ts`

## P9.3 Load through the P4 owner-policy path

The resolver accepts the existing `RuntimePolicy` shape from P4 and validates it before any repository override is considered.

File: `packages/config/repository-policy.ts`

## P9.4 Parse repository config

`parseRepositoryPolicyConfig` supports a small `.prpilot.yml` subset plus JSON-compatible objects for tests.

File: `packages/config/repository-policy.ts`

## P9.5 Validate deployment-owner runtime policy

The validator checks required owner fields, selected repository IDs, budget mode, booleans, and quota caps.

File: `packages/config/repository-policy.ts`

## P9.6 Validate repository config

Repository config validation checks field types, arrays, scanner controls, deep controls, and quota values before resolving effective policy.

File: `packages/config/repository-policy.ts`

## P9.7 Apply threshold configuration

`internal.large-change` now accepts an optional threshold so repository policy can lower the warning threshold without changing default behavior.

File: `packages/rules/internal-large-change.ts`

## P9.8 Apply ignored and included paths

The repository policy helper filters changed files with include-first and ignore-wins behavior.

File: `packages/config/repository-policy.ts`

## P9.9 Show clear invalid-config output

Invalid config returns specific error strings such as invalid enum values or disallowed lane promotions.

Local proof: `tests/unit/repository-policy.test.ts`

## P9.10 Keep default behavior unchanged when repo file is missing

Passing `null` repository policy preserves defaults: draft behavior stays `skip_until_ready`, ESLint stays warn mode, and owner quotas apply.

Local proof: `tests/unit/repository-policy.test.ts`

## P9.11-P9.15 Scanner controls and warn-first rollout

P9 resolves scanner `enabled`, `mode`, `timeout_ms`, `lane`, and `warn_first`. Timeout values can only tighten the owner/default cap. Deep scanners cannot be promoted into the required fast lane, and blocking fast scanners cannot be moved out of fast.

File: `packages/config/repository-policy.ts`

## P9.16-P9.18 Deep opt-in and quotas

Manual deep scans obey the owner `manualDeepScanEnabled` flag. Automatic deep-on-PR requires owner auto-deep enablement and repository allowlist membership. Repository quotas can reduce owner caps but cannot raise them.

File: `packages/config/repository-policy.ts`

## P9.19-P9.20 Reject unsafe overrides

The resolver rejects disallowed lane promotions, timeout cap increases, auto-deep without owner allowlist, and quota values above owner caps.

Local proof: `tests/unit/repository-policy.test.ts`

## P9.21 Local Proof

Run:

```bash
npm test -- tests/unit/repository-policy.test.ts
```

Expected local proof:

- Valid `.prpilot.yml` subset parses.
- Invalid config reports clear errors.
- Owner runtime policy is validated before overrides.
- Missing repo config keeps defaults.
- Include/ignore path precedence works.
- Large-change threshold can be lowered.
- Scanner controls, warn-first rollout, and auto-deep opt-in resolve.
- Owner cap overrides and disallowed lane promotions are rejected.
