# Recovery Drill

## Goal

Prove one PR partition can be restored and queried after accidental data loss or table-copy recovery.

## Drill

1. Export or copy a safe DynamoDB table sample.
2. Restore records into a safe table copy.
3. Query `PK = REPO#<repositoryId>#PR#<prNumber>`.
4. Confirm delivery, run, attempt, counter, and lock records are present where expected.
5. Confirm TTL fields are preserved.

## Evidence

Save the query output and note the table name, repository ID, PR number, and restore time.
