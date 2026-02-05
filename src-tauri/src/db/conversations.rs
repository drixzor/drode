use crate::state::{Conversation, ConversationMessage, ConversationSummary};
use rusqlite::{params, Connection};
use std::collections::HashMap;

pub fn list(conn: &Connection, project_path: &str) -> Vec<ConversationSummary> {
    let mut stmt = match conn.prepare(
        "SELECT c.id, c.name, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as msg_count
         FROM conversations c
         WHERE c.project_path = ?1
         ORDER BY c.updated_at DESC",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let result = match stmt.query_map(params![project_path], |row| {
        Ok(ConversationSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            message_count: row.get::<_, i64>(4)? as usize,
        })
    }) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };
    result
}

pub fn create(
    conn: &Connection,
    project_path: &str,
    name: &str,
) -> Option<ConversationSummary> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO conversations (id, project_path, name, created_at, updated_at, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        params![id, project_path, name, now, now],
    )
    .ok()?;

    // Set as active
    let _ = set_active(conn, project_path, &id);

    Some(ConversationSummary {
        id,
        name: name.to_string(),
        created_at: now,
        updated_at: now,
        message_count: 0,
    })
}

pub fn get(
    conn: &Connection,
    _project_path: &str,
    conversation_id: &str,
) -> Option<Conversation> {
    let conv = conn
        .query_row(
            "SELECT id, name, created_at, updated_at FROM conversations WHERE id = ?1",
            params![conversation_id],
            |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    messages: Vec::new(),
                })
            },
        )
        .ok()?;

    let messages = load_messages(conn, conversation_id);

    Some(Conversation {
        messages,
        ..conv
    })
}

pub fn save_messages(
    conn: &Connection,
    conversation_id: &str,
    messages: &[ConversationMessage],
) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "DELETE FROM messages WHERE conversation_id = ?1",
        params![conversation_id],
    )?;

    for (order, msg) in messages.iter().enumerate() {
        tx.execute(
            "INSERT INTO messages (id, conversation_id, role, content, timestamp,
             metadata_json, tool_uses_json, tool_results_json, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                msg.id,
                conversation_id,
                msg.role,
                msg.content,
                msg.timestamp,
                msg.metadata
                    .as_ref()
                    .and_then(|m| serde_json::to_string(m).ok()),
                msg.tool_uses
                    .as_ref()
                    .and_then(|t| serde_json::to_string(t).ok()),
                msg.tool_results
                    .as_ref()
                    .and_then(|t| serde_json::to_string(t).ok()),
                order as i32,
            ],
        )?;
    }

    let now = chrono::Utc::now().timestamp_millis();
    tx.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, conversation_id],
    )?;

    tx.commit()
}

pub fn delete(
    conn: &Connection,
    project_path: &str,
    conversation_id: &str,
) -> Result<(), rusqlite::Error> {
    // Check if this is the active conversation
    let is_active: bool = conn
        .query_row(
            "SELECT is_active FROM conversations WHERE id = ?1",
            params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    // CASCADE will delete messages automatically
    conn.execute(
        "DELETE FROM conversations WHERE id = ?1",
        params![conversation_id],
    )?;

    // If deleted the active one, clear active for this project
    if is_active {
        // No need to do anything - the row is deleted
        // Optionally set another conversation as active
        let _ = conn.execute(
            "UPDATE conversations SET is_active = 0 WHERE project_path = ?1",
            params![project_path],
        );
    }

    Ok(())
}

pub fn rename(
    conn: &Connection,
    conversation_id: &str,
    new_name: &str,
) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE conversations SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_name, now, conversation_id],
    )?;
    Ok(())
}

pub fn get_active(conn: &Connection, project_path: &str) -> Option<String> {
    conn.query_row(
        "SELECT id FROM conversations WHERE project_path = ?1 AND is_active = 1",
        params![project_path],
        |row| row.get(0),
    )
    .ok()
}

pub fn set_active(
    conn: &Connection,
    project_path: &str,
    conversation_id: &str,
) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE conversations SET is_active = 0 WHERE project_path = ?1",
        params![project_path],
    )?;
    tx.execute(
        "UPDATE conversations SET is_active = 1 WHERE id = ?1",
        params![conversation_id],
    )?;
    tx.commit()
}

// Legacy single-conversation support

const LEGACY_NAME: &str = "__legacy__";

fn get_or_create_legacy(conn: &Connection, project_path: &str) -> Option<String> {
    // Try to find existing legacy conversation
    if let Ok(id) = conn.query_row(
        "SELECT id FROM conversations WHERE project_path = ?1 AND name = ?2",
        params![project_path, LEGACY_NAME],
        |row| row.get::<_, String>(0),
    ) {
        return Some(id);
    }

    // Create new legacy conversation
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO conversations (id, project_path, name, created_at, updated_at, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        params![id, project_path, LEGACY_NAME, now, now],
    )
    .ok()?;
    Some(id)
}

pub fn save_legacy(
    conn: &Connection,
    project_path: &str,
    messages: &[ConversationMessage],
) -> Result<(), rusqlite::Error> {
    let conv_id = get_or_create_legacy(conn, project_path)
        .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
    save_messages(conn, &conv_id, messages)
}

pub fn load_legacy(conn: &Connection, project_path: &str) -> Vec<ConversationMessage> {
    let conv_id = match conn.query_row(
        "SELECT id FROM conversations WHERE project_path = ?1 AND name = ?2",
        params![project_path, LEGACY_NAME],
        |row| row.get::<_, String>(0),
    ) {
        Ok(id) => id,
        Err(_) => return vec![],
    };
    load_messages(conn, &conv_id)
}

pub fn clear_legacy(conn: &Connection, project_path: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM conversations WHERE project_path = ?1 AND name = ?2",
        params![project_path, LEGACY_NAME],
    )?;
    Ok(())
}

// Shared helper

fn load_messages(conn: &Connection, conversation_id: &str) -> Vec<ConversationMessage> {
    let mut stmt = match conn.prepare(
        "SELECT id, role, content, timestamp, metadata_json, tool_uses_json, tool_results_json
         FROM messages
         WHERE conversation_id = ?1
         ORDER BY sort_order ASC",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let result = match stmt.query_map(params![conversation_id], |row| {
        let metadata_json: Option<String> = row.get(4)?;
        let tool_uses_json: Option<String> = row.get(5)?;
        let tool_results_json: Option<String> = row.get(6)?;

        Ok(ConversationMessage {
            id: row.get(0)?,
            role: row.get(1)?,
            content: row.get(2)?,
            timestamp: row.get(3)?,
            metadata: metadata_json
                .and_then(|j| serde_json::from_str(&j).ok()),
            tool_uses: tool_uses_json
                .and_then(|j| serde_json::from_str(&j).ok()),
            tool_results: tool_results_json.and_then(|j| {
                serde_json::from_str::<HashMap<String, crate::state::ToolResult>>(&j).ok()
            }),
        })
    }) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };
    result
}
