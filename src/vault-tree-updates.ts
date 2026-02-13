import { getFileName } from "./path-utils";
import type { FileEntry } from "./tauri-api";

const IGNORED_DIRS = new Set(["node_modules", "target", "dist", "build"]);

function normalizePath(input: string): string {
  const normalized = input.replace(/\\+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

function startsWithPath(path: string, root: string): boolean {
  const lowerPath = path.toLowerCase();
  const lowerRoot = root.toLowerCase();
  return (
    lowerPath === lowerRoot ||
    lowerPath.startsWith(`${lowerRoot}/`)
  );
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized;
  return normalized.slice(0, idx);
}

function relativeToRoot(path: string, root: string): string {
  if (path === root) return "";
  return path.slice(root.length + 1);
}

function shouldIgnoreRelativePath(relativePath: string): boolean {
  if (!relativePath) return false;
  const segments = relativePath.split("/").filter(Boolean);
  return segments.some(
    (segment) =>
      segment.startsWith(".") || IGNORED_DIRS.has(segment.toLowerCase())
  );
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function addDirectoryAncestors(
  directoryPath: string,
  vaultRoot: string,
  out: Set<string>
) {
  let current = directoryPath;
  while (startsWithPath(current, vaultRoot)) {
    out.add(current);
    const parent = dirname(current);
    if (parent === current || parent === vaultRoot) {
      break;
    }
    current = parent;
  }
}

export function deriveAffectedDirectories(
  changedPaths: string[],
  vaultRootPath: string,
  maxDirs: number
): { directories: string[]; fullRefresh: boolean } {
  const vaultRoot = normalizePath(vaultRootPath);
  const affected = new Set<string>();

  for (const rawPath of changedPaths) {
    const path = normalizePath(rawPath);
    if (!startsWithPath(path, vaultRoot)) continue;

    const relativePath = relativeToRoot(path, vaultRoot);
    if (shouldIgnoreRelativePath(relativePath)) continue;

    if (relativePath && !isMarkdownPath(path) && relativePath.includes(".")) {
      // Non-markdown files do not affect the rendered vault tree.
      continue;
    }

    const directory = path === vaultRoot ? vaultRoot : dirname(path);
    if (!startsWithPath(directory, vaultRoot)) continue;
    addDirectoryAncestors(directory, vaultRoot, affected);
  }

  if (affected.size === 0) {
    return { directories: [], fullRefresh: false };
  }

  if (affected.size > maxDirs) {
    return { directories: [vaultRoot], fullRefresh: true };
  }

  return {
    directories: Array.from(affected).sort((a, b) => b.length - a.length),
    fullRefresh: false,
  };
}

function sortEntries(entries: FileEntry[]) {
  entries.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

function findDirectoryEntry(
  entries: FileEntry[],
  targetPath: string
): FileEntry | null {
  for (const entry of entries) {
    if (!entry.is_dir) continue;
    if (normalizePath(entry.path) === targetPath) return entry;
    if (entry.children) {
      const found = findDirectoryEntry(entry.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function removeEmptyDirectories(entries: FileEntry[]) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry.is_dir || !entry.children) continue;
    removeEmptyDirectories(entry.children);
    if (entry.children.length === 0) {
      entries.splice(i, 1);
    }
  }
}

function replaceExistingDirectory(
  entries: FileEntry[],
  targetPath: string,
  replacementChildren: FileEntry[]
): boolean {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.is_dir) continue;

    if (normalizePath(entry.path) === targetPath) {
      if (replacementChildren.length === 0) {
        entries.splice(i, 1);
      } else {
        entry.children = replacementChildren;
      }
      return true;
    }

    if (entry.children && replaceExistingDirectory(entry.children, targetPath, replacementChildren)) {
      return true;
    }
  }

  return false;
}

function insertDirectory(
  entries: FileEntry[],
  vaultRoot: string,
  targetPath: string,
  replacementChildren: FileEntry[]
): boolean {
  if (replacementChildren.length === 0) return true;

  const parentPath = dirname(targetPath);
  const targetName = getFileName(targetPath);
  const targetEntry: FileEntry = {
    name: targetName,
    path: targetPath,
    is_dir: true,
    children: replacementChildren,
  };

  if (parentPath === vaultRoot) {
    entries.push(targetEntry);
    sortEntries(entries);
    return true;
  }

  const parent = findDirectoryEntry(entries, parentPath);
  if (!parent) return false;

  if (!parent.children) {
    parent.children = [];
  }
  parent.children.push(targetEntry);
  sortEntries(parent.children);
  return true;
}

function cloneTree(entries: FileEntry[]): FileEntry[] {
  return entries.map((entry) => ({
    ...entry,
    children: entry.children ? cloneTree(entry.children) : null,
  }));
}

export function applyDirectorySnapshot(
  currentTree: FileEntry[],
  vaultRootPath: string,
  directoryPath: string,
  replacementChildren: FileEntry[]
): { tree: FileEntry[]; applied: boolean } {
  const vaultRoot = normalizePath(vaultRootPath);
  const targetPath = normalizePath(directoryPath);
  const nextTree = cloneTree(currentTree);
  const replacement = cloneTree(replacementChildren);

  if (targetPath === vaultRoot) {
    sortEntries(replacement);
    return { tree: replacement, applied: true };
  }

  sortEntries(replacement);
  const replaced = replaceExistingDirectory(nextTree, targetPath, replacement);
  if (!replaced) {
    const inserted = insertDirectory(nextTree, vaultRoot, targetPath, replacement);
    if (!inserted) return { tree: currentTree, applied: false };
  }

  removeEmptyDirectories(nextTree);
  return { tree: nextTree, applied: true };
}
