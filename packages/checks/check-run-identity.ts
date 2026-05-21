import type { Lane } from "../config/runtime-policy";

export type CheckRunName = "PRPilot Fast" | "PRPilot Deep";

export type CheckRunIdentityInput = {
    repositoryId: number;
    prNumber: number;
    lane: Lane;
    headSha: string;
};

export const CHECK_RUN_NAMES: Record<Lane, CheckRunName> = {
    fast: "PRPilot Fast",
    deep: "PRPilot Deep"
};

export function getCheckRunName(lane: Lane): CheckRunName {
    return CHECK_RUN_NAMES[lane];
}

export function buildCheckRunExternalId(input: CheckRunIdentityInput): string {
    return `prpilot:${input.repositoryId}:${input.prNumber}:${input.lane}:${input.headSha}`;
}
