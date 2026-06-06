# Reliability Architecture

## Queue Flow

GitHub webhook delivery is accepted only after durable SQS handoff. The worker processes one message at a time and acknowledges only after work finishes.

## Persistence

DynamoDB records deliveries, runs, attempts, counters, locks, and retention fields with `pk`, `sk`, and `ttl`.

## Policy Precedence

Deployment-owner runtime policy wins over repository `.prpilot.yml`. Repository policy can adjust paths, scanner modes, and opt-ins only inside owner caps.

## Retry and DLQ

Failed worker attempts retry with bounded receive count. Messages move to the DLQ when retry limit is reached.

## Redelivery

GitHub failed-delivery redelivery is safe only after verifying endpoint health and webhook secret configuration.
