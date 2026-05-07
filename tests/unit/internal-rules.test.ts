import {describe, expect, it} from "vitest";
import { ChangedFile } from '../../packages/rules/changed-file';
import { evaluateLargeChange } from "../../packages/rules/internal-large-change";

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
            ruleId: "internal.large-change",
            path: "src/big-file.ts",
            severity: "medium",
            blockability: "warn"
        });
          
        expect(result.findings[0]?.fingerprint).toBe("internal.large-change:src/big-file.ts");
    });

});
