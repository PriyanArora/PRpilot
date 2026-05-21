import type { Lane } from "../config/runtime-policy";
import type { Finding, FindingBlockability } from "../rules/finding";

export type CheckRunAnnotationLevel = "failure" | "warning" | "notice";

export type CheckRunAnnotation = {
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: CheckRunAnnotationLevel;
    message: string;
    fingerprint: string;
    lane: Lane;
    blockability: FindingBlockability;
    scanner: string;
};

export type PreparedAnnotations = {
    inlineAnnotations: CheckRunAnnotation[];
    overflowAnnotations: CheckRunAnnotation[];
    chunks: CheckRunAnnotation[][];
};

const SCANNER_PRIORITY: Record<string, number> = {
    gitleaks: 0,
    actionlint: 1,
    internal: 2,
    eslint: 3
};

function getBlockabilityRank(blockability: FindingBlockability): number {
    if (blockability === "block") {
        return 0;
    }

    if (blockability === "warn") {
        return 1;
    }

    return 2;
}

function getAnnotationLevel(blockability: FindingBlockability): CheckRunAnnotationLevel {
    if (blockability === "block") {
        return "failure";
    }

    if (blockability === "warn") {
        return "warning";
    }

    return "notice";
}

export function buildAnnotationFromFinding(finding: Finding): CheckRunAnnotation | null {
    if (finding.start_line === undefined) {
        return null;
    }

    return {
        path: finding.path,
        start_line: finding.start_line,
        end_line: finding.end_line ?? finding.start_line,
        annotation_level: getAnnotationLevel(finding.blockability),
        message: finding.message,
        fingerprint: finding.fingerprint,
        lane: finding.lane,
        blockability: finding.blockability,
        scanner: finding.scanner
    };
}

export function dedupeAnnotations(annotations: CheckRunAnnotation[]): CheckRunAnnotation[] {
    const seenKeys = new Set<string>();
    const dedupedAnnotations: CheckRunAnnotation[] = [];

    for (const annotation of annotations) {
        const key = `${annotation.fingerprint}:${annotation.path}:${annotation.start_line}:${annotation.end_line}`;

        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            dedupedAnnotations.push(annotation);
        }
    }

    return dedupedAnnotations;
}

export function rankAnnotations(annotations: CheckRunAnnotation[]): CheckRunAnnotation[] {
    return [...annotations].sort((left, right) => {
        const blockabilityRank = getBlockabilityRank(left.blockability) - getBlockabilityRank(right.blockability);
        if (blockabilityRank !== 0) {
            return blockabilityRank;
        }

        const laneRank = (left.lane === "fast" ? 0 : 1) - (right.lane === "fast" ? 0 : 1);
        if (laneRank !== 0) {
            return laneRank;
        }

        const scannerRank = (SCANNER_PRIORITY[left.scanner] ?? 99) - (SCANNER_PRIORITY[right.scanner] ?? 99);
        if (scannerRank !== 0) {
            return scannerRank;
        }

        const pathRank = left.path.localeCompare(right.path);
        if (pathRank !== 0) {
            return pathRank;
        }

        return left.start_line - right.start_line;
    });
}

export function chunkAnnotations(annotations: CheckRunAnnotation[], chunkSize = 50): CheckRunAnnotation[][] {
    const chunks: CheckRunAnnotation[][] = [];

    for (let index = 0; index < annotations.length; index += chunkSize) {
        chunks.push(annotations.slice(index, index + chunkSize));
    }

    return chunks;
}

export function prepareAnnotations(findings: Finding[], annotationCap: number): PreparedAnnotations {
    const annotations = findings
        .map(buildAnnotationFromFinding)
        .filter((annotation): annotation is CheckRunAnnotation => annotation !== null);

    const rankedAnnotations = rankAnnotations(dedupeAnnotations(annotations));
    const inlineAnnotations = rankedAnnotations.slice(0, annotationCap);
    const overflowAnnotations = rankedAnnotations.slice(annotationCap);

    return {
        inlineAnnotations,
        overflowAnnotations,
        chunks: chunkAnnotations(inlineAnnotations)
    };
}
