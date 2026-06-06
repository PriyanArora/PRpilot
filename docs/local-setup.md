# Local Setup

## Prerequisites

- Node.js compatible with the repo lockfile.
- npm.
- Git.

## Install

```bash
npm install
```

## Common Commands

```bash
npm run typecheck
npm run lint
npm test
npm run preflight -- --base main
npm run infra:synth
```

## Local Webhook Development

Use:

```bash
npm run webhook:dev
```

Expose it with a tunnel only for controlled GitHub App tests. Keep real secrets outside the repo.
