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
            message: "Large file change: 201 changed lines"
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
            message: "A sensitive file changed"
        });
        expect(result.findings[0]?.fingerprint).toBe("internal.sensitive-file-change:.github/workflows/deploy.yml");
        expectCompletedInternalCoverage(result.coverage);
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
            message: "A lockfile drifted"
        });
        expect(result.findings[0]?.fingerprint).toBe("internal.lockfile-drift:package.json");
        expectCompletedInternalCoverage(result.coverage);
    });
});
