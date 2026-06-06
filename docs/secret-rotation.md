# Secret Rotation

## Webhook Secret

1. Create a new webhook secret.
2. Store it in Parameter Store.
3. Update the GitHub App webhook setting.
4. Redeploy or refresh runtime config if needed.
5. Verify a new GitHub delivery succeeds.

## GitHub Private Key

1. Generate a new GitHub App private key.
2. Store it in Parameter Store.
3. Remove the old key from GitHub after validation.
4. Trigger one safe check-run publish path.

## Evidence

Record Parameter Store names, rotation time, and successful delivery or check-run proof. Do not record secret values.
