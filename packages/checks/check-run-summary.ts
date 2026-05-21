import type { Coverage } from "../rules/coverage";
import type { Finding } from "../rules/finding";
import type { CheckRunPayloadInput } from "../rules/check-run-payload-input";

export type CheckRunSummaryInput = {
    payload: CheckRunPayloadInput;
    inlineAnnotationCount: number;
    overflowAnnotationCount: number;
    appliedLimits: string[];
    deepScanAvailable: boolean;
};

export type CheckRunSummary = {
    title: string;
    body: string;
    blockingFindings: Finding[];
    advisoryFindings: Finding[];
    coverageGaps: Coverage[];
};

function formatCount(label: string, count: number): string {
    return `${label}: ${count}`;
}

export function buildCheckRunSummary(input: CheckRunSummaryInput): CheckRunSummary {
    const blockingFindings = input.payload.findings.filter((finding) => finding.blockability === "block");
    const advisoryFindings = input.payload.findings.filter((finding) => finding.blockability !== "block");
    const coverageGaps = input.payload.coverage.filter((coverageRecord) =>
        coverageRecord.status !== "completed" && coverageRecord.status !== "not_applicable"
    );

    const body = [
        `Verdict: ${input.payload.conclusion}`,
        formatCount("Blocking findings", blockingFindings.length),
        formatCount("Advisory findings", advisoryFindings.length),
        formatCount("Coverage gaps", coverageGaps.length),
        formatCount("Inline annotations", input.inlineAnnotationCount),
        formatCount("Overflow findings in summary", input.overflowAnnotationCount),
        `Applied limits: ${input.appliedLimits.length === 0 ? "none" : input.appliedLimits.join(", ")}`,
        `Deep scan available: ${input.deepScanAvailable ? "yes" : "no"}`
    ].join("\n");

    return {
        title: input.payload.checkName,
        body,
        blockingFindings,
        advisoryFindings,
        coverageGaps
    };
}
