import type {Lane} from "../config/runtime-policy";

export type CoverageApplicability = "applicable" | "not_applicable";

export type CoverageStatus =
    | "completed"
    | "skipped"
    | "failed"
    | "timed_out"
    | "partial";

export type Coverage = {
    lane: Lane;
    source: string; //internal / eslint / gitleaks / actionlint
    ruleId: string;
    applicability: CoverageApplicability; //should this rule/scanner apply here?
    status: CoverageStatus; //did it complete, skip, fail, timeout, or partially run?
    scopeExpected: string; // what the rule/scanner was supposed to check
    scopeCompleted: string; //what it actually checked
    reason?: string; //explanation for skipped/failed/partial
    durationMs: number; //how long it took
    budgetMs: number; //how much time allowed
};