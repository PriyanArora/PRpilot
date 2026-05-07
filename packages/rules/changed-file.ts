// Rule metadata needs (internal rules before any external packages/scanners),
// internal.large-change uses path, additions, deletions, and status to detect oversized changes.
// internal.sensitive-file-change uses path, previousPath, and status to detect risky file edits or renames.
// internal.lockfile-drift uses path and status to compare package manifest changes against lockfile changes.
export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed";

export type ChangedFile = {
    path: string; //current file path
    status: ChangedFileStatus; //how the file changed
    additions: number; //lines added
    deletions: number; //lines deleted
    patch?: string; //optional diff text from GitHub
    previousPath?: string;  //prev file path
};