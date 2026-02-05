use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

// Conversation-related types (shared across commands and db modules)

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageMetadata {
    #[serde(rename = "durationMs", skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    #[serde(rename = "durationApiMs", skip_serializing_if = "Option::is_none")]
    pub duration_api_ms: Option<i64>,
    #[serde(rename = "inputTokens", skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i64>,
    #[serde(rename = "outputTokens", skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i64>,
    #[serde(rename = "cacheReadTokens", skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<i64>,
    #[serde(rename = "cacheCreationTokens", skip_serializing_if = "Option::is_none")]
    pub cache_creation_tokens: Option<i64>,
    #[serde(rename = "totalCostUsd", skip_serializing_if = "Option::is_none")]
    pub total_cost_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolUseRequest {
    pub id: String,
    pub name: String,
    pub input: serde_json::Value,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolResult {
    #[serde(rename = "toolUseId")]
    pub tool_use_id: String,
    pub content: String,
    #[serde(rename = "isError", skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<MessageMetadata>,
    #[serde(rename = "toolUses", skip_serializing_if = "Option::is_none")]
    pub tool_uses: Option<Vec<ToolUseRequest>>,
    #[serde(rename = "toolResults", skip_serializing_if = "Option::is_none")]
    pub tool_results: Option<HashMap<String, ToolResult>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub name: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub messages: Vec<ConversationMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "messageCount")]
    pub message_count: usize,
}

// StoreData and WindowBounds kept for JSON migration deserialization only

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct StoreData {
    #[serde(rename = "recentProjects")]
    pub recent_projects: Vec<String>,
    #[serde(rename = "currentProject")]
    pub current_project: Option<String>,
    #[serde(rename = "windowBounds")]
    pub window_bounds: WindowBounds,
    #[serde(default)]
    pub conversations: HashMap<String, Vec<ConversationMessage>>,
    #[serde(default, rename = "projectConversations")]
    pub project_conversations: HashMap<String, Vec<Conversation>>,
    #[serde(default, rename = "activeConversation")]
    pub active_conversation: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowBounds {
    pub width: u32,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
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

// Core application state — SQLite-backed

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    #[allow(dead_code)]
    pub legacy_config_path: PathBuf,
    // Process registry for terminal commands - maps terminal_id to process ID
    pub terminal_pids: Mutex<HashMap<String, u32>>,
}

impl AppState {
    pub fn new(app_handle: &AppHandle) -> Self {
        let config_dir = app_handle
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let db_path = config_dir.join("drode.db");
        let legacy_config_path = config_dir.join("config.json");

        let _ = fs::create_dir_all(&config_dir);

        let conn = rusqlite::Connection::open(&db_path)
            .expect("Failed to open database");

        // WAL mode for crash safety + concurrent reads
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .expect("Failed to set WAL mode");
        // Enable cascade deletes
        conn.execute_batch("PRAGMA foreign_keys=ON;")
            .expect("Failed to enable foreign keys");

        crate::db::schema::initialize(&conn)
            .expect("Failed to initialize database schema");

        // One-time migration from JSON if needed
        if legacy_config_path.exists() {
            match crate::db::migrate_json::migrate(&conn, &legacy_config_path) {
                Ok(_) => {
                    let migrated_path = config_dir.join("config.json.migrated");
                    let _ = fs::rename(&legacy_config_path, &migrated_path);
                }
                Err(e) => {
                    eprintln!(
                        "Migration from config.json failed: {}. Continuing with empty database.",
                        e
                    );
                    // Don't rename — preserve config.json for retry
                }
            }
        }

        Self {
            db: Mutex::new(conn),
            legacy_config_path,
            terminal_pids: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Serialize)]
pub struct OperationResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}
