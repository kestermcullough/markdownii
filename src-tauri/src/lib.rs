use std::sync::Mutex;

mod commands;
mod watcher;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(watcher::WatcherState::new()))
        .manage(Mutex::new(commands::vault::VaultState::new()))
        .invoke_handler(tauri::generate_handler![
            commands::vault::open_vault,
            commands::vault::get_vault_tree,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::create_file,
            commands::fs::delete_file,
            commands::fs::rename_file,
            watcher::start_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
