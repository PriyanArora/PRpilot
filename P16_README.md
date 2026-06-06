# P16 Documentation and Demo Readiness Walkthrough

## Manual Actions Still Needed

P16 documentation is written and locally checked. Manual follow-up remains:

- Run the five-minute demo script end-to-end against the live selected repository without manual patching.
- Rehearse one incident scenario with the operations runbook.
- Record the incident timeline and evidence.

## P16.1-P16.4 Setup Guides

Added:

- `docs/self-host-quickstart.md`
- `docs/local-setup.md`
- `docs/live-deployment.md`
- `docs/github-app-and-aws-setup.md`

These cover local proof, live CDK deployment, Parameter Store expectations, GitHub App permissions, and user-owned AWS setup.

## P16.5-P16.8 Architecture Docs

Added:

- `docs/security-architecture.md`
- `docs/cost-control.md`
- `docs/reliability-architecture.md`

These explain webhook trust, selected scope, idempotency, secret storage, runtime-policy precedence, queue behavior, persistence, retry, DLQ, and budget modes.

## P16.9-P16.10 Demo Script

Added `docs/five-minute-demo.md` with the live demo sequence and local dry-run commands.

Running the full live demo remains manual because it requires deployed AWS resources and a real protected GitHub PR.

## P16.11-P16.14 Runbooks

Added:

- `docs/operations-runbook.md`
- `docs/recovery-drill.md`
- `docs/secret-rotation.md`
- `docs/approaching-limits-policy.md`

## P16.15-P16.16 Incident Rehearsal

Added `docs/incident-rehearsal.md` with a DLQ incident scenario and timeline template.

The actual rehearsal and evidence capture remain manual.

## Local Proof

Run:

```bash
npm test -- tests/unit/docs-readiness.test.ts
npm run typecheck
npm run lint
npm test
```
