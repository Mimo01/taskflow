use std::path::PathBuf;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

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

            // Build Help > Keyboard Shortcuts menu item
            let shortcuts_item = MenuItemBuilder::new("Keyboard Shortcuts")
                .id("menu-keyboard-shortcuts")
                .accelerator("CmdOrCtrl+/")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&shortcuts_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "menu-keyboard-shortcuts" {
                let _ = app.emit("menu-keyboard-shortcuts", ());
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
