use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn get_salt_path(app: &tauri::App) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("stronghold.salt")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let salt_path = get_salt_path(app);
            app.handle()
                .plugin(
                    tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
                )
                .expect("failed to register stronghold plugin");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
