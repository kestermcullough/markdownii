use crate::commands::vault::{current_vault_root, VaultState};
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebounceEventResult};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

pub struct WatcherState {
    _debouncer: Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self { _debouncer: None }
    }
}

#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    watcher_state: State<'_, Mutex<WatcherState>>,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<(), String> {
    let vault_root = current_vault_root(&vault_state)?;
    let app_handle = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |res: DebounceEventResult| {
            if let Ok(events) = res {
                let paths: Vec<String> = events
                    .iter()
                    .map(|e| e.path.to_string_lossy().to_string())
                    .collect();
                let _ = app_handle.emit("fs-change", paths);
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watcher()
        .watch(std::path::Path::new(&vault_root), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    watcher_state.lock().map_err(|e| e.to_string())?._debouncer = Some(debouncer);

    Ok(())
}
