use crate::state::{AppState, OperationResult};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, State};

const DANGEROUS_MODE_KEY: &str = "dangerous_mode";

#[tauri::command]
pub fn get_dangerous_mode(state: State<AppState>) -> bool {
    let db = state.db.lock().unwrap();
    crate::db::settings::get(&db, DANGEROUS_MODE_KEY)
        .map(|v| v == "true")
        .unwrap_or(false) // Default to safe mode
}

#[tauri::command]
pub fn set_dangerous_mode(state: State<AppState>, enabled: bool) -> OperationResult {
    let db = state.db.lock().unwrap();
    let value = if enabled { "true" } else { "false" };
    match crate::db::settings::set(&db, DANGEROUS_MODE_KEY, value) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn start_claude_cli(
    state: State<AppState>,
    project_path: String,
) -> OperationResult {
    // Store the project path in settings
    let db = state.db.lock().unwrap();
    let _ = crate::db::settings::set(&db, "current_project", &project_path);

    OperationResult {
        success: true,
        content: None,
        error: None,
    }
}

#[tauri::command]
pub fn send_to_claude(
    app_handle: AppHandle,
    state: State<AppState>,
    message: String,
    session_id: Option<String>,
) -> OperationResult {
    let (project_path, dangerous_mode) = {
        let db = state.db.lock().unwrap();
        let path = crate::db::settings::get(&db, "current_project");
        let dangerous = crate::db::settings::get(&db, DANGEROUS_MODE_KEY)
            .map(|v| v == "true")
            .unwrap_or(false);
        (path, dangerous)
    };

    let Some(project_path) = project_path else {
        return OperationResult {
            success: false,
            content: None,
            error: Some("No project path set".to_string()),
        };
    };

    // Spawn Claude in --print mode for this message
    // --dangerously-skip-permissions allows tools to execute without TTY prompts (only in dangerous mode)
    // Tool executions are parsed from output and displayed in UI
    // If session_id is provided, use --resume for session continuity
    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
    ];

    // Only add dangerous flag if user has opted in
    if dangerous_mode {
        args.insert(0, "--dangerously-skip-permissions".to_string());
    }

    // Add --resume flag if we have a session ID
    if let Some(sid) = session_id {
        if !sid.is_empty() {
            args.push("--resume".to_string());
            args.push(sid);
        }
    }

    let result = Command::new("claude")
        .args(&args)
        .arg(&message)
        .current_dir(&project_path)
        .env("FORCE_COLOR", "0")
        .env("NO_COLOR", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match result {
        Ok(mut child) => {
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            // Handle stdout - stream output line by line
            if let Some(stdout) = stdout {
                let handle = app_handle.clone();
                std::thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        match line {
                            Ok(text) => {
                                let _ = handle.emit("claude-output", serde_json::json!({
                                    "type": "stdout",
                                    "data": text
                                }));
                            }
                            Err(_) => break,
                        }
                    }
                    // Signal completion
                    let _ = handle.emit("claude-output", serde_json::json!({
                        "type": "done",
                        "data": ""
                    }));
                });
            }

            // Handle stderr
            if let Some(stderr) = stderr {
                let handle = app_handle.clone();
                std::thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        match line {
                            Ok(text) => {
                                let _ = handle.emit("claude-output", serde_json::json!({
                                    "type": "stderr",
                                    "data": text
                                }));
                            }
                            Err(_) => break,
                        }
                    }
                });
            }

            OperationResult {
                success: true,
                content: None,
                error: None,
            }
        }
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn respond_to_tool(
    _state: State<AppState>,
    _tool_use_id: String,
    _result: String,
    _is_error: bool,
) -> OperationResult {
    // In --print mode, tools execute automatically
    // This is a placeholder for future TTY-based implementation
    OperationResult {
        success: true,
        content: None,
        error: None,
    }
}

#[tauri::command]
pub fn stop_claude_cli(_state: State<AppState>) -> OperationResult {
    // Nothing to stop in print mode
    OperationResult {
        success: true,
        content: None,
        error: None,
    }
}

#[tauri::command]
pub fn is_claude_running(state: State<AppState>) -> bool {
    let db = state.db.lock().unwrap();
    crate::db::settings::get(&db, "current_project").is_some()
}
