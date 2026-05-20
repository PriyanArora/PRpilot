import type {Lane} from "../config/runtime-policy";

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export type FindingBlockability = "warn" | "block" | "report_only";

export type Finding = {
    lane: Lane;
    pack: string;
    scanner: string;
    rule_id: string; //exact rule, like internal.large-change
    severity: FindingSeverity;
    blockability: FindingBlockability;//warn-only or merge-blocking
    scope_basis: string;
    path: string;//file path
    start_line?: number;//optional line location
    end_line?: number;
    message: string;//what user sees
    fingerprint: string;//stable ID for dedupe later.  If the same scanner reports the same issue twice, fingerprint helps us keep one copy.
    raw_reference?: string;
};