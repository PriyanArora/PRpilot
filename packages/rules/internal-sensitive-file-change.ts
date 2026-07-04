import type { ChangedFile } from "./changed-file";
import type { Finding, FindingSeverity } from "./finding";
import type { Coverage } from "./coverage";

// Classify why a path is sensitive so the finding can say so, and rank severity:
// live secret material (env files, private keys) is worse than config surface
// (workflows, manifests). Returns null for paths that are not sensitive.
function classifySensitivePath(path: string): { reason: string; severity: FindingSeverity } | null {
    const normalizedPath = path.toLowerCase();
    const basename = normalizedPath.split("/").pop() ?? normalizedPath;

    if (basename === ".env" || basename.startsWith(".env.")) {
        // .env.example is a template, not live secrets — still sensitive, but not high.
        const isTemplate = basename.endsWith(".example") || basename.endsWith(".sample") || basename.endsWith(".template");
        return {
            reason: isTemplate ? "environment file template" : "environment file",
            severity: isTemplate ? "medium" : "high"
        };
    }

    if (
        basename.endsWith(".pem")
        || basename.endsWith(".key")
        || basename.endsWith(".p12")
        || basename.endsWith(".pfx")
        || basename.startsWith("id_rsa")
        || basename.startsWith("id_ecdsa")
        || basename.startsWith("id_ed25519")
    ) {
        return { reason: "private key material", severity: "high" };
    }

    if (normalizedPath.startsWith(".github/workflows/")) {
        return { reason: "CI workflow", severity: "medium" };
    }

    if (normalizedPath === "package.json" || normalizedPath === "package-lock.json") {
        return { reason: "dependency manifest", severity: "medium" };
    }

    if (basename.includes("credential") || normalizedPath.includes("secret")) {
        return { reason: "credentials-related path", severity: "medium" };
    }

    return null;
}

export type SensitiveFileChangeResult = {
    findings: Finding[];
    coverage: Coverage;
};

export function evaluateSensitiveFileChange(changedFiles: ChangedFile[]): SensitiveFileChangeResult{
    const findings: Finding[] = [];

    for(const changedFile of changedFiles){
        // A rename away from a sensitive path is as reviewable as an edit in place.
        const classification = classifySensitivePath(changedFile.path)
            ?? (changedFile.previousPath === undefined ? null : classifySensitivePath(changedFile.previousPath));

        if (classification !== null) {
            findings.push({
                lane: "fast",
                pack: "internal",
                scanner: "internal",
                rule_id: "internal.sensitive-file-change",
                severity: classification.severity,
                blockability: "block",
                scope_basis: "changed_files",
                message: `Sensitive file changed (${classification.reason})`,
                path: changedFile.path,
                fingerprint: `internal.sensitive-file-change:${changedFile.path}`
            });
        }
    }

    return {
        findings,
        coverage: {
            lane: "fast",
            scanner: "internal",
            applicability: "applicable",
            status: "completed",
            scope_expected: "changed_files",
            scope_completed: "changed_files",
            duration_ms: 0,
            budget_ms: 0
        }
    };
}
