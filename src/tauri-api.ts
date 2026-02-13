import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileEntry[] | null;
}

export async function openVaultDialog(): Promise<string | null> {
  return invoke<string | null>("open_vault");
}

export async function getVaultTree(): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("get_vault_tree");
}

export async function getVaultSubtree(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("get_vault_subtree", { path });
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function writeFile(
  path: string,
  content: string
): Promise<void> {
  return invoke("write_file", { path, content });
}

export async function createFile(path: string): Promise<string> {
  return invoke<string>("create_file", { path });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export async function renameFile(
  oldPath: string,
  newPath: string
): Promise<void> {
  return invoke("rename_file", { oldPath, newPath });
}

export async function startWatching(): Promise<void> {
  return invoke("start_watching");
}

export async function listenFsChanges(
  onPaths: (paths: string[]) => void
): Promise<UnlistenFn> {
  return listen<string[]>("fs-change", (event) => {
    onPaths(event.payload ?? []);
  });
}
