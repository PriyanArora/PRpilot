import type {Lane} from "../config/runtime-policy";

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export type FindingBlockability = "warn" | "block";

export type Finding = {
    lane: Lane;
    source: string; //tool/rule name, like internal or eslint
    ruleId: string; //exact rule, like internal.large-change
    severity: FindingSeverity;
    blockability: FindingBlockability; //warn-only or merge-blocking
    message: string; //what user sees
    path: string; //file path
    startLine?: number; //optional line location
    endLine?: number;
    fingerprint: string; //stable ID for dedupe later.  If the same scanner reports the same issue twice, fingerprint helps us keep one copy.
};