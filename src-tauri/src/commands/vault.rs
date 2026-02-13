use crate::vault_tree::{scan_markdown_tree, FileEntry};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;

pub struct VaultState {
    root: Option<PathBuf>,
}

impl VaultState {
    pub fn new() -> Self {
        Self { root: None }
    }
}

pub fn current_vault_root(
    vault_state: &tauri::State<'_, Mutex<VaultState>>,
) -> Result<PathBuf, String> {
    let state = vault_state.lock().map_err(|e| e.to_string())?;
    state
        .root
        .clone()
        .ok_or_else(|| "No vault is currently open".to_string())
}

#[tauri::command]
pub async fn open_vault(
    app: tauri::AppHandle,
    vault_state: tauri::State<'_, Mutex<VaultState>>,
) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder.map(|f| f.to_string()));
    });

    match rx.recv().map_err(|e| e.to_string())? {
        Some(path) => {
            let canonical_root =
                std::fs::canonicalize(PathBuf::from(path)).map_err(|e| e.to_string())?;
            if !canonical_root.is_dir() {
                return Err("Selected vault path is not a directory".to_string());
            }

            vault_state.lock().map_err(|e| e.to_string())?.root = Some(canonical_root.clone());

            Ok(Some(canonical_root.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn get_vault_tree(
    vault_state: tauri::State<'_, Mutex<VaultState>>,
) -> Result<Vec<FileEntry>, String> {
    let root = current_vault_root(&vault_state)?;
    scan_markdown_tree(&root)
}

#[tauri::command]
pub async fn get_vault_subtree(
    path: String,
    vault_state: tauri::State<'_, Mutex<VaultState>>,
) -> Result<Vec<FileEntry>, String> {
    let root = current_vault_root(&vault_state)?;
    let requested = PathBuf::from(path);
    let absolute = if requested.is_absolute() {
        requested
    } else {
        root.join(requested)
    };

    if absolute.exists() {
        let canonical = std::fs::canonicalize(&absolute).map_err(|e| e.to_string())?;
        if !canonical.starts_with(&root) {
            return Err("Path is outside the open vault".to_string());
        }
        if !canonical.is_dir() {
            return Err("Path is not a directory".to_string());
        }
        return scan_markdown_tree(&canonical);
    }

    // Deletions may arrive as watcher paths after the directory no longer exists.
    // Walk up to the nearest existing ancestor so we can still enforce vault boundaries.
    let mut ancestor: Option<&Path> = Some(absolute.as_path());
    while let Some(path) = ancestor {
        if path.exists() {
            let canonical_ancestor = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
            if !canonical_ancestor.starts_with(&root) {
                return Err("Path is outside the open vault".to_string());
            }
            return Ok(Vec::new());
        }
        ancestor = path.parent();
    }

    Err("Path is outside the open vault".to_string())
}
