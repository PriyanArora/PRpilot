import type { Coverage } from "./coverage";
import type { Finding } from "./finding";

export type CheckRunConclusion =
    | "success"
    | "failure"
    | "action_required"
    | "neutral";

export type CheckRunPayloadInput = {
    lane: "fast" | "deep";
    repositoryFullName: string;
    prNumber: number;
    headSha: string;
    checkName: string;
    conclusion: CheckRunConclusion;
    findings: Finding[];
    coverage: Coverage[];
};
