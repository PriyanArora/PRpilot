# Five-Minute Demo Script

## Setup

Use one selected repository with branch protection requiring `PRPilot Fast`.

## Script

1. Show the GitHub App permission matrix.
2. Show the CDK outputs and Parameter Store names.
3. Open a PR that changes a sensitive path.
4. Show webhook delivery reaching PRPilot.
5. Show `PRPilot Fast` publishing a blocking result.
6. Show branch protection blocking merge.
7. Fix the PR.
8. Show `PRPilot Fast` passing.
9. Show the PR can merge.
10. Trigger or deny `PRPilot Deep` and explain why it does not affect the required fast lane.

## Dry Run Check

Before a live demo, run local proof:

```bash
npm run typecheck
npm run lint
npm test
npm run infra:synth
```
