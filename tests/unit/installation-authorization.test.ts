import { describe, expect, it } from "vitest";
import {
    authorizeInstallationEvent,
    githubAppPermissionMatrix,
    resolvePullRequestRepositoryContext,
    validatePrpilotRequestedAction,
    type InstallationScopedEvent
} from "../../packages/github/installation-authorization";

function event(overrides: Partial<InstallationScopedEvent> = {}): InstallationScopedEvent {
    return {
        eventName: "pull_request",
        action: "opened",
        installationId: 456,
        repositoryId: 123,
        repositoryFullName: "owner/repo",
        pullRequest: {
            number: 42,
            headSha: "abc123",
            baseSha: "base123"
        },
        ...overrides
    };
}

describe("GitHub App permission matrix", () => {
    it("documents the least-privilege MVP permissions", () => {
        expect(githubAppPermissionMatrix).toEqual({
            repositoryMetadata: "read",
            contents: "read",
            pullRequests: "read",
            checks: "write"
        });
    });
});

describe("installation authorization", () => {
    it("accepts events from installed selected same-repo repositories", () => {
        const decision = authorizeInstallationEvent({
            event: event(),
            installedRepositoryIds: [123],
            selectedRepositoryIds: [123],
            allowedInstallationIds: [456]
        });

        expect(decision.authorized).toBe(true);
        if (!decision.authorized) {
            throw new Error(decision.reason);
        }
        expect(decision.identity).toMatchObject({
            installationId: 456,
            authorizationRepositoryId: 123,
            isForkPullRequest: false
        });
    });

    it("authorizes fork pull requests by installed base repository, not check_suite pull request lookup", () => {
        const context = resolvePullRequestRepositoryContext({
            baseRepositoryId: 123,
            baseRepositoryFullName: "owner/repo",
            headRepositoryId: 999,
            headRepositoryFullName: "contributor/repo"
        });
        const decision = authorizeInstallationEvent({
            event: event({
                pullRequest: {
                    number: 42,
                    headSha: "abc123",
                    baseSha: "base123",
                    baseRepositoryId: context.baseRepositoryId,
                    headRepositoryId: context.headRepositoryId,
                    baseRepositoryFullName: context.baseRepositoryFullName,
                    headRepositoryFullName: context.headRepositoryFullName
                }
            }),
            installedRepositoryIds: [123],
            selectedRepositoryIds: [123]
        });

        expect(context).toMatchObject({
            isFork: true,
            authorizationRepositoryId: 123
        });
        expect(decision.authorized).toBe(true);
        if (!decision.authorized) {
            throw new Error(decision.reason);
        }
        expect(decision.identity.isForkPullRequest).toBe(true);
    });

    it("rejects non-installed, unselected, and disallowed installation events", () => {
        expect(authorizeInstallationEvent({
            event: event(),
            installedRepositoryIds: [],
            selectedRepositoryIds: [123]
        })).toMatchObject({
            authorized: false,
            reason: "repository_not_installed"
        });
        expect(authorizeInstallationEvent({
            event: event(),
            installedRepositoryIds: [123],
            selectedRepositoryIds: []
        })).toMatchObject({
            authorized: false,
            reason: "repository_not_selected"
        });
        expect(authorizeInstallationEvent({
            event: event(),
            installedRepositoryIds: [123],
            selectedRepositoryIds: [123],
            allowedInstallationIds: [999]
        })).toMatchObject({
            authorized: false,
            reason: "installation_not_allowed"
        });
    });
});

describe("PRPilot requested actions", () => {
    it("accepts fresh PRPilot-owned deep-scan actions", () => {
        const decision = validatePrpilotRequestedAction({
            checkName: "PRPilot Fast",
            actionIdentifier: "run_deep_scan",
            checkRunExternalId: "prpilot:123:42:fast:abc123",
            requestedHeadSha: "abc123",
            currentHeadSha: "abc123"
        });

        expect(decision).toEqual({
            valid: true,
            action: "run_deep_scan"
        });
    });

    it("rejects non-PRPilot checks, unsupported actions, stale SHAs, and invalid external IDs", () => {
        expect(validatePrpilotRequestedAction({
            checkName: "Other Check",
            actionIdentifier: "run_deep_scan",
            requestedHeadSha: "abc123",
            currentHeadSha: "abc123"
        })).toEqual({
            valid: false,
            reason: "not_prpilot_check"
        });
        expect(validatePrpilotRequestedAction({
            checkName: "PRPilot Fast",
            actionIdentifier: "unknown",
            requestedHeadSha: "abc123",
            currentHeadSha: "abc123"
        })).toEqual({
            valid: false,
            reason: "unsupported_action"
        });
        expect(validatePrpilotRequestedAction({
            checkName: "PRPilot Fast",
            actionIdentifier: "run_deep_scan",
            requestedHeadSha: "old",
            currentHeadSha: "new"
        })).toEqual({
            valid: false,
            reason: "stale_head_sha"
        });
        expect(validatePrpilotRequestedAction({
            checkName: "PRPilot Fast",
            actionIdentifier: "run_deep_scan",
            checkRunExternalId: "foreign",
            requestedHeadSha: "abc123",
            currentHeadSha: "abc123"
        })).toEqual({
            valid: false,
            reason: "invalid_external_id"
        });
    });
});
