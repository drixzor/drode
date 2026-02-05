use crate::state::{
    AppState, Conversation, ConversationMessage, ConversationSummary, OperationResult,
};
use tauri::State;

// Legacy single-conversation commands

#[tauri::command]
pub fn save_conversation(
    state: State<AppState>,
    project_path: String,
    messages: Vec<ConversationMessage>,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    match crate::db::conversations::save_legacy(&db, &project_path, &messages) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(format!("Failed to save: {}", e)),
        },
    }
}

#[tauri::command]
pub fn load_conversation(state: State<AppState>, project_path: String) -> Vec<ConversationMessage> {
    let db = state.db.lock().unwrap();
    crate::db::conversations::load_legacy(&db, &project_path)
}

#[tauri::command]
pub fn clear_conversation(state: State<AppState>, project_path: String) -> OperationResult {
    let db = state.db.lock().unwrap();
    match crate::db::conversations::clear_legacy(&db, &project_path) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(format!("Failed to clear: {}", e)),
        },
    }
}

// Multi-conversation management

#[tauri::command]
pub fn list_conversations(
    state: State<AppState>,
    project_path: String,
) -> Vec<ConversationSummary> {
    let db = state.db.lock().unwrap();
    crate::db::conversations::list(&db, &project_path)
}

#[tauri::command]
pub fn create_conversation(
    state: State<AppState>,
    project_path: String,
    name: String,
) -> Option<ConversationSummary> {
    let db = state.db.lock().unwrap();
    crate::db::conversations::create(&db, &project_path, &name)
}

#[tauri::command]
pub fn get_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
) -> Option<Conversation> {
    let db = state.db.lock().unwrap();
    crate::db::conversations::get(&db, &project_path, &conversation_id)
}

#[tauri::command]
pub fn save_conversation_messages(
    state: State<AppState>,
    _project_path: String,
    conversation_id: String,
    messages: Vec<ConversationMessage>,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    match crate::db::conversations::save_messages(&db, &conversation_id, &messages) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(format!("Conversation not found: {}", e)),
        },
    }
}

#[tauri::command]
pub fn delete_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    match crate::db::conversations::delete(&db, &project_path, &conversation_id) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(format!("Failed to delete: {}", e)),
        },
    }
}

#[tauri::command]
pub fn rename_conversation(
    state: State<AppState>,
    _project_path: String,
    conversation_id: String,
    new_name: String,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    match crate::db::conversations::rename(&db, &conversation_id, &new_name) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(format!("Conversation not found: {}", e)),
        },
    }
}

#[tauri::command]
pub fn get_active_conversation(state: State<AppState>, project_path: String) -> Option<String> {
    let db = state.db.lock().unwrap();
    crate::db::conversations::get_active(&db, &project_path)
}

#[tauri::command]
pub fn set_active_conversation(
    state: State<AppState>,
    project_path: String,
    conversation_id: String,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    match crate::db::conversations::set_active(&db, &project_path, &conversation_id) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(format!("Failed to set active conversation: {}", e)),
        },
    }
}
