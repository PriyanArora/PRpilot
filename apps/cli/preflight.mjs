import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_LARGE_CHANGE_THRESHOLD = 200;

function parseArgs(argv) {
  const args = {
    baseRef: undefined,
    cwd: process.cwd()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base") {
      args.baseRef = argv[index + 1];
      index += 1;
    } else if (arg === "--cwd") {
      args.cwd = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return undefined;
  }
}

function resolveMergeBase(cwd, requestedBaseRef) {
  const candidates = requestedBaseRef === undefined
    ? ["origin/main", "main", "master", "HEAD~1"]
    : [requestedBaseRef];

  for (const candidate of candidates) {
    const mergeBase = tryGit(["merge-base", candidate, "HEAD"], cwd);
    if (mergeBase !== undefined && mergeBase !== "") {
      return {
        ok: true,
        baseRef: candidate,
        mergeBase
      };
    }
  }

  return {
    ok: false,
    error: requestedBaseRef === undefined
      ? "Could not resolve a merge base from origin/main, main, master, or HEAD~1"
      : `Could not resolve merge base for ${requestedBaseRef}`
  };
}

function parseNumstat(output) {
  const byPath = new Map();
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    const [additionsText, deletionsText, path] = line.split("\t");
    byPath.set(path, {
      additions: additionsText === "-" ? 0 : Number(additionsText),
      deletions: deletionsText === "-" ? 0 : Number(deletionsText)
    });
  }
  return byPath;
}

function collectChangedFiles(cwd, mergeBase) {
  const numstat = parseNumstat(git(["diff", "--numstat", "-M", mergeBase], cwd));
  const statusOutput = git(["diff", "--name-status", "-M", mergeBase], cwd);
  const files = [];

  for (const line of statusOutput.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    const parts = line.split("\t");
    const statusCode = parts[0];
    const renamed = statusCode.startsWith("R");
    const path = renamed ? parts[2] : parts[1];
    const previousPath = renamed ? parts[1] : undefined;
    const stats = numstat.get(path) ?? { additions: 0, deletions: 0 };
    const status = statusCode.startsWith("A")
      ? "added"
      : statusCode.startsWith("D")
        ? "deleted"
        : renamed
          ? "renamed"
          : "modified";

    files.push({
      path,
      previousPath,
      status,
      additions: stats.additions,
      deletions: stats.deletions
    });
  }

  return files;
}

function parseInlineArray(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }
  const body = trimmed.slice(1, -1).trim();
  return body === "" ? [] : body.split(",").map((part) => part.trim());
}

function loadRepositoryPolicy(cwd) {
  const configPath = join(cwd, ".prpilot.yml");
  if (!existsSync(configPath)) {
    return {
      includePaths: [],
      ignorePaths: [],
      largeChangeThreshold: DEFAULT_LARGE_CHANGE_THRESHOLD
    };
  }

  const content = readFileSync(configPath, "utf8");
  const includeLine = content.match(/include_paths:\s*(\[[^\]]*\])/);
  const ignoreLine = content.match(/ignore_paths:\s*(\[[^\]]*\])/);
  const thresholdLine = content.match(/large_change_threshold_lines:\s*(\d+)/);

  return {
    includePaths: includeLine === null ? [] : parseInlineArray(includeLine[1]),
    ignorePaths: ignoreLine === null ? [] : parseInlineArray(ignoreLine[1]),
    largeChangeThreshold: thresholdLine === null ? DEFAULT_LARGE_CHANGE_THRESHOLD : Number(thresholdLine[1])
  };
}

