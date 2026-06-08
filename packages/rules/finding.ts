import type {Lane} from "../config/runtime-policy";

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export type FindingBlockability = "warn" | "block" | "report_only";

export type Finding = {
    lane: Lane;
    pack: string;
    scanner: string;
    rule_id: string; // exact rule, e.g. internal.large-change
    severity: FindingSeverity;
    blockability: FindingBlockability; // warn-only or merge-blocking
    scope_basis: string;
    path: string; // file path
    start_line?: number; // optional line location
    end_line?: number;
    message: string; // text shown to the user
    fingerprint: string; // stable ID used to dedupe repeated reports of the same issue
    raw_reference?: string;
};