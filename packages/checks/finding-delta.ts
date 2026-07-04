// Fingerprint diff between two runs of the same PR check, so the summary can say
// what a new push actually changed instead of restating the whole list.
export type FindingDelta = {
    newCount: number;
    resolvedCount: number;
    persistingCount: number;
};

export function diffFindingFingerprints(previous: string[], current: string[]): FindingDelta {
    const previousSet = new Set(previous);
    const currentSet = new Set(current);

    let persistingCount = 0;
    for (const fingerprint of currentSet) {
        if (previousSet.has(fingerprint)) {
            persistingCount += 1;
        }
    }

    return {
        newCount: currentSet.size - persistingCount,
        resolvedCount: previousSet.size - persistingCount,
        persistingCount
    };
}

export function formatFindingDelta(delta: FindingDelta): string {
    return `**Since last push:** ${delta.newCount} new, ${delta.resolvedCount} resolved, ${delta.persistingCount} persisting`;
}
