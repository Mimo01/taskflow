use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

struct DebugMenuState {
    submenu: Submenu<tauri::Wry>,
    visible: Mutex<bool>,
}

#[tauri::command]
fn toggle_debug_menu(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let state = app.state::<DebugMenuState>();
    let menu = app.menu().ok_or("no menu")?;
    let mut visible = state.visible.lock().map_err(|e| e.to_string())?;
    if enabled && !*visible {
        // Insert before Help (position 2: App=0, Go=1, Debug=2, Help=3)
        menu.insert(&state.submenu, 2).map_err(|e| e.to_string())?;
        *visible = true;
    } else if !enabled && *visible {
        menu.remove(&state.submenu).map_err(|e| e.to_string())?;
        *visible = false;
    }
    Ok(())
}

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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let salt_path = get_salt_path(app);
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())
                .expect("failed to register stronghold plugin");

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())
                .expect("failed to register updater plugin");

            let handle = app.handle();

            // --- App menu (macOS standard: About, Services, Hide, Quit) ---
            let about_item = MenuItemBuilder::new("About TaskFlow")
                .id("menu-about")
                .build(handle)?;
            let app_menu = Submenu::with_items(
                handle,
                "TaskFlow",
                true,
                &[
                    &about_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, None)?,
                    &PredefinedMenuItem::hide_others(handle, None)?,
                    &PredefinedMenuItem::show_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::quit(handle, None)?,
                ],
            )?;

            // --- Go menu ---
            let nav_sprint_item = MenuItemBuilder::new("Sprint Board")
                .id("menu-nav-sprint")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(handle)?;
            let nav_backlog_item = MenuItemBuilder::new("Backlog")
                .id("menu-nav-backlog")
                .accelerator("CmdOrCtrl+Shift+B")
                .build(handle)?;
            let nav_notifications_item = MenuItemBuilder::new("Notifications")
                .id("menu-nav-notifications")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(handle)?;
            let nav_settings_item = MenuItemBuilder::new("Settings")
                .id("menu-nav-settings")
                .accelerator("CmdOrCtrl+,")
                .build(handle)?;
            let go_menu = Submenu::with_items(
                handle,
                "Go",
                true,
                &[
                    &nav_sprint_item,
                    &nav_backlog_item,
                    &nav_notifications_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &nav_settings_item,
                ],
            )?;

            // --- Debug menu (added/removed at runtime via toggle_debug_menu command) ---
            let dev_tools_item = MenuItemBuilder::new("Developer Tools")
                .id("menu-dev-tools")
                .accelerator("CmdOrCtrl+Shift+D")
                .build(handle)?;
            let debug_submenu = Submenu::with_items(handle, "Dev Tools", true, &[&dev_tools_item])?;
            app.manage(DebugMenuState {
                submenu: debug_submenu,
                visible: Mutex::new(false),
            });

            // --- Help menu ---
            let command_palette_item = MenuItemBuilder::new("Command Palette")
                .id("menu-command-palette")
                .accelerator("CmdOrCtrl+K")
                .build(handle)?;
            let shortcuts_item = MenuItemBuilder::new("Keyboard Shortcuts")
                .id("menu-keyboard-shortcuts")
                .accelerator("CmdOrCtrl+/")
                .build(handle)?;
            let about_help_item = MenuItemBuilder::new("About TaskFlow")
                .id("menu-about")
                .build(handle)?;
            let help_menu = Submenu::with_items(
                handle,
                "Help",
                true,
                &[
                    &command_palette_item,
                    &shortcuts_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &about_help_item,
                ],
            )?;

            // --- Edit menu (required on macOS for Cmd+V/C/X/A/Z to reach the webview) ---
            let edit_menu = Submenu::with_items(
                handle,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ],
            )?;

            // Build full menu bar
            let menu = Menu::with_items(handle, &[&app_menu, &edit_menu, &go_menu, &help_menu])?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "menu-keyboard-shortcuts"
                | "menu-command-palette"
                | "menu-nav-sprint"
                | "menu-nav-backlog"
                | "menu-nav-notifications"
                | "menu-nav-settings"
                | "menu-dev-tools"
                | "menu-about" => {
                    let _ = app.emit(id, ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![greet, toggle_debug_menu])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
