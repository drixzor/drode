use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    size: u64,
    modified: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageMetadata {
    #[serde(rename = "durationMs", skip_serializing_if = "Option::is_none")]
    duration_ms: Option<i64>,
    #[serde(rename = "durationApiMs", skip_serializing_if = "Option::is_none")]
    duration_api_ms: Option<i64>,
    #[serde(rename = "inputTokens", skip_serializing_if = "Option::is_none")]
    input_tokens: Option<i64>,
    #[serde(rename = "outputTokens", skip_serializing_if = "Option::is_none")]
    output_tokens: Option<i64>,
    #[serde(rename = "cacheReadTokens", skip_serializing_if = "Option::is_none")]
    cache_read_tokens: Option<i64>,
    #[serde(rename = "cacheCreationTokens", skip_serializing_if = "Option::is_none")]
    cache_creation_tokens: Option<i64>,
    #[serde(rename = "totalCostUsd", skip_serializing_if = "Option::is_none")]
    total_cost_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolUseRequest {
    id: String,
    name: String,
    input: serde_json::Value,
    status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolResult {
    #[serde(rename = "toolUseId")]
    tool_use_id: String,
    content: String,
    #[serde(rename = "isError", skip_serializing_if = "Option::is_none")]
    is_error: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationMessage {
    id: String,
    role: String,
    content: String,
    timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<MessageMetadata>,
    #[serde(rename = "toolUses", skip_serializing_if = "Option::is_none")]
    tool_uses: Option<Vec<ToolUseRequest>>,
    #[serde(rename = "toolResults", skip_serializing_if = "Option::is_none")]
    tool_results: Option<HashMap<String, ToolResult>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    id: String,
    name: String,
    #[serde(rename = "createdAt")]
    created_at: i64,
    #[serde(rename = "updatedAt")]
    updated_at: i64,
    messages: Vec<ConversationMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationSummary {
    id: String,
    name: String,
    #[serde(rename = "createdAt")]
    created_at: i64,
    #[serde(rename = "updatedAt")]
    updated_at: i64,
    #[serde(rename = "messageCount")]
    message_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct StoreData {
    #[serde(rename = "recentProjects")]
    recent_projects: Vec<String>,
    #[serde(rename = "currentProject")]
    current_project: Option<String>,
    #[serde(rename = "windowBounds")]
    window_bounds: WindowBounds,
    // Legacy single conversation per project (for migration)
    #[serde(default)]
    conversations: HashMap<String, Vec<ConversationMessage>>,
    // New: multiple conversations per project
    #[serde(default, rename = "projectConversations")]
    project_conversations: HashMap<String, Vec<Conversation>>,
    // Active conversation per project
    #[serde(default, rename = "activeConversation")]
    active_conversation: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowBounds {
    width: u32,
    height: u32,
    x: Option<i32>,
    y: Option<i32>,
}

impl Default for WindowBounds {
    fn default() -> Self {
        Self {
            width: 1400,
            height: 900,
            x: None,
            y: None,
        }
    }
}

pub struct AppState {
    config_path: PathBuf,
    store: Mutex<StoreData>,
    // Process registry for terminal commands - maps terminal_id to process ID
    terminal_pids: Mutex<HashMap<String, u32>>,
}

impl AppState {
    fn new(app_handle: &AppHandle) -> Self {
        let config_dir = app_handle
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let config_path = config_dir.join("config.json");

        let store = if config_path.exists() {
            fs::read_to_string(&config_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            StoreData::default()
        };

        Self {
            config_path,
            store: Mutex::new(store),
            terminal_pids: Mutex::new(HashMap::new()),
        }
    }

    fn save_store(&self) {
        if let Ok(store) = self.store.lock() {
            if let Ok(json) = serde_json::to_string_pretty(&*store) {
                if let Some(parent) = self.config_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&self.config_path, json);
            }
        }
    }
}

#[derive(Serialize)]
pub struct OperationResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

// Project management commands

#[tauri::command]
fn get_recent_projects(state: State<AppState>) -> Vec<String> {
    state
        .store
        .lock()
        .map(|s| s.recent_projects.clone())
        .unwrap_or_default()
}

#[tauri::command]
fn get_current_project(state: State<AppState>) -> Option<String> {
    state
        .store
        .lock()
        .ok()
        .and_then(|s| s.current_project.clone())
}

#[tauri::command]
fn set_current_project(state: State<AppState>, project_path: String) -> bool {
    if let Ok(mut store) = state.store.lock() {
        store.current_project = Some(project_path.clone());

        // Update recent projects
        store.recent_projects.retain(|p| p != &project_path);
        store.recent_projects.insert(0, project_path);
        store.recent_projects.truncate(10);

        drop(store);
        state.save_store();
        return true;
    }
    false
}

#[tauri::command]
fn remove_recent_project(state: State<AppState>, project_path: String) -> Vec<String> {
    if let Ok(mut store) = state.store.lock() {
        store.recent_projects.retain(|p| p != &project_path);
        let projects = store.recent_projects.clone();
        drop(store);
        state.save_store();
        return projects;
    }
    vec![]
}

// File system commands

#[tauri::command]
fn read_directory(dir_path: String) -> Vec<FileEntry> {
    let path = PathBuf::from(&dir_path);
    let mut entries = Vec::new();

    if let Ok(read_dir) = fs::read_dir(&path) {
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files except .gitignore
            if name.starts_with('.') && name != ".gitignore" {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| {
                        chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default()
                    })
                    .unwrap_or_default();

                entries.push(FileEntry {
                    name,
                    path: entry.path().to_string_lossy().to_string(),
                    is_directory: metadata.is_dir(),
                    size: metadata.len(),
                    modified,
                });
            }
        }
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    entries
}

#[tauri::command]
fn read_file(file_path: String) -> OperationResult {
    match fs::read_to_string(&file_path) {
        Ok(content) => OperationResult {
            success: true,
            content: Some(content),
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
fn write_file(file_path: String, content: String) -> OperationResult {
    match fs::write(&file_path, &content) {
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
fn create_file(file_path: String) -> OperationResult {
    match fs::write(&file_path, "") {
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
fn create_directory(dir_path: String) -> OperationResult {
    match fs::create_dir_all(&dir_path) {
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
fn delete_file(file_path: String) -> OperationResult {
    // Try to move to trash, fall back to delete
    match trash::delete(&file_path) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(_) => match fs::remove_file(&file_path).or_else(|_| fs::remove_dir_all(&file_path)) {
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
        },
    }
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> OperationResult {
    match fs::rename(&old_path, &new_path) {
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
fn file_exists(file_path: String) -> bool {
    PathBuf::from(&file_path).exists()
}

// Claude CLI commands
// Uses --print mode (one process per message) since interactive mode requires TTY
// Tool executions are parsed from stream-json output and displayed in UI

#[tauri::command]
fn start_claude_cli(
    state: State<AppState>,
    project_path: String,
) -> OperationResult {
    // Store the project path
    if let Ok(mut store) = state.store.lock() {
        store.current_project = Some(project_path);
    }

    OperationResult {
        success: true,
        content: None,
        error: None,
    }
}

#[tauri::command]
fn send_to_claude(
    app_handle: AppHandle,
    state: State<AppState>,
    message: String,
    session_id: Option<String>,
) -> OperationResult {
    let project_path = state
        .store
        .lock()
        .ok()
        .and_then(|s| s.current_project.clone());

    let Some(project_path) = project_path else {
        return OperationResult {
            success: false,
            content: None,
            error: Some("No project path set".to_string()),
        };
    };

    // Spawn Claude in --print mode for this message
    // --dangerously-skip-permissions allows tools to execute without TTY prompts
    // Tool executions are parsed from output and displayed in UI
    // If session_id is provided, use --resume for session continuity
    let mut args = vec![
        "--dangerously-skip-permissions".to_string(),
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
    ];

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
fn respond_to_tool(
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
fn stop_claude_cli(_state: State<AppState>) -> OperationResult {
    // Nothing to stop in print mode
    OperationResult {
        success: true,
        content: None,
        error: None,
    }
}

#[tauri::command]
fn is_claude_running(state: State<AppState>) -> bool {
    state
        .store
        .lock()
        .ok()
        .and_then(|s| s.current_project.clone())
        .is_some()
}

// Conversation persistence

#[tauri::command]
fn save_conversation(
    state: State<AppState>,
    project_path: String,
    messages: Vec<ConversationMessage>,
) -> OperationResult {
    if let Ok(mut store) = state.store.lock() {
        store.conversations.insert(project_path, messages);
        drop(store);
        state.save_store();
        return OperationResult {
            success: true,
            content: None,
            error: None,
        };
    }

    OperationResult {
        success: false,
        content: None,
        error: Some("Failed to save".to_string()),
    }
}

#[tauri::command]
fn load_conversation(state: State<AppState>, project_path: String) -> Vec<ConversationMessage> {
    state
        .store
        .lock()
        .ok()
        .and_then(|s| s.conversations.get(&project_path).cloned())
        .unwrap_or_default()
}

#[tauri::command]
fn clear_conversation(state: State<AppState>, project_path: String) -> OperationResult {
    if let Ok(mut store) = state.store.lock() {
        store.conversations.remove(&project_path);
        drop(store);
        state.save_store();
        return OperationResult {
            success: true,
            content: None,
            error: None,
        };
    }

    OperationResult {
        success: false,
        content: None,
        error: Some("Failed to clear".to_string()),
    }
}

// Multi-conversation management

#[tauri::command]
fn list_conversations(state: State<AppState>, project_path: String) -> Vec<ConversationSummary> {
    state
        .store
        .lock()
        .ok()
        .and_then(|s| s.project_conversations.get(&project_path).cloned())
        .unwrap_or_default()
        .into_iter()
        .map(|c| ConversationSummary {
            id: c.id,
            name: c.name,
            created_at: c.created_at,
            updated_at: c.updated_at,
            message_count: c.messages.len(),
        })
        .collect()
}

#[tauri::command]
fn create_conversation(
    state: State<AppState>,
    project_path: String,
    name: String,
) -> Option<ConversationSummary> {
    if let Ok(mut store) = state.store.lock() {
        let now = chrono::Utc::now().timestamp_millis();
        let id = uuid::Uuid::new_v4().to_string();

        let conversation = Conversation {
            id: id.clone(),
            name: name.clone(),
            created_at: now,
            updated_at: now,
            messages: Vec::new(),
        };

        let conversations = store.project_conversations
            .entry(project_path.clone())
            .or_insert_with(Vec::new);
        conversations.push(conversation);

        // Set as active
        store.active_conversation.insert(project_path, id.clone());

        drop(store);
        state.save_store();

        return Some(ConversationSummary {
            id,
            name,
            created_at: now,
            updated_at: now,
            message_count: 0,
        });
    }
    None
}

#[tauri::command]
fn get_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
) -> Option<Conversation> {
    state
        .store
        .lock()
        .ok()
        .and_then(|s| {
            s.project_conversations
                .get(&project_path)
                .and_then(|convs| convs.iter().find(|c| c.id == conversation_id).cloned())
        })
}

#[tauri::command]
fn save_conversation_messages(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
    messages: Vec<ConversationMessage>,
) -> OperationResult {
    if let Ok(mut store) = state.store.lock() {
        if let Some(conversations) = store.project_conversations.get_mut(&project_path) {
            if let Some(conv) = conversations.iter_mut().find(|c| c.id == conversation_id) {
                conv.messages = messages;
                conv.updated_at = chrono::Utc::now().timestamp_millis();
                drop(store);
                state.save_store();
                return OperationResult {
                    success: true,
                    content: None,
                    error: None,
                };
            }
        }
    }
    OperationResult {
        success: false,
        content: None,
        error: Some("Conversation not found".to_string()),
    }
}

#[tauri::command]
fn delete_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
) -> OperationResult {
    if let Ok(mut store) = state.store.lock() {
        if let Some(conversations) = store.project_conversations.get_mut(&project_path) {
            conversations.retain(|c| c.id != conversation_id);

            // If deleted the active one, clear active
            if store.active_conversation.get(&project_path) == Some(&conversation_id) {
                store.active_conversation.remove(&project_path);
            }

            drop(store);
            state.save_store();
            return OperationResult {
                success: true,
                content: None,
                error: None,
            };
        }
    }
    OperationResult {
        success: false,
        content: None,
        error: Some("Failed to delete".to_string()),
    }
}

#[tauri::command]
fn rename_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
    new_name: String,
) -> OperationResult {
    if let Ok(mut store) = state.store.lock() {
        if let Some(conversations) = store.project_conversations.get_mut(&project_path) {
            if let Some(conv) = conversations.iter_mut().find(|c| c.id == conversation_id) {
                conv.name = new_name;
                conv.updated_at = chrono::Utc::now().timestamp_millis();
                drop(store);
                state.save_store();
                return OperationResult {
                    success: true,
                    content: None,
                    error: None,
                };
            }
        }
    }
    OperationResult {
        success: false,
        content: None,
        error: Some("Conversation not found".to_string()),
    }
}

#[tauri::command]
fn get_active_conversation(state: State<AppState>, project_path: String) -> Option<String> {
    state
        .store
        .lock()
        .ok()
        .and_then(|s| s.active_conversation.get(&project_path).cloned())
}

#[tauri::command]
fn set_active_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
) -> OperationResult {
    if let Ok(mut store) = state.store.lock() {
        store.active_conversation.insert(project_path, conversation_id);
        drop(store);
        state.save_store();
        return OperationResult {
            success: true,
            content: None,
            error: None,
        };
    }
    OperationResult {
        success: false,
        content: None,
        error: Some("Failed to set active conversation".to_string()),
    }
}

// Terminal commands

#[tauri::command]
fn run_terminal_command(
    app_handle: AppHandle,
    state: State<AppState>,
    command: String,
    terminal_id: String,
) -> OperationResult {
    let project_path = state
        .store
        .lock()
        .ok()
        .and_then(|s| s.current_project.clone());

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
fn kill_terminal_process(
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

// Port information types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortInfo {
    port: u16,
    pid: u32,
    process_name: String,
    state: String,
    protocol: String,
}

#[tauri::command]
fn list_ports() -> Vec<PortInfo> {
    let mut ports = Vec::new();

    // Use lsof to list network connections (macOS)
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-i", "-P", "-n", "-sTCP:LISTEN"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 9 {
                    let process_name = parts[0].to_string();
                    let pid: u32 = parts[1].parse().unwrap_or(0);
                    let addr = parts[8];

                    // Extract port from address (format: *:PORT or IP:PORT)
                    if let Some(port_str) = addr.rsplit(':').next() {
                        if let Ok(port) = port_str.parse::<u16>() {
                            // Check if we already have this port
                            if !ports.iter().any(|p: &PortInfo| p.port == port && p.pid == pid) {
                                ports.push(PortInfo {
                                    port,
                                    pid,
                                    process_name,
                                    state: "LISTEN".to_string(),
                                    protocol: "TCP".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by port number
    ports.sort_by_key(|p| p.port);
    ports
}

#[tauri::command]
fn kill_port(port: u16) -> OperationResult {
    // Find process using this port and kill it
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t"])
            .output();

        if let Ok(output) = output {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                if let Ok(pid_num) = pid.trim().parse::<i32>() {
                    // Try graceful kill first
                    let _ = Command::new("kill")
                        .args(["-TERM", &pid_num.to_string()])
                        .output();

                    // Wait a moment
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    // Force kill if still running
                    let _ = Command::new("kill")
                        .args(["-9", &pid_num.to_string()])
                        .output();
                }
            }
            return OperationResult {
                success: true,
                content: None,
                error: None,
            };
        }
    }

    OperationResult {
        success: false,
        content: None,
        error: Some("Failed to kill process on port".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let state = AppState::new(app.handle());
            app.manage(state);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_recent_projects,
            get_current_project,
            set_current_project,
            remove_recent_project,
            read_directory,
            read_file,
            write_file,
            create_file,
            create_directory,
            delete_file,
            rename_file,
            file_exists,
            start_claude_cli,
            send_to_claude,
            respond_to_tool,
            stop_claude_cli,
            is_claude_running,
            save_conversation,
            load_conversation,
            clear_conversation,
            // Multi-conversation
            list_conversations,
            create_conversation,
            get_conversation,
            save_conversation_messages,
            delete_conversation,
            rename_conversation,
            get_active_conversation,
            set_active_conversation,
            // Terminal
            run_terminal_command,
            kill_terminal_process,
            // Ports
            list_ports,
            kill_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
