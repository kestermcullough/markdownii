function normalizeSlashes(path: string): string {
  return path.replace(/\\+/g, "/");
}

function stripFileUrlPrefix(path: string): string {
  if (!path.startsWith("file://")) return path;
  return path.replace(/^file:\/\/+/, "");
}

function decodePathPart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function sanitizePath(path: string): string {
  return normalizeSlashes(stripFileUrlPrefix(path));
}

export function getFileName(path: string): string {
  const normalized = sanitizePath(path).replace(/\/+$/, "");
  if (!normalized) return path;
  const idx = normalized.lastIndexOf("/");
  const base = idx >= 0 ? normalized.slice(idx + 1) : normalized;
  return decodePathPart(base);
}

export function getRelativePath(path: string, root: string): string {
  const normalizedPath = sanitizePath(path);
  const normalizedRoot = sanitizePath(root).replace(/\/+$/, "");

  const pathLower = normalizedPath.toLowerCase();
  const rootLower = normalizedRoot.toLowerCase();

  if (pathLower === rootLower) return "";

  let relative = "";
  if (pathLower.startsWith(rootLower + "/")) {
    relative = normalizedPath.slice(normalizedRoot.length + 1);
  } else if (pathLower.startsWith(rootLower)) {
    relative = normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, "");
  }

  if (!relative) {
    return getFileName(path);
  }

  return relative
    .split("/")
    .map((segment) => decodePathPart(segment))
    .join("/");
}
