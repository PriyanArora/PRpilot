import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function git(cwd: string, args: string[]): string {
    return execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
    }).trim();
}

function write(path: string, content: string): void {
    writeFileSync(path, content);
}

function createRepo(): string {
    const cwd = mkdtempSync(join(tmpdir(), "prpilot-preflight-"));
    git(cwd, ["init", "-b", "main"]);
    git(cwd, ["config", "user.email", "prpilot@example.com"]);
    git(cwd, ["config", "user.name", "PRPilot Test"]);
    write(join(cwd, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }, null, 2));
    write(join(cwd, "package-lock.json"), JSON.stringify({ name: "fixture", lockfileVersion: 3 }, null, 2));
    write(join(cwd, "README.md"), "initial\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "initial"]);
    git(cwd, ["checkout", "-b", "feature"]);
    return cwd;
}

async function runPreflight(cwd: string) {
    const { runPreflight: runPreflightCommand } = await import("../../apps/cli/preflight.mjs");
    return runPreflightCommand(["--base", "main", "--cwd", cwd]) as {
        exitCode: number;
        summary: {
            conclusion: string;
            findings: Array<{ rule_id: string }>;
            note: string;
        };
    };
}

describe("PRPilot preflight CLI", () => {
    it("returns exit code 1 and deployed-style output for critical findings", async () => {
        const cwd = createRepo();
        write(join(cwd, "package.json"), JSON.stringify({
            name: "fixture",
            version: "1.0.0",
            dependencies: {
                leftpad: "1.0.0"
            }
        }, null, 2));

        const result = await runPreflight(cwd);

        expect(result.exitCode).toBe(1);
        expect(result.summary.conclusion).toBe("failure");
        expect(result.summary.findings.map((finding) => finding.rule_id)).toContain("internal.lockfile-drift");
        expect(result.summary.note).toContain("baseline ESLint");
    });

    it("returns exit code 0 when local deterministic checks pass", async () => {
        const cwd = createRepo();
        write(join(cwd, "README.md"), "safe documentation change\n");

        const result = await runPreflight(cwd);

        expect(result.exitCode).toBe(0);
        expect(result.summary.conclusion).toBe("success");
        expect(result.summary.findings).toEqual([]);
    });

    it("applies local repo config path filters", async () => {
        const cwd = createRepo();
        write(join(cwd, ".prpilot.yml"), [
            "version: 1",
            "review:",
            "  include_paths: [package.json]",
            "  ignore_paths: [package.json]"
        ].join("\n"));
        write(join(cwd, "package.json"), JSON.stringify({
            name: "fixture",
            version: "2.0.0"
        }, null, 2));

        const result = await runPreflight(cwd);

        expect(result.exitCode).toBe(0);
        expect(result.summary.conclusion).toBe("success");
    });
});
