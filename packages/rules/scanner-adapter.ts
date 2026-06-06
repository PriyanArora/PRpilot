import type { Lane } from "../config/runtime-policy";
import type { ChangedFile } from "./changed-file";
import type { Coverage } from "./coverage";
import type { Finding } from "./finding";

export type ScannerAdapterInput = {
    scanner: string;
    lane: Lane;
    changedFiles: ChangedFile[];
    budgetMs: number;
};

export type ScannerAdapterResult = {
    findings: Finding[];
    coverage: Coverage;
};

export type ScannerAdapter = {
    scanner: string;
    run(input: ScannerAdapterInput): Promise<ScannerAdapterResult>; //type scanneradapater must have scanner as string and have a method that takes input written and async return scanneradaptresult
};
