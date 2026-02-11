use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

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
        None => {
            vault_state.lock().map_err(|e| e.to_string())?.root = None;
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn get_vault_tree(
    vault_state: tauri::State<'_, Mutex<VaultState>>,
) -> Result<Vec<FileEntry>, String> {
    let root = current_vault_root(&vault_state)?;
    read_dir_recursive(&root)
}

fn read_dir_recursive(dir: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = read_dir_recursive(&path)?;
            // Only include directories that contain .md files (directly or nested)
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            }
        } else if path.extension().map_or(false, |ext| ext == "md") {
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}
