import {describe, expect, it} from "vitest";
import { ChangedFile } from '../../packages/rules/changed-file';
import { evaluateLargeChange } from "../../packages/rules/internal-large-change";
import { evaluateLockfileDrift } from "../../packages/rules/internal-lockfile-drift";
import { evaluateSensitiveFileChange } from "../../packages/rules/internal-sensitive-file-change";

function expectCompletedInternalCoverage(coverage: unknown): void {
    expect(coverage).toMatchObject({
        lane: "fast",
        scanner: "internal",
        applicability: "applicable",
        status: "completed",
        scope_expected: "changed_files",
        scope_completed: "changed_files",
        duration_ms: expect.any(Number),
        budget_ms: expect.any(Number)
    });
}

describe("internal.large-change", () => {
    it("emits a warning finding when a changed file is larger than 200 changed lines", () => {
        const changedFiles: ChangedFile[] = [
            {
                path: "src/big-file.ts",
                status: "modified",
                additions: 150,
                deletions: 51
            }
        ];

        const result = evaluateLargeChange(changedFiles);

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            lane: "fast",
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.large-change",
            scope_basis: "changed_files",
            path: "src/big-file.ts",
            severity: "medium",
            blockability: "warn",
            message: "Large file change: 201 changed lines (threshold 200)"
        });

        expect(result.findings[0]?.fingerprint).toBe("internal.large-change:src/big-file.ts");
        expectCompletedInternalCoverage(result.coverage);
    });

    it("does not flag lockfiles, whose large auto-generated diffs are expected noise", () => {
        const changedFiles: ChangedFile[] = [
            {
                path: "package-lock.json",
                status: "modified",
                additions: 900,
                deletions: 120
            }
        ];

        const result = evaluateLargeChange(changedFiles);

        expect(result.findings).toHaveLength(0);
    });

    it("flags a PR whose total size exceeds the threshold even when no single file does", () => {
        const changedFiles: ChangedFile[] = Array.from({ length: 5 }, (_, index) => ({
            path: `src/file-${index}.ts`,
            status: "modified" as const,
            additions: 150,
            deletions: 50
        }));

        const result = evaluateLargeChange(changedFiles);

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            rule_id: "internal.large-change",
            path: ".",
            fingerprint: "internal.large-change:total",
            message: "Large PR: 1000 changed lines across 5 files (threshold 800) — consider splitting it"
        });
    });
});

describe("internal.sensitive-file-change", () => {
    it("emits a blocking finding and normalized coverage for a sensitive file", () => {
        const changedFiles: ChangedFile[] = [
            {
                path: ".github/workflows/deploy.yml",
                status: "modified",
                additions: 4,
                deletions: 1
            }
        ];

        const result = evaluateSensitiveFileChange(changedFiles);

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            lane: "fast",
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.sensitive-file-change",
            scope_basis: "changed_files",
            path: ".github/workflows/deploy.yml",
            severity: "medium",
            blockability: "block",
            message: "Sensitive file changed (CI workflow)"
        });
        expect(result.findings[0]?.fingerprint).toBe("internal.sensitive-file-change:.github/workflows/deploy.yml");
        expectCompletedInternalCoverage(result.coverage);
    });

    it("flags live env files and private keys as high severity", () => {
        const changedFiles: ChangedFile[] = [
            { path: "config/.env.production", status: "added", additions: 5, deletions: 0 },
            { path: "deploy/server.pem", status: "added", additions: 20, deletions: 0 },
            { path: ".env.example", status: "modified", additions: 1, deletions: 0 }
        ];

        const result = evaluateSensitiveFileChange(changedFiles);

        expect(result.findings).toHaveLength(3);
        expect(result.findings[0]).toMatchObject({
            severity: "high",
            message: "Sensitive file changed (environment file)"
        });
        expect(result.findings[1]).toMatchObject({
            severity: "high",
            message: "Sensitive file changed (private key material)"
        });
        expect(result.findings[2]).toMatchObject({
            severity: "medium",
            message: "Sensitive file changed (environment file template)"
        });
    });

    it("flags a rename away from a sensitive path", () => {
        const changedFiles: ChangedFile[] = [
            { path: "docs/notes.md", status: "renamed", additions: 0, deletions: 0, previousPath: ".env" }
        ];

        const result = evaluateSensitiveFileChange(changedFiles);

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.severity).toBe("high");
    });
});

describe("internal.lockfile-drift", () => {
    it("emits a blocking finding and normalized coverage when package.json changes without package-lock.json", () => {
        const changedFiles: ChangedFile[] = [
            {
                path: "package.json",
                status: "modified",
                additions: 3,
                deletions: 1
            }
        ];

        const result = evaluateLockfileDrift(changedFiles);

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            lane: "fast",
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.lockfile-drift",
            scope_basis: "changed_files",
            path: "package.json",
            severity: "medium",
            blockability: "block",
            message: "package.json changed but no lockfile was updated — reinstall and commit the lockfile"
        });
        expect(result.findings[0]?.fingerprint).toBe("internal.lockfile-drift:package.json");
        expectCompletedInternalCoverage(result.coverage);
    });

    it("accepts any supported lockfile as satisfying the manifest change", () => {
        const changedFiles: ChangedFile[] = [
            { path: "package.json", status: "modified", additions: 2, deletions: 1 },
            { path: "pnpm-lock.yaml", status: "modified", additions: 40, deletions: 12 }
        ];

        expect(evaluateLockfileDrift(changedFiles).findings).toHaveLength(0);
    });

    it("warns when a lockfile changes without package.json", () => {
        const changedFiles: ChangedFile[] = [
            { path: "yarn.lock", status: "modified", additions: 30, deletions: 5 }
        ];

        const result = evaluateLockfileDrift(changedFiles);

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            rule_id: "internal.lockfile-drift",
            blockability: "warn",
            path: "yarn.lock",
            message: "yarn.lock changed without package.json — verify the dependency change is intentional"
        });
    });
});
