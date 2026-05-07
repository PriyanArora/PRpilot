import type { Lane, RuntimePolicy } from "../config/runtime-policy";
import type { ChangedFile } from "./changed-file";

//what makes FastLane run i.e the trigger that causes it 
export type FastLaneTrigger = 
    | "pull_request.opened"
    | "pull_request.reopened"
    | "pull_request.synchronize"
    | "pull_request.ready_for_review" //these are github webhook event + action names
    | "check_suite.rerequested";

//reasons we can reject fast-lane work
export type FastLaneAdmissionDenialReason =
    | "repo_not_selected"
    | "fast_lane_disabled"
    | "unsupported_repo"
    | "oversized_run"
    | "invalid_config"
    | "quota_exhausted"
    | "stale_head_sha";

//result of the admission decision
export type FastLaneAdmission =
    |{
        admitted: true;
        lane: Extract<Lane, "fast">; //means this type can only use the "fast" part.
        trigger: FastLaneTrigger;
    }|{
        admitted: false;
        lane: Extract<Lane, "fast">;
        trigger: FastLaneTrigger;
        reason: FastLaneAdmissionDenialReason;
    };

//extra repo files scanner/rules may read
export type FastLaneSupportFilePattern =
    | "package.json"
    | "package-lock.json"
    | "eslint.config.*"
    | ".eslintrc*"
    | "tsconfig*.json"
    | ".github/workflows/**";

//the full bundle of data fast lane rules/scanners receive or can take this as allowed input for fast lane
export type FastLaneInput = {
    prNumber: number;
    repositoryId: number;
    repositoryFullName: string;
    baseSha: string;
    headSha: string;
    changedFiles: ChangedFile[];
    runtimePolicy: RuntimePolicy;
    supportFileAllowList: FastLaneSupportFilePattern[]; 
}

