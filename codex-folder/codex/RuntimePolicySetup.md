# Runtime Policy Setup

## What It Is
Runtime policy is deployment-owner configuration that controls budget mode, selected repositories, quotas, annotation limits, and optional deep scans.

## Why PRPilot Needs It
It lets the deployment owner reduce cost, disable risky behavior, or tighten limits without redeploying code.

## Parameter Store Role
In live AWS, Parameter Store will hold the policy document outside Lambda code and outside normal environment variables.

## What Not To Build Yet
Do not connect to AWS yet. Do not load Parameter Store yet. P4.2b only defines the loader contract, cache behavior, and fail-closed behavior.
