import type { Lane } from "../config/runtime-policy";
import type { Coverage } from "../rules/coverage";
import type { Finding } from "../rules/finding";
import type { CheckRunPayloadInput } from "../rules/check-run-payload-input";
import { getCheckRunName } from "./check-run-identity";
import { resolveCheckRunConclusion } from "./check-run-conclusion";

export type BuildCheckRunPayloadInput = {
    lane: Lane;
    repositoryFullName: string;
    prNumber: number;
    headSha: string;
    findings: Finding[];
    coverage: Coverage[];
};

export function buildCheckRunPayload(input: BuildCheckRunPayloadInput): CheckRunPayloadInput {
    return {
        lane: input.lane,
        repositoryFullName: input.repositoryFullName,
        prNumber: input.prNumber,
        headSha: input.headSha,
        checkName: getCheckRunName(input.lane),
        conclusion: resolveCheckRunConclusion(input),
        findings: input.findings,
        coverage: input.coverage
    };
}
