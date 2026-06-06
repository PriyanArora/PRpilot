export type PreflightSummary = {
    title: string;
    conclusion: string;
    findings: Array<{ rule_id: string }>;
    coverage?: unknown[];
    note: string;
};

export type PreflightRunResult = {
    exitCode: number;
    summary: PreflightSummary;
};

export function runPreflight(argv?: string[]): PreflightRunResult;
