# Security Architecture

## Webhook Trust Boundary

Webhook ingress verifies `X-Hub-Signature-256` before accepting GitHub payloads.

## Installation Scope

The app authorizes events against the installed base repository and selected repository IDs.

## Idempotency

Delivery IDs are persisted before queue handoff so duplicate deliveries do not create duplicate side effects.

## Secrets

GitHub webhook secret and private key live in Parameter Store. Source code and Lambda environment variables store names only.

## Runtime Policy

Deployment-owner runtime policy has precedence over repository config. Repository config cannot override owner caps.
