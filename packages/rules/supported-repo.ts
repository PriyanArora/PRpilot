export function isRepoSupported(rootFiles: string[]): boolean {
    return rootFiles.includes("package.json") && rootFiles.includes("package-lock.json");
}