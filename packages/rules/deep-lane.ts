import type {Lane, RuntimePolicy} from "../config/runtime-policy";
import type { ChangedFile } from "./changed-file";

export type DeepLaneTrigger =
    | "check_run.requested_action"
    | "manual"
    | "ci";

export type DeepLaneAdmissionDenialReason =
    | "deep_lane_disabled"
    | "fast_lane_not_complete"
    | "quota_exhausted"
    | "deep_lane_already_running"
    | "unsupported_repo"
    | "stale_head_sha";

export type DeepLaneAdmission =
    |{
        admitted: true;
        lane: Extract<Lane, "deep">;
        trigger: DeepLaneTrigger;
    }|{
        admitted: false;
        lane: Extract<Lane, "deep">;
        trigger: DeepLaneTrigger;
        reason: DeepLaneAdmissionDenialReason;
    };

//extra repo files scanner/rules may read
export type DeepLaneSupportFilePattern =
    | "package.json"
    | "package-lock.json"
    | "eslint.config.*"
    | ".eslintrc*"
    | "tsconfig*.json"
    | ".github/workflows/**";

//the full bundle of data deep lane rules/scanners receive or can take this as allowed input for deep lane
export type DeepLaneInput = {
    prNumber: number;
    repositoryId: number;
    repositoryFullName: string;
    baseSha: string;
    headSha: string;
    changedFiles: ChangedFile[];
    runtimePolicy: RuntimePolicy;
    supportFileAllowList: DeepLaneSupportFilePattern[]; 
    latestFastLaneHeadSha: string;
    broaderRepoContextAllowed: boolean;
    repoArchiveRequired: boolean;
    repoMaterialization: DeepLaneRepoMaterialization;
};

//being used above
export type DeepLaneRepoMaterialization = {
    source: "github_tarball"; //deep lane gets repo snapshot from GitHub tarball
    headSha: string; //exact commit SHA being scanned
    temporaryWorkspacePath: string; //where the tarball is extracted (temp workspace)
    readOnly: true; //scanners must not modify repo files
    cleanupRequired: true; //delete temp workspace after scan
};