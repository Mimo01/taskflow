use std::path::PathBuf;
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, Submenu};
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

            let handle = app.handle();

            // --- App menu (macOS standard: About, Services, Hide, Quit) ---
            let app_menu = Submenu::with_items(
                handle,
                "TaskFlow",
                true,
                &[
                    &PredefinedMenuItem::about(handle, Some("About TaskFlow"), None)?,
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

            // --- File menu ---
            let new_issue_item = MenuItemBuilder::new("New Issue")
                .id("menu-new-issue")
                .accelerator("CmdOrCtrl+N")
                .build(handle)?;
            let file_menu = Submenu::with_items(
                handle,
                "File",
                true,
                &[
                    &new_issue_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ],
            )?;

            // --- Edit menu (macOS standard predefined items) ---
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

            // --- View menu ---
            let command_palette_item = MenuItemBuilder::new("Command Palette")
                .id("menu-command-palette")
                .accelerator("CmdOrCtrl+K")
                .build(handle)?;
            let view_menu = Submenu::with_items(
                handle,
                "View",
                true,
                &[
                    &command_palette_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::fullscreen(handle, None)?,
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

            // --- Window menu (macOS standard) ---
            let window_menu = Submenu::with_items(
                handle,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ],
            )?;

            // --- Help menu ---
            let shortcuts_item = MenuItemBuilder::new("Keyboard Shortcuts")
                .id("menu-keyboard-shortcuts")
                .accelerator("CmdOrCtrl+/")
                .build(handle)?;
            let help_menu = Submenu::with_items(
                handle,
                "Help",
                true,
                &[&shortcuts_item],
            )?;

            // Build full menu bar
            let menu = Menu::with_items(
                handle,
                &[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &go_menu,
                    &window_menu,
                    &help_menu,
                ],
            )?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "menu-keyboard-shortcuts"
                | "menu-new-issue"
                | "menu-command-palette"
                | "menu-nav-sprint"
                | "menu-nav-backlog"
                | "menu-nav-notifications"
                | "menu-nav-settings" => {
                    let _ = app.emit(id, ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
