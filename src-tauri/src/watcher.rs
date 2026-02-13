use crate::commands::vault::{current_vault_root, VaultState};
use notify::{
    event::{ModifyKind, RenameMode},
    Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
#[derive(Clone, Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FsChangeEvent {
    pub kind: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}
pub struct WatcherState {
    watcher: Option<RecommendedWatcher>,
}
impl WatcherState {
    pub fn new() -> Self {
        Self { watcher: None }
    }
}

fn event_kind(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Remove(_) => "delete",
        EventKind::Modify(ModifyKind::Name(_)) => "rename",
        EventKind::Modify(_) => "change",
        _ => "other",
    }
}

fn map_notify_event(event: Event) -> Vec<FsChangeEvent> {
    match event.kind {
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => {
            if event.paths.len() >= 2 {
                let old_path = event.paths[0].to_string_lossy().to_string();
                let path = event.paths[1].to_string_lossy().to_string();
                return vec![FsChangeEvent {
                    kind: "rename".to_string(),
                    path,
                    old_path: Some(old_path),
                }];
            }
        }
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
            return event
                .paths
                .into_iter()
                .map(|path| FsChangeEvent {
                    kind: "delete".to_string(),
                    path: path.to_string_lossy().to_string(),
                    old_path: None,
                })
                .collect();
        }
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
            return event
                .paths
                .into_iter()
                .map(|path| FsChangeEvent {
                    kind: "create".to_string(),
                    path: path.to_string_lossy().to_string(),
                    old_path: None,
                })
                .collect();
        }
        _ => {}
    }

    let kind = event_kind(&event.kind).to_string();
    event
        .paths
        .into_iter()
        .map(|path| FsChangeEvent {
            kind: kind.clone(),
            path: path.to_string_lossy().to_string(),
            old_path: None,
        })
        .collect()
}
#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    watcher_state: State<'_, Mutex<WatcherState>>,
    vault_state: State<'_, Mutex<VaultState>>,
) -> Result<(), String> {
    let vault_root = current_vault_root(&vault_state)?;
    let app_handle = app.clone();
    let mut watcher =
        notify::recommended_watcher(move |result: notify::Result<Event>| match result {
            Ok(event) => {
                let changes = map_notify_event(event);
                if !changes.is_empty() {
                    let _ = app_handle.emit("fs-change", changes);
                }
            }
            Err(error) => {
                eprintln!("watcher error: {error}");
            }
        })
        .map_err(|e| e.to_string())?;

    watcher
        .watch(vault_root.as_path(), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    watcher_state.lock().map_err(|e| e.to_string())?.watcher = Some(watcher);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, RemoveKind};
    use std::path::PathBuf;

    #[test]
    fn maps_rename_both_to_single_structured_event() {
        let event = Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Both)))
            .add_path(PathBuf::from("/vault/old.md"))
            .add_path(PathBuf::from("/vault/new.md"));

        let mapped = map_notify_event(event);
        assert_eq!(
            mapped,
            vec![FsChangeEvent {
                kind: "rename".to_string(),
                path: "/vault/new.md".to_string(),
                old_path: Some("/vault/old.md".to_string()),
            }]
        );
    }

    #[test]
    fn maps_remove_events_to_delete_kind() {
        let event = Event::new(EventKind::Remove(RemoveKind::File))
            .add_path(PathBuf::from("/vault/deleted.md"));

        let mapped = map_notify_event(event);
        assert_eq!(mapped.len(), 1);
        assert_eq!(mapped[0].kind, "delete");
        assert_eq!(mapped[0].path, "/vault/deleted.md");
        assert_eq!(mapped[0].old_path, None);
    }

    #[test]
    fn maps_create_events_to_create_kind() {
        let event =
            Event::new(EventKind::Create(CreateKind::File)).add_path(PathBuf::from("/vault/new.md"));

        let mapped = map_notify_event(event);
        assert_eq!(mapped.len(), 1);
        assert_eq!(mapped[0].kind, "create");
        assert_eq!(mapped[0].path, "/vault/new.md");
        assert_eq!(mapped[0].old_path, None);
    }
}