import type {Lane} from "../config/runtime-policy";

export type CoverageApplicability = "applicable" | "not_applicable";

export type CoverageStatus =
    | "completed"
    | "not_applicable"
    | "skipped_by_policy"
    | "denied_by_limit"
    | "failed"
    | "timed_out"
    | "partial_input";

export type Coverage = {
    lane: Lane;
    scanner: string; //internal / eslint / gitleaks / actionlint
    applicability: CoverageApplicability; //should this rule/scanner apply here?
    status: CoverageStatus; //did it complete, skip, fail, timeout, or partially run?
    scope_expected: string; // what the rule/scanner was supposed to check
    scope_completed: string; //what it actually checked
    reason?: string; //explanation for skipped/failed/partial
    duration_ms: number; //how long it took
    budget_ms: number; //how much time allowed
};
