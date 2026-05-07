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
                source: "internal",
                ruleId: "internal.sensitive-file-change",
                severity: "medium",
                blockability: "warn",
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
            source: "internal",
            ruleId: "internal.sensitive-file-change",
            applicability: "applicable",
            status: "completed",
            scopeExpected: "changed files",
            scopeCompleted: "changed files",
            durationMs: 0,
            budgetMs: 0
        }
    };
}
