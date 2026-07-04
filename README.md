<div align="center">

<img src="assets/logo.png" alt="PRPilot" width="440" />

### Reviews your pull request before a human has to.

*Self-hosted. Free-tier first. Deterministic. Honest when it can't help.*

![status](https://img.shields.io/badge/status-MVP-blue)
![runtime](https://img.shields.io/badge/runtime-Node.js%2022-green)
![infra](https://img.shields.io/badge/infra-AWS%20CDK-orange)
![cost](https://img.shields.io/badge/target%20cost-%240--%245%2Fmo-brightgreen)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

</div>

---

## What is PRPilot?

PRPilot is a self-hosted GitHub App that posts structured feedback on a pull request before a human reviewer has to spend time on the avoidable stuff.

It's meant for students and early-career developers who don't have a senior engineer looking over every PR. Instead of handing your code to some SaaS, you deploy PRPilot into your own AWS account, connect a private GitHub App to repos you actually control, and keep ownership of the budget, the logs, and whatever data gets retained.

The whole thing is built to live inside the AWS free tier. The default target is roughly **$0 to $5 a month** per instance, and there's a hard **$10** ceiling it won't quietly blow past.

One rule sits above everything else: if PRPilot can't honestly review your PR, it says so with a blocking check. It never pretends the review passed when it didn't.

---

## Why it exists

| The problem | What PRPilot does about it |
|-------------|----------------------------|
| Juniors wait hours for a first review on trivial issues | A required check posts structured feedback in under 60s (p95) |
| SaaS review bots want both your source code and your money | Runs in your own AWS account, on repos you control |
| AI review tools rack up surprise bills | Free-tier first; the expensive scans are off by default |
| Bots that report "pass" even when they choked | PRPilot fails closed and tells you why |

---

## How it works

A PR event comes in from GitHub, the webhook does the cheap safety checks up front, and anything that survives gets queued for the worker to actually review.

```mermaid
flowchart TD
    PR([GitHub PR event]) --> AGW[API Gateway]
    AGW --> WH[Webhook Lambda]

    subgraph guard [ingress guards]
        direction LR
        G1[verify signature<br/>X-Hub-Signature-256]
        G2[dedupe delivery<br/>DynamoDB conditional write]
        G3[selected-repo scope<br/>+ quota guard]
    end
    WH --> guard

    guard --> SQS[[SQS Queue]]
    SQS -.->|failed deliveries| DLQ[[Dead-letter Queue]]
    DLQ -.->|retries / recovery| SQS

    SQS --> WK[Worker Lambda]
    WK --> RE[Rule Engine]
    RE --> CR[GitHub Check Run<br/>+ capped annotations]
    RE --> DDB[(DynamoDB records<br/>TTL retention)]
```

The webhook Lambda has one job and a tight deadline: verify the signature, drop duplicate deliveries, check the repo is in scope and under quota, then hand the work off to SQS and return fast. All the slow work happens in the worker, so GitHub never sees a late response.

These are the promises the system tries to keep:

- **Ingress:** accepted deliveries are acknowledged inside GitHub's 10-second window, so a delivery never gets marked as failed.
- **Latency:** a normal PR gets a finished check in under 60 seconds at p95. The fast lane aims well below that.
- **No silent loss:** once a delivery is accepted, it doesn't vanish somewhere between the webhook and the queue.
- **Cost:** target $0 to $5 a month, hard ceiling $10. Conserve mode kicks in before it gets close.
- **Secrets:** never hardcoded, and rotatable without a redeploy.

---

## Two lanes

There's the review that always has to run, and the review that costs more. PRPilot keeps them separate on purpose.

| | Fast lane (`PRPilot Fast`) | Deep lane (`PRPilot Deep`) |
|---|---|---|
| When it runs | Every supported PR, automatically | On a manual button, or a narrow opt-in |
| Cost | Cheap, stays in free tier | Higher, so off by default |
| Blocks merge? | Yes, on critical findings | No, never touches the required lane |
| Trigger | `pull_request` opened / reopened / synchronize / ready | `check_run.requested_action` (the "Run deep scan" action) |
| Default | Always on | Manual only |

The fast lane is deterministic and required. The deep lane is opt-in, and it can't weaken or block the required path no matter how it's configured.

---

## Supported repositories

The first supported repo class is deliberately narrow so the baseline can prove itself before scope grows:

- Node.js, TypeScript, or JavaScript
- The repo root has both `package.json` and `package-lock.json`
- Uses GitHub Actions for CI

If a repo is missing those files, PRPilot marks it unsupported for the required path and publishes an explicit blocking result. It doesn't fake a passing review. Wider multi-language coverage stays deferred until the fast lane is solid inside the cost ceiling.

---

## The usage envelope

These are architectural limits, not knobs to be quietly tuned upward. When usage approaches a ceiling, PRPilot degrades on purpose instead of auto-scaling into a bigger bill.

| Dimension | Default target | Hard ceiling | What happens near the ceiling |
|-----------|:--------------:|:------------:|-------------------------------|
| Monthly spend per instance | $0 to $5 | $10 | Enter conserve mode |
| App installations | 5 | 10 | Stop expanding scope |
| Active repos with reviews | 3 | 5 | Disable new enablement |
| Fast-lane jobs (global) | 20/day | 50/day | Coalesce jobs, throttle reruns |
| Fast-lane jobs (per repo) | 10/day | 20/day | Return an explicit over-quota result |
| Manual reruns per PR | 2/day | 3/day | Reject with a clear summary |
| Deep scans | disabled | 1/repo/day | Stay off unless explicitly asked |
| Inline annotations per run | 20 | 30 | Roll overflow into summary text |
| Changed files per run | 50 | 100 | Publish an explicit oversized-run result |

---

## Configuration precedence

Config is layered, and safety always wins the tie:

1. **Safety invariants.** Signature verification, dedupe, required-path honesty, and the hard caps. Nothing can weaken these, not even you.
2. **Deployment-owner runtime policy** (AWS Parameter Store). Budget mode, selected-repo scope, quotas, emergency disables. Changes take effect without a redeploy.
3. **Repository policy** (`.prpilot.yml`). Can narrow scope or raise strictness, but can't exceed the owner's caps or turn off required security behavior.
4. **Environment defaults.** The baseline limits used when nothing above overrides them.

`budget_mode` is one of `normal`, `conserve`, or `emergency`. If the owner policy can't be loaded or validated, the required path fails closed rather than guessing at safe behavior.

---

## Getting started

### Prerequisites

- Node.js 22 LTS and npm 10+
- An AWS account (free-tier eligible)
- AWS CLI configured with a profile or SSO
- Permission to create a private GitHub App

### 1. Prove it locally first

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run infra:synth
```

### 2. Provision the live inputs

Secrets go in Parameter Store, never in code:

- GitHub App ID
- GitHub webhook secret
- GitHub App private key
- Runtime policy JSON
- One selected repository ID
- AWS region

### 3. Deploy

The CDK stack stands up API Gateway, the webhook Lambda, the worker Lambda, an SQS queue, a dead-letter queue, a DynamoDB table, log groups, and alarms.

```bash
npx cdk deploy
```

Copy the `WebhookUrl` output into your GitHub App's webhook settings, then open a test PR in the selected repo.

Full walkthrough: [`docs/self-host-quickstart.md`](docs/self-host-quickstart.md) and [`docs/github-app-and-aws-setup.md`](docs/github-app-and-aws-setup.md).

---

## Preflight CLI (optional)

You can run the same deterministic fast-lane checks locally before you push, which keeps your deployed usage down:

```bash
npm run preflight
```

The cheapest review is the one that never has to hit the cloud.

---

## Project layout

```
apps/
  webhook/          verifies signature, dedupes, checks scope/quota, enqueues
  worker/           consumes SQS, runs the rule engine, publishes the check
  cli/              local preflight command

packages/
  rules/            deterministic fast-lane and deep-lane rule engine
  checks/           GitHub Check Run payloads, annotations, conclusions
  queue/            review queue, lane admission, rerun throttle, freshness
  review-store/     DynamoDB persistence, TTL retention, recovery drill
  github/           installation authorization
  deployment/       deployment validation
  observability/    free-tier-aware observability
  config/           runtime policy schema and loader

infra/              AWS CDK app (PRPilotStack)
tests/              unit and integration suites
docs/               setup, security, reliability, cost, and runbook docs
```

---

## Documentation

| Topic | Doc |
|-------|-----|
| Self-host quickstart | [`docs/self-host-quickstart.md`](docs/self-host-quickstart.md) |
| GitHub App + AWS setup | [`docs/github-app-and-aws-setup.md`](docs/github-app-and-aws-setup.md) |
| Security architecture | [`docs/security-architecture.md`](docs/security-architecture.md) |
| Reliability architecture | [`docs/reliability-architecture.md`](docs/reliability-architecture.md) |
| Cost control | [`docs/cost-control.md`](docs/cost-control.md) |
| Secret rotation | [`docs/secret-rotation.md`](docs/secret-rotation.md) |
| Operations runbook | [`docs/operations-runbook.md`](docs/operations-runbook.md) |
| Recovery drill | [`docs/recovery-drill.md`](docs/recovery-drill.md) |
| Five-minute demo | [`docs/five-minute-demo.md`](docs/five-minute-demo.md) |

---

## Development

```bash
npm run webhook:dev          # local webhook dev server
npm test                     # vitest unit + integration
npm run lint                 # eslint
npm run typecheck            # tsc --noEmit
npm run ci:latency           # check the latency baseline
npm run ci:deterministic     # verify the required path stays deterministic
```

---

## Design principles

- **Honest over helpful.** A blocking "I can't review this" beats a false pass.
- **Free-tier first.** Cost is a feature. Expensive work is opt-in and capped.
- **Deterministic required path.** The same PR gives the same required result.
- **Self-hosted.** Your account, your data, your budget, your logs.
- **Degrade on purpose.** Near a limit, cut detail or defer. Never drop work silently.

---

<div align="center">

Built by [Priyan Arora](https://github.com/PriyanArora) · Licensed under [MIT](LICENSE)

</div>
