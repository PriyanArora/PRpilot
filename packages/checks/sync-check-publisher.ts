import type { Lane } from "../config/runtime-policy";
import type { CheckRunPayloadInput } from "../rules/check-run-payload-input";
import { buildCheckRunExternalId, getCheckRunName } from "./check-run-identity";
import { prepareAnnotations } from "./check-run-annotations";
import type { CheckRunAnnotation } from "./check-run-annotations";
import { buildCheckRunSummary } from "./check-run-summary";
import { diffFindingFingerprints } from "./finding-delta";
import { getPublishedCheckActions } from "./deep-scan-action";

export type SyncCheckPublisherInput = {
    repositoryId: number;
    payload: CheckRunPayloadInput;
    annotationCap: number;
    policyAllowsDeepScan: boolean;
    appliedLimits?: string[];
};

export type PublishedCheckRun = {
    externalId: string;
    name: string;
    headSha: string;
    conclusion: CheckRunPayloadInput["conclusion"] | null;
    status: "queued" | "in_progress" | "completed";
    summary: string;
    annotations: CheckRunAnnotation[];
    overflowAnnotations: CheckRunAnnotation[];
    actions: string[];
    // All finding fingerprints from this run (not just annotated ones), so a later
    // push on the same PR can report what it fixed and what it introduced.
    findingFingerprints: string[];
};

export type SyncCheckRunStore = Map<string, PublishedCheckRun>;

export type SyncCheckPublisherResult = {
    operation: "created" | "updated";
    checkRun: PublishedCheckRun;
};

export function createSyncCheckRunStore(): SyncCheckRunStore {
    return new Map<string, PublishedCheckRun>();
}

// Finds the most recent completed run for the same repo/PR/lane on a different head
// SHA, using the external-id prefix as the lookup key. Map iteration is insertion
// order, so the last match is the latest.
function findPreviousRunForPr(
    store: SyncCheckRunStore,
    currentExternalId: string
): PublishedCheckRun | undefined {
    // external id shape: prpilot:<repoId>:<prNumber>:<lane>:<headSha>
    const prefix = currentExternalId.slice(0, currentExternalId.lastIndexOf(":") + 1);
    let previousRun: PublishedCheckRun | undefined;

    for (const [externalId, checkRun] of store) {
        if (externalId !== currentExternalId && externalId.startsWith(prefix) && checkRun.status === "completed") {
            previousRun = checkRun;
        }
    }

    return previousRun;
}

export function publishCheckRunSync(
    store: SyncCheckRunStore,
    input: SyncCheckPublisherInput
): SyncCheckPublisherResult {
    const externalId = buildCheckRunExternalId({
        repositoryId: input.repositoryId,
        prNumber: input.payload.prNumber,
        lane: input.payload.lane,
        headSha: input.payload.headSha
    });

    const findingFingerprints = [...new Set(input.payload.findings.map((finding) => finding.fingerprint))];
    const previousRun = findPreviousRunForPr(store, externalId);

    const preparedAnnotations = prepareAnnotations(input.payload.findings, input.annotationCap);
    const actions = getPublishedCheckActions({
        lane: input.payload.lane,
        conclusion: input.payload.conclusion,
        coverage: input.payload.coverage,
        policyAllowsDeepScan: input.policyAllowsDeepScan
    });

    const summary = buildCheckRunSummary({
        payload: input.payload,
        inlineAnnotationCount: preparedAnnotations.inlineAnnotations.length,
        overflowAnnotations: preparedAnnotations.overflowAnnotations,
        appliedLimits: input.appliedLimits ?? [],
        deepScanAvailable: actions.includes("run_deep_scan"),
        ...(previousRun === undefined
            ? {}
            : { delta: diffFindingFingerprints(previousRun.findingFingerprints, findingFingerprints) })
    });

    const checkRun: PublishedCheckRun = {
        externalId,
        name: input.payload.checkName,
        headSha: input.payload.headSha,
        conclusion: input.payload.conclusion,
        status: "completed",
        summary: summary.body,
        annotations: preparedAnnotations.inlineAnnotations,
        overflowAnnotations: preparedAnnotations.overflowAnnotations,
        actions,
        findingFingerprints
    };

    const operation = store.has(externalId) ? "updated" : "created";
    store.set(externalId, checkRun);

    return {
        operation,
        checkRun
    };
}

export type QueuedCheckRunInput = {
    repositoryId: number;
    lane: Lane;
    prNumber: number;
    headSha: string;
};

// Published at webhook ingress so the developer sees PRPilot pick up the PR within
// seconds. No review runs here — it is a status-only placeholder that the worker
// later updates to "completed" via publishCheckRunSync under the same external id.
export function publishQueuedCheckRun(
    store: SyncCheckRunStore,
    input: QueuedCheckRunInput
): SyncCheckPublisherResult {
    const externalId = buildCheckRunExternalId({
        repositoryId: input.repositoryId,
        prNumber: input.prNumber,
        lane: input.lane,
        headSha: input.headSha
    });

    const checkRun: PublishedCheckRun = {
        externalId,
        name: getCheckRunName(input.lane),
        headSha: input.headSha,
        conclusion: null,
        status: "in_progress",
        summary: "Analyzing…",
        annotations: [],
        overflowAnnotations: [],
        actions: [],
        findingFingerprints: []
    };

    const operation = store.has(externalId) ? "updated" : "created";
    store.set(externalId, checkRun);

    return {
        operation,
        checkRun
    };
}
