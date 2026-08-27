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

/// Save raw bytes to ~/Downloads/{filename} and return the final path.
/// Falls back to the OS temp directory if the Downloads directory is unavailable.
#[tauri::command]
fn save_attachment(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    let dir = dirs::download_dir()
        .or_else(|| std::env::temp_dir().into())
        .unwrap_or_else(std::env::temp_dir);

    // Sanitise filename: strip any path separators supplied by the caller.
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("attachment")
        .to_string();

    let dest = dir.join(&safe_name);

    // If a file with that name already exists, append a numeric suffix.
    let dest = unique_path(dest);

    std::fs::write(&dest, &bytes).map_err(|e| format!("Failed to save file: {e}"))?;

    dest.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Path contains invalid UTF-8".to_string())
}

/// Return `path` unchanged if it does not exist, otherwise append ` (1)`, ` (2)`, … to the stem.
fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("attachment")
        .to_string();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    let dir = path.parent().unwrap_or(std::path::Path::new("."));
    let mut counter = 1u32;
    loop {
        let candidate = dir.join(format!("{stem} ({counter}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

#[derive(serde::Serialize)]
struct BrowserInfo {
    id: String,
    label: String,
    path: String,
}

/// Detect installed browsers via filesystem presence checks only (`Path::exists()`).
/// No subprocess is spawned. Returns an empty Vec if nothing is found — this command
/// never errors. "System Default" is a UI-only concept and is not part of this list.
#[tauri::command]
fn list_browsers() -> Vec<BrowserInfo> {
    let mut browsers = Vec::new();

    #[cfg(target_os = "macos")]
    {
        let candidates: &[(&str, &str)] = &[
            ("safari", "Safari"),
            ("chrome", "Google Chrome"),
            ("firefox", "Firefox"),
            ("edge", "Microsoft Edge"),
            ("brave", "Brave Browser"),
            ("arc", "Arc"),
            ("vivaldi", "Vivaldi"),
            ("opera", "Opera"),
            ("chromium", "Chromium"),
            ("zen", "Zen Browser"),
        ];
        let home_apps = dirs::home_dir().map(|h| h.join("Applications"));
        for (id, name) in candidates {
            let system_path = std::path::PathBuf::from(format!("/Applications/{name}.app"));
            if system_path.exists() {
                browsers.push(BrowserInfo {
                    id: (*id).to_string(),
                    label: (*name).to_string(),
                    path: system_path.to_string_lossy().to_string(),
                });
                continue;
            }
            if let Some(home_apps) = &home_apps {
                let user_path = home_apps.join(format!("{name}.app"));
                if user_path.exists() {
                    browsers.push(BrowserInfo {
                        id: (*id).to_string(),
                        label: (*name).to_string(),
                        path: user_path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let candidates: &[(&str, &str, &str)] = &[
            ("chrome", "Google Chrome", "Google\\Chrome\\Application\\chrome.exe"),
            ("firefox", "Firefox", "Mozilla Firefox\\firefox.exe"),
            ("edge", "Microsoft Edge", "Microsoft\\Edge\\Application\\msedge.exe"),
            ("brave", "Brave Browser", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
            ("vivaldi", "Vivaldi", "Vivaldi\\Application\\vivaldi.exe"),
            ("opera", "Opera", "Opera\\opera.exe"),
        ];
        let roots: Vec<String> = ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"]
            .iter()
            .filter_map(|var| std::env::var(var).ok())
            .collect();
        for (id, name, rel) in candidates {
            for root in &roots {
                let candidate = std::path::Path::new(root).join(rel);
                if candidate.exists() {
                    browsers.push(BrowserInfo {
                        id: (*id).to_string(),
                        label: (*name).to_string(),
                        path: candidate.to_string_lossy().to_string(),
                    });
                    break;
                }
            }
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let candidates: &[(&str, &str, &str)] = &[
            ("firefox", "Firefox", "firefox"),
            ("chrome", "Google Chrome", "google-chrome"),
            ("chrome-stable", "Google Chrome", "google-chrome-stable"),
            ("chromium", "Chromium", "chromium"),
            ("chromium-browser", "Chromium", "chromium-browser"),
            ("brave", "Brave Browser", "brave-browser"),
            ("edge", "Microsoft Edge", "microsoft-edge"),
            ("vivaldi", "Vivaldi", "vivaldi"),
            ("opera", "Opera", "opera"),
        ];
        let path_dirs: Vec<String> = std::env::var("PATH")
            .map(|p| p.split(':').map(|s| s.to_string()).collect())
            .unwrap_or_default();
        for (id, name, bin) in candidates {
            for dir in &path_dirs {
                let candidate = std::path::Path::new(dir).join(bin);
                if candidate.exists() {
                    browsers.push(BrowserInfo {
                        id: (*id).to_string(),
                        label: (*name).to_string(),
                        path: candidate.to_string_lossy().to_string(),
                    });
                    break;
                }
            }
        }
    }

    browsers
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
                .build(handle)?;
            let nav_settings_item = MenuItemBuilder::new("Settings")
                .id("menu-nav-settings")
                .accelerator("CmdOrCtrl+,")
                .build(handle)?;
            let nav_dashboard_item = MenuItemBuilder::new("Dashboard")
                .id("menu-nav-dashboard")
                .accelerator("CmdOrCtrl+Shift+D")
                .build(handle)?;
            let nav_my_tasks_item = MenuItemBuilder::new("My Tasks")
                .id("menu-nav-my-tasks")
                .accelerator("CmdOrCtrl+Shift+T")
                .build(handle)?;
            let nav_standup_item = MenuItemBuilder::new("Standup Notes")
                .id("menu-nav-standup")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(handle)?;
            let nav_epics_item = MenuItemBuilder::new("Epics")
                .id("menu-nav-epics")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(handle)?;
            let nav_merge_requests_item = MenuItemBuilder::new("Merge Requests")
                .id("menu-nav-merge-requests")
                .accelerator("CmdOrCtrl+Shift+M")
                .build(handle)?;
            let nav_releases_item = MenuItemBuilder::new("Releases")
                .id("menu-nav-releases")
                .accelerator("CmdOrCtrl+Shift+R")
                .build(handle)?;
            let nav_worklogs_item = MenuItemBuilder::new("Worklogs")
                .id("menu-nav-worklogs")
                .accelerator("CmdOrCtrl+Shift+W")
                .build(handle)?;
            let go_menu = Submenu::with_items(
                handle,
                "Go",
                true,
                &[
                    &nav_dashboard_item,
                    &nav_my_tasks_item,
                    &nav_standup_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &nav_sprint_item,
                    &nav_backlog_item,
                    &nav_epics_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &nav_merge_requests_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &nav_releases_item,
                    &nav_worklogs_item,
                    &nav_notifications_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &nav_settings_item,
                ],
            )?;

            // --- Debug menu (added/removed at runtime via toggle_debug_menu command) ---
            let dev_tools_item = MenuItemBuilder::new("Developer Tools")
                .id("menu-dev-tools")
                .build(handle)?;
            let debug_submenu = Submenu::with_items(handle, "Dev Tools", true, &[&dev_tools_item])?;
            app.manage(DebugMenuState {
                submenu: debug_submenu,
                visible: Mutex::new(false),
            });

            // --- Help menu ---
            let command_palette_item = MenuItemBuilder::new("Command Palette")
                .id("menu-command-palette")
                .accelerator("CmdOrCtrl+F")
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
                | "menu-about"
                | "menu-nav-dashboard"
                | "menu-nav-my-tasks"
                | "menu-nav-standup"
                | "menu-nav-epics"
                | "menu-nav-merge-requests"
                | "menu-nav-releases"
                | "menu-nav-worklogs" => {
                    let _ = app.emit(id, ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            toggle_debug_menu,
            save_attachment,
            list_browsers
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
