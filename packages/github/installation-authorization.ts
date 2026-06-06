import { CHECK_RUN_NAMES } from "../checks/check-run-identity";
import { RERUN_DEEP_SCAN_ACTION_ID, RUN_DEEP_SCAN_ACTION_ID } from "../checks/deep-scan-action";

export const githubAppPermissionMatrix = {
    repositoryMetadata: "read",
    contents: "read",
    pullRequests: "read",
    checks: "write"
} as const;

export type InstallationScopedEvent = {
    eventName: "pull_request" | "check_suite" | "check_run" | "installation" | "installation_repositories";
    action: string;
    installationId: number;
    repositoryId: number;
    repositoryFullName: string;
    pullRequest?: {
        number: number;
        headSha: string;
        baseSha: string;
        baseRepositoryId?: number;
        headRepositoryId?: number;
        baseRepositoryFullName?: string;
        headRepositoryFullName?: string;
    };
};

export type InstallationIdentity = {
    installationId: number;
    repositoryId: number;
    repositoryFullName: string;
    authorizationRepositoryId: number;
    isForkPullRequest: boolean;
};

export type InstallationAuthorizationDecision =
    | {
        authorized: true;
        identity: InstallationIdentity;
    }
    | {
        authorized: false;
        reason:
            | "repository_not_installed"
            | "repository_not_selected"
            | "installation_not_allowed";
        identity: InstallationIdentity;
    };

export type PullRequestRepositoryContext = {
    baseRepositoryId: number;
    baseRepositoryFullName: string;
    headRepositoryId: number;
    headRepositoryFullName: string;
    isFork: boolean;
    authorizationRepositoryId: number;
};

export type RequestedActionValidation =
    | {
        valid: true;
        action: typeof RUN_DEEP_SCAN_ACTION_ID | typeof RERUN_DEEP_SCAN_ACTION_ID;
    }
    | {
        valid: false;
        reason:
            | "not_prpilot_check"
            | "unsupported_action"
            | "stale_head_sha"
            | "invalid_external_id";
    };

function includesNumber(values: readonly number[], value: number): boolean {
    return values.includes(value);
}

export function resolvePullRequestRepositoryContext(input: {
    baseRepositoryId: number;
    baseRepositoryFullName: string;
    headRepositoryId: number;
    headRepositoryFullName: string;
}): PullRequestRepositoryContext {
    const isFork = input.baseRepositoryId !== input.headRepositoryId;

    return {
        ...input,
        isFork,
        authorizationRepositoryId: input.baseRepositoryId
    };
}

export function resolveInstallationIdentity(event: InstallationScopedEvent): InstallationIdentity {
    const baseRepositoryId = event.pullRequest?.baseRepositoryId ?? event.repositoryId;
    const headRepositoryId = event.pullRequest?.headRepositoryId ?? event.repositoryId;

    return {
        installationId: event.installationId,
        repositoryId: event.repositoryId,
        repositoryFullName: event.repositoryFullName,
        authorizationRepositoryId: baseRepositoryId,
        isForkPullRequest: baseRepositoryId !== headRepositoryId
    };
}

export function authorizeInstallationEvent(input: {
    event: InstallationScopedEvent;
    installedRepositoryIds: readonly number[];
    selectedRepositoryIds: readonly number[];
    allowedInstallationIds?: readonly number[];
}): InstallationAuthorizationDecision {
    const identity = resolveInstallationIdentity(input.event);

    if (input.allowedInstallationIds !== undefined
        && !includesNumber(input.allowedInstallationIds, identity.installationId)) {
        return {
            authorized: false,
            reason: "installation_not_allowed",
            identity
        };
    }

    if (!includesNumber(input.installedRepositoryIds, identity.authorizationRepositoryId)) {
        return {
            authorized: false,
            reason: "repository_not_installed",
            identity
        };
    }

    if (!includesNumber(input.selectedRepositoryIds, identity.authorizationRepositoryId)) {
        return {
            authorized: false,
            reason: "repository_not_selected",
            identity
        };
    }

    return {
        authorized: true,
        identity
    };
}

export function validatePrpilotRequestedAction(input: {
    checkName: string;
    actionIdentifier: string;
    checkRunExternalId?: string;
    requestedHeadSha: string;
    currentHeadSha: string;
}): RequestedActionValidation {
    if (input.checkName !== CHECK_RUN_NAMES.fast && input.checkName !== CHECK_RUN_NAMES.deep) {
        return {
            valid: false,
            reason: "not_prpilot_check"
        };
    }

    if (input.checkRunExternalId !== undefined && !input.checkRunExternalId.startsWith("prpilot:")) {
        return {
            valid: false,
            reason: "invalid_external_id"
        };
    }

    if (input.actionIdentifier !== RUN_DEEP_SCAN_ACTION_ID
        && input.actionIdentifier !== RERUN_DEEP_SCAN_ACTION_ID) {
        return {
            valid: false,
            reason: "unsupported_action"
        };
    }

    if (input.requestedHeadSha !== input.currentHeadSha) {
        return {
            valid: false,
            reason: "stale_head_sha"
        };
    }

    return {
        valid: true,
        action: input.actionIdentifier
    };
}
