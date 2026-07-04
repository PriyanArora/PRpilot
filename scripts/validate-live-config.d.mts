export type LiveConfigReport = {
    ok: boolean;
    errors: string[];
    warnings: string[];
};

export function validateLiveConfig(env: Record<string, string | undefined>): LiveConfigReport;
