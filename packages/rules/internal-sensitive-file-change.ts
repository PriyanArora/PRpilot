import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

function isSensitivePath(path: string): boolean {
    const normalizedPath = path.toLowerCase();

    return normalizedPath.startsWith(".github/workflows/")
        || normalizedPath === ".env.example"
        || normalizedPath.endsWith(".env.example")
        || normalizedPath === "package.json"
        || normalizedPath === "package-lock.json"
        || normalizedPath.includes("secret");
}

export type SensitiveFileChangeResult = {
    findings: Finding[];
    coverage: Coverage;
};


export function evaluateSensitiveFileChange(changedFiles: ChangedFile[]): SensitiveFileChangeResult{
    const findings: Finding[] = [];
    
    for(const changedFile of changedFiles){
        
        if(isSensitivePath(changedFile.path) || (changedFile.previousPath !== undefined && isSensitivePath(changedFile.previousPath))){

            findings.push({
                lane: "fast",
                pack: "internal",
                scanner: "internal",
                rule_id: "internal.sensitive-file-change",
                severity: "medium",
                blockability: "block",
                scope_basis: "changed_files",
                message: "A sensitive file changed",
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
