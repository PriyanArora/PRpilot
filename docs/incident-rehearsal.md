# Incident Rehearsal

## Scenario

Worker failures push messages into the DLQ while `PRPilot Fast` is required by branch protection.

## Rehearsal Steps

1. Identify the alarm.
2. Read structured logs for delivery ID, repository, PR number, lane, head SHA, run status, and budget mode.
3. Inspect one DLQ message.
4. Confirm current PR head SHA.
5. Replay one message or publish an honest operational result.
6. Update runtime policy if optional work must be denied.
7. Record rollback timing if policy rollback is used.

## Timeline Template

- Start time:
- Alarm:
- User impact:
- Action taken:
- Rollback time:
- Evidence link:
