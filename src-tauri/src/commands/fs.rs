use crate::commands::vault::{current_vault_root, VaultState};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

fn normalize_user_path(path: &str) -> Result<PathBuf, String> {
    let parsed = PathBuf::from(path);
    if parsed
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Parent directory traversal is not allowed".to_string());
    }
    Ok(parsed)
}

fn resolve_existing_path(path: &str, vault_root: &Path) -> Result<PathBuf, String> {
    let normalized = normalize_user_path(path)?;
    let absolute = if normalized.is_absolute() {
        normalized
    } else {
        vault_root.join(normalized)
    };
    let canonical = std::fs::canonicalize(absolute).map_err(|e| e.to_string())?;
    if !canonical.starts_with(vault_root) {
        return Err("Path is outside the open vault".to_string());
    }
    Ok(canonical)
}

fn resolve_new_path(path: &str, vault_root: &Path) -> Result<PathBuf, String> {
    let normalized = normalize_user_path(path)?;
    let absolute = if normalized.is_absolute() {
        normalized
    } else {
        vault_root.join(normalized)
    };

    let parent = absolute
        .parent()
        .ok_or_else(|| "Invalid target path".to_string())?;
    let canonical_parent = std::fs::canonicalize(parent).map_err(|e| e.to_string())?;

    if !canonical_parent.starts_with(vault_root) {
        return Err("Path is outside the open vault".to_string());
    }

    let file_name = absolute
        .file_name()
        .ok_or_else(|| "Invalid file name".to_string())?;
    if file_name.to_string_lossy().is_empty() {
        return Err("Invalid file name".to_string());
    }

    let resolved = canonical_parent.join(file_name);
    if resolved.exists() {
        return Err("Target file already exists".to_string());
    }
    Ok(resolved)
}

#[tauri::command]
pub async fn read_file(
    path: String,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<String, String> {
    let vault_root = current_vault_root(&vault_state)?;
    let resolved = resolve_existing_path(&path, &vault_root)?;
    tokio::fs::read_to_string(&resolved)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(
    path: String,
    content: String,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<(), String> {
    let vault_root = current_vault_root(&vault_state)?;
    let resolved = resolve_existing_path(&path, &vault_root)?;
    tokio::fs::write(&resolved, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_file(
    path: String,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<String, String> {
    let vault_root = current_vault_root(&vault_state)?;
    let resolved = resolve_new_path(&path, &vault_root)?;

    tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&resolved)
        .await
        .map_err(|e| e.to_string())?;

    Ok(resolved.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_file(
    path: String,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<(), String> {
    let vault_root = current_vault_root(&vault_state)?;
    let resolved = resolve_existing_path(&path, &vault_root)?;
    tokio::fs::remove_file(&resolved)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_file(
    old_path: String,
    new_path: String,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<(), String> {
    let vault_root = current_vault_root(&vault_state)?;
    let resolved_old = resolve_existing_path(&old_path, &vault_root)?;
    let resolved_new = resolve_new_path(&new_path, &vault_root)?;
    tokio::fs::rename(&resolved_old, &resolved_new)
        .await
        .map_err(|e| e.to_string())
}
