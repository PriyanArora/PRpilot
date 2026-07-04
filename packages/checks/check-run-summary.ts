import type { Coverage } from "../rules/coverage";
import type { Finding } from "../rules/finding";
import type { CheckRunPayloadInput } from "../rules/check-run-payload-input";
import type { CheckRunAnnotation } from "./check-run-annotations";
import { formatFindingDelta, type FindingDelta } from "./finding-delta";

// GitHub check-run summaries accept up to 65535 characters. Stay just under it and
// leave room for the truncation notice.
const SUMMARY_MAX_LENGTH = 65000;

export type CheckRunSummaryInput = {
    payload: CheckRunPayloadInput;
    inlineAnnotationCount: number;
    overflowAnnotations: CheckRunAnnotation[];
    appliedLimits: string[];
    deepScanAvailable: boolean;
    // Present when a previous run exists for this PR/lane on an earlier head SHA.
    delta?: FindingDelta;
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

function formatLocation(finding: Pick<Finding, "path" | "start_line">): string {
    return finding.start_line === undefined ? `\`${finding.path}\`` : `\`${finding.path}:${finding.start_line}\``;
}

function formatFindingLine(finding: Finding): string {
    return `- ${formatLocation(finding)} — ${finding.message} _(${finding.scanner} · ${finding.severity})_`;
}

function formatOverflowLine(annotation: CheckRunAnnotation): string {
    return `- \`${annotation.path}:${annotation.start_line}\` — ${annotation.message} _(${annotation.scanner} · ${annotation.severity})_`;
}

function buildFindingSection(heading: string, findings: Finding[]): string[] {
    if (findings.length === 0) {
        return [];
    }

    return [`**${heading} (${findings.length})**`, ...findings.map(formatFindingLine), ""];
}

function buildCoverageTable(coverageGaps: Coverage[]): string[] {
    if (coverageGaps.length === 0) {
        return [];
    }

    return [
        `**Coverage gaps (${coverageGaps.length})**`,
        "| scanner | status | reason |",
        "| --- | --- | --- |",
        ...coverageGaps.map((record) =>
            `| ${record.scanner} | ${record.status} | ${record.reason ?? "—"} |`
        ),
        ""
    ];
}

function buildOverflowSection(overflowAnnotations: CheckRunAnnotation[]): string[] {
    if (overflowAnnotations.length === 0) {
        return [];
    }

    return [
        `**Additional findings not shown inline (${overflowAnnotations.length})**`,
        ...overflowAnnotations.map(formatOverflowLine),
        ""
    ];
}

// Keep the body under GitHub's summary limit by truncating whole lines from the end
// (least-severe content is rendered last) and appending a notice.
function enforceLengthLimit(body: string): string {
    if (body.length <= SUMMARY_MAX_LENGTH) {
        return body;
    }

    const notice = "\n\n_Summary truncated to fit GitHub's size limit._";
    return body.slice(0, SUMMARY_MAX_LENGTH - notice.length) + notice;
}

export function buildCheckRunSummary(input: CheckRunSummaryInput): CheckRunSummary {
    const blockingFindings = input.payload.findings.filter((finding) => finding.blockability === "block");
    const advisoryFindings = input.payload.findings.filter((finding) => finding.blockability !== "block");
    const coverageGaps = input.payload.coverage.filter((coverageRecord) =>
        coverageRecord.status !== "completed" && coverageRecord.status !== "not_applicable"
    );

    // Machine-readable stats footer. Kept stable for tooling and dashboards.
    const statsFooter = [
        formatCount("Blocking findings", blockingFindings.length),
        formatCount("Advisory findings", advisoryFindings.length),
        formatCount("Coverage gaps", coverageGaps.length),
        formatCount("Inline annotations", input.inlineAnnotationCount),
        formatCount("Overflow findings in summary", input.overflowAnnotations.length),
        `Applied limits: ${input.appliedLimits.length === 0 ? "none" : input.appliedLimits.join(", ")}`,
        `Deep scan available: ${input.deepScanAvailable ? "yes" : "no"}`
    ];

    const body = enforceLengthLimit([
        `### Verdict: ${input.payload.conclusion}`,
        "",
        ...(input.delta === undefined ? [] : [formatFindingDelta(input.delta), ""]),
        ...buildFindingSection("Blocking findings", blockingFindings),
        ...buildFindingSection("Advisory findings", advisoryFindings),
        ...buildCoverageTable(coverageGaps),
        ...buildOverflowSection(input.overflowAnnotations),
        "---",
        ...statsFooter
    ].join("\n"));

    return {
        title: input.payload.checkName,
        body,
        blockingFindings,
        advisoryFindings,
        coverageGaps
    };
}
