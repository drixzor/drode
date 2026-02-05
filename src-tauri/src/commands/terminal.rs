use crate::state::{AppState, OperationResult};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn run_terminal_command(
    app_handle: AppHandle,
    state: State<AppState>,
    command: String,
    terminal_id: String,
) -> OperationResult {
    let project_path = {
        let db = state.db.lock().unwrap();
        crate::db::settings::get(&db, "current_project")
    };

    let Some(project_path) = project_path else {
        return OperationResult {
            success: false,
            content: None,
            error: Some("No project path set".to_string()),
        };
    };

    // Use sh -c to run the command
    // On Unix, spawn in a new process group so we can kill all children
    #[cfg(unix)]
    let result = {
        use std::os::unix::process::CommandExt;
        let mut cmd = Command::new("sh");
        cmd.args(["-c", &command])
            .current_dir(&project_path)
            .env("FORCE_COLOR", "1")
            .env("TERM", "xterm-256color")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // Create a new process group with the child as leader
        unsafe {
            cmd.pre_exec(|| {
                // Set this process as the leader of a new process group
                libc::setpgid(0, 0);
                Ok(())
            });
        }
        cmd.spawn()
    };

    #[cfg(not(unix))]
    let result = Command::new("sh")
        .args(["-c", &command])
        .current_dir(&project_path)
        .env("FORCE_COLOR", "1")
        .env("TERM", "xterm-256color")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match result {
        Ok(mut child) => {
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            let tid = terminal_id.clone();

            // Get the process ID and store it for potential killing
            let pid = child.id();
            if let Ok(mut pids) = state.terminal_pids.lock() {
                pids.insert(terminal_id.clone(), pid);
            }

            // Handle stdout
            if let Some(stdout) = stdout {
                let handle = app_handle.clone();
                let tid_clone = tid.clone();
                std::thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        match line {
                            Ok(text) => {
                                let _ = handle.emit("terminal-output", serde_json::json!({
                                    "terminalId": tid_clone,
                                    "type": "stdout",
                                    "data": text
                                }));
                            }
                            Err(_) => break,
                        }
                    }
                });
            }

            // Handle stderr
            if let Some(stderr) = stderr {
                let handle = app_handle.clone();
                let tid_clone = tid.clone();
                std::thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        match line {
                            Ok(text) => {
                                let _ = handle.emit("terminal-output", serde_json::json!({
                                    "terminalId": tid_clone,
                                    "type": "stderr",
                                    "data": text
                                }));
                            }
                            Err(_) => break,
                        }
                    }
                });
            }

            // Wait for process and emit exit
            let tid_for_wait = terminal_id.clone();
            let handle = app_handle.clone();
            std::thread::spawn(move || {
                let status = child.wait();
                let code = status.ok().and_then(|s| s.code()).unwrap_or(-1);
                let _ = handle.emit("terminal-output", serde_json::json!({
                    "terminalId": tid_for_wait,
                    "type": "exit",
                    "code": code
                }));
            });

            OperationResult {
                success: true,
                content: Some(pid.to_string()),
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
pub fn kill_terminal_process(
    app_handle: AppHandle,
    state: State<AppState>,
    terminal_id: String,
) -> OperationResult {
    let pid = if let Ok(mut pids) = state.terminal_pids.lock() {
        pids.remove(&terminal_id)
    } else {
        None
    };

    if let Some(pid) = pid {
        // Kill the process and its children
        #[cfg(unix)]
        {
            // Send SIGTERM to process group (negative PID)
            unsafe {
                libc::kill(-(pid as i32), libc::SIGTERM);
            }

            // Give it a moment to terminate gracefully
            std::thread::sleep(std::time::Duration::from_millis(100));

            // Force kill if still running
            unsafe {
                libc::kill(-(pid as i32), libc::SIGKILL);
            }
        }

        #[cfg(not(unix))]
        {
            // On Windows, use taskkill
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }

        // Emit exit event (the wait thread will also emit, but this ensures immediate UI update)
        let _ = app_handle.emit("terminal-output", serde_json::json!({
            "terminalId": terminal_id,
            "type": "exit",
            "code": -1
        }));

        return OperationResult {
            success: true,
            content: None,
            error: None,
        };
    }

    OperationResult {
        success: false,
        content: None,
        error: Some("Process not found".to_string()),
    }
}
