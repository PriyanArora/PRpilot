# Cost-Control Architecture

## Defaults

- DynamoDB uses pay-per-request billing.
- Lambda reserved concurrency is low.
- Worker SQS batch size is `1`.
- Logs retain for seven days.
- Deep scans are optional and disabled by default.

## Budget Modes

- `normal`: fast lane and allowed optional work can run.
- `conserve`: deny optional deep work first and reduce presentation volume.
- `emergency`: keep only the required path honest and report required coverage gaps as `action_required`.

## Quotas

Runtime policy controls per-repo and global run quotas. Repository config may lower behavior but cannot exceed owner caps.
