import type { CheckRunPayloadInput } from "../rules/check-run-payload-input";
import { buildCheckRunExternalId } from "./check-run-identity";
import { prepareAnnotations } from "./check-run-annotations";
import type { CheckRunAnnotation } from "./check-run-annotations";
import { buildCheckRunSummary } from "./check-run-summary";
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
    conclusion: CheckRunPayloadInput["conclusion"];
    status: "completed";
    summary: string;
    annotations: CheckRunAnnotation[];
    overflowAnnotations: CheckRunAnnotation[];
    actions: string[];
};

export type SyncCheckRunStore = Map<string, PublishedCheckRun>;

export type SyncCheckPublisherResult = {
    operation: "created" | "updated";
    checkRun: PublishedCheckRun;
};

export function createSyncCheckRunStore(): SyncCheckRunStore {
    return new Map<string, PublishedCheckRun>();
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
        overflowAnnotationCount: preparedAnnotations.overflowAnnotations.length,
        appliedLimits: input.appliedLimits ?? [],
        deepScanAvailable: actions.includes("run_deep_scan")
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
        actions
    };

    const operation = store.has(externalId) ? "updated" : "created";
    store.set(externalId, checkRun);

    return {
        operation,
        checkRun
    };
}
