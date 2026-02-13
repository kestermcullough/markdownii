import { describe, expect, it } from "vitest";
import type { FileEntry } from "./tauri-api";
import { applyDirectorySnapshot, deriveAffectedDirectories } from "./vault-tree-updates";

function file(path: string, name: string): FileEntry {
  return { name, path, is_dir: false, children: null };
}

function dir(path: string, name: string, children: FileEntry[]): FileEntry {
  return { name, path, is_dir: true, children };
}

describe("deriveAffectedDirectories", () => {
  it("collects directory ancestors for markdown file changes", () => {
    const root = "/vault";
    const result = deriveAffectedDirectories(
      ["/vault/projects/specs/todo.md"],
      root,
      12
    );

    expect(result.fullRefresh).toBe(false);
    expect(result.directories).toEqual([
      "/vault/projects/specs",
      "/vault/projects",
    ]);
  });

  it("ignores hidden and non-markdown file changes", () => {
    const root = "/vault";
    const result = deriveAffectedDirectories(
      ["/vault/.obsidian/workspace.json", "/vault/assets/logo.png"],
      root,
      12
    );

    expect(result.directories).toEqual([]);
  });
});

describe("applyDirectorySnapshot", () => {
  it("replaces an existing directory subtree", () => {
    const root = "/vault";
    const tree: FileEntry[] = [
      dir("/vault/projects", "projects", [
        dir("/vault/projects/specs", "specs", [
          file("/vault/projects/specs/a.md", "a.md"),
        ]),
      ]),
    ];

    const replacement = [file("/vault/projects/specs/b.md", "b.md")];
    const updated = applyDirectorySnapshot(
      tree,
      root,
      "/vault/projects/specs",
      replacement
    );

    expect(updated.applied).toBe(true);
    const projects = updated.tree[0];
    const specs = projects.children?.[0];
    expect(specs?.children?.map((entry) => entry.name)).toEqual(["b.md"]);
  });

  it("inserts a new directory under existing parent", () => {
    const root = "/vault";
    const tree: FileEntry[] = [dir("/vault/projects", "projects", [])];

    const updated = applyDirectorySnapshot(
      tree,
      root,
      "/vault/projects/specs",
      [file("/vault/projects/specs/new.md", "new.md")]
    );

    expect(updated.applied).toBe(true);
    const projects = updated.tree[0];
    expect(projects.children?.[0].path).toBe("/vault/projects/specs");
  });

  it("removes empty directories after snapshot update", () => {
    const root = "/vault";
    const tree: FileEntry[] = [
      dir("/vault/projects", "projects", [
        dir("/vault/projects/specs", "specs", [
          file("/vault/projects/specs/a.md", "a.md"),
        ]),
      ]),
    ];

    const updated = applyDirectorySnapshot(
      tree,
      root,
      "/vault/projects/specs",
      []
    );

    expect(updated.applied).toBe(true);
    expect(updated.tree).toEqual([]);
  });
});