function matchesPattern(path, pattern) {
  if (pattern.endsWith("/**")) {
    return path.startsWith(pattern.slice(0, -3));
  }
  if (!pattern.includes("*")) {
    return path === pattern;
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

function applyPathPolicy(files, policy) {
  return files.filter((file) => {
    const included = policy.includePaths.length === 0
      || policy.includePaths.some((pattern) => matchesPattern(file.path, pattern));
    const ignored = policy.ignorePaths.some((pattern) => matchesPattern(file.path, pattern));
    return included && !ignored;
  });
}

function isSensitivePath(path) {
  const normalizedPath = path.toLowerCase();
  return normalizedPath.startsWith(".github/workflows/")
    || normalizedPath === ".env.example"
    || normalizedPath.endsWith(".env.example")
    || normalizedPath === "package.json"
    || normalizedPath === "package-lock.json"
    || normalizedPath.includes("secret");
}

function finding(ruleId, path, blockability, message) {
  return {
    lane: "fast",
    pack: "internal",
    scanner: "internal",
    rule_id: ruleId,
    severity: blockability === "block" ? "medium" : "low",
    blockability,
    scope_basis: "changed_files",
    path,
    message,
    fingerprint: `${ruleId}:${path}`
  };
}

function coverage(scanner, status, reason) {
  return {
    lane: "fast",
    scanner,
    applicability: status === "not_applicable" ? "not_applicable" : "applicable",
    status,
    scope_expected: "changed_files",
    scope_completed: status === "completed" ? "changed_files" : "not_run",
    reason,
    duration_ms: 0,
    budget_ms: 0
  };
}

function evaluate(files, policy, cwd) {
  const findings = [];
  const coverages = [coverage("internal", "completed")];

  if (!existsSync(join(cwd, "package.json")) || !existsSync(join(cwd, "package-lock.json"))) {
    coverages.push(coverage("repository-support", "partial_input", "Missing root package.json or package-lock.json"));
  }

  for (const file of files) {
    const changedLines = file.additions + file.deletions;
    if (changedLines > policy.largeChangeThreshold) {
      findings.push(finding(
        "internal.large-change",
        file.path,
        "warn",
        `Large file change: ${changedLines} changed lines`
      ));
    }
    if (isSensitivePath(file.path) || (file.previousPath !== undefined && isSensitivePath(file.previousPath))) {
      findings.push(finding(
        "internal.sensitive-file-change",
        file.path,
        "block",
        "A sensitive file changed"
      ));
    }
  }

  const packageJsonChanged = files.some((file) => file.path === "package.json");
  const lockfileChanged = files.some((file) => file.path === "package-lock.json");
  if (packageJsonChanged && !lockfileChanged) {
    findings.push(finding(
      "internal.lockfile-drift",
      "package.json",
      "block",
      "A lockfile drifted"
    ));
  }

  return {
    findings,
    coverage: coverages
  };
}

function summarize(result, context) {
  const blockingFindings = result.findings.filter((item) => item.blockability === "block");
  const advisoryFindings = result.findings.filter((item) => item.blockability !== "block");
  const coverageGaps = result.coverage.filter((item) => item.status !== "completed" && item.status !== "not_applicable");
  const conclusion = coverageGaps.length > 0
    ? "action_required"
    : blockingFindings.length > 0
      ? "failure"
      : "success";

  return {
    title: "PRPilot Preflight",
    base_ref: context.baseRef,
    merge_base: context.mergeBase,
    conclusion,
    blocking_findings: blockingFindings.length,
    advisory_findings: advisoryFindings.length,
    coverage_gaps: coverageGaps.length,
    findings: result.findings,
    coverage: result.coverage,
    note: "ESLint is not executed here; deployed PRPilot uses a PRPilot-owned baseline ESLint configuration that may differ from the repository's own setup."
  };
}

export function runPreflight(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const mergeBase = resolveMergeBase(args.cwd, args.baseRef);
  if (!mergeBase.ok) {
    return {
      exitCode: 1,
      summary: {
        title: "PRPilot Preflight",
        conclusion: "action_required",
        coverage_gaps: 1,
        error: mergeBase.error
      }
    };
  }

  const policy = loadRepositoryPolicy(args.cwd);
  const changedFiles = applyPathPolicy(collectChangedFiles(args.cwd, mergeBase.mergeBase), policy);
  const result = evaluate(changedFiles, policy, args.cwd);
  const summary = summarize(result, mergeBase);

  return {
    exitCode: summary.conclusion === "success" ? 0 : 1,
    summary
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPreflight();
  console.log(JSON.stringify(result.summary, null, 2));
  process.exitCode = result.exitCode;
}
