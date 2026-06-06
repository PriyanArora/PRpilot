# Approaching Limits Policy

## Signals

- Per-repo quota reaches 80%.
- Global quota reaches 80%.
- DLQ has visible messages.
- Worker throttles appear.
- Queue oldest-message age exceeds the alarm threshold.

## Response

1. Move to `conserve`.
2. Deny optional deep scans.
3. Reduce annotation and summary volume.
4. Keep the fast lane honest.
5. Move to `emergency` if required-path coverage cannot be completed safely.

## Evidence

Record the runtime policy version, budget mode, reason, and rollback condition.
