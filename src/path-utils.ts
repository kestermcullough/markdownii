function normalizeSlashes(path: string): string {
  return path.replace(/\\+/g, "/");
}

export function getFileName(path: string): string {
  const normalized = normalizeSlashes(path).replace(/\/+$/, "");
  if (!normalized) return path;
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function getRelativePath(path: string, root: string): string {
  const normalizedPath = normalizeSlashes(path);
  const normalizedRoot = normalizeSlashes(root).replace(/\/+$/, "");

  const pathLower = normalizedPath.toLowerCase();
  const rootLower = normalizedRoot.toLowerCase();

  if (pathLower === rootLower) return "";

  if (pathLower.startsWith(rootLower + "/")) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }

  if (pathLower.startsWith(rootLower)) {
    return normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, "");
  }

  return getFileName(path);
}
