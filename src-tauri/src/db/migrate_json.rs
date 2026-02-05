use crate::state::StoreData;
use rusqlite::{params, Connection};
use std::path::Path;

pub fn migrate(
    conn: &Connection,
    json_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let json_str = std::fs::read_to_string(json_path)?;
    let store: StoreData = serde_json::from_str(&json_str)?;

    let tx = conn.unchecked_transaction()?;

    // 1. Settings (current_project, window_bounds)
    if let Some(ref project) = store.current_project {
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('current_project', ?1)",
            params![project],
        )?;
    }

    tx.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('window_width', ?1)",
        params![store.window_bounds.width.to_string()],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('window_height', ?1)",
        params![store.window_bounds.height.to_string()],
    )?;
    if let Some(x) = store.window_bounds.x {
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('window_x', ?1)",
            params![x.to_string()],
        )?;
    }
    if let Some(y) = store.window_bounds.y {
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('window_y', ?1)",
            params![y.to_string()],
        )?;
    }

    // 2. Recent projects
    for (i, path) in store.recent_projects.iter().enumerate() {
        tx.execute(
            "INSERT OR IGNORE INTO recent_projects (path, position) VALUES (?1, ?2)",
            params![path, i as i32],
        )?;
    }

    // 3. Legacy single conversations -> "Imported Conversation" entries
    for (project_path, messages) in &store.conversations {
        if messages.is_empty() {
            continue;
        }

        let conv_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let first_ts = messages.first().map(|m| m.timestamp).unwrap_or(now);

        tx.execute(
            "INSERT INTO conversations (id, project_path, name, created_at, updated_at, is_active)
             VALUES (?1, ?2, 'Imported Conversation', ?3, ?4, 0)",
            params![conv_id, project_path, first_ts, now],
        )?;

        for (order, msg) in messages.iter().enumerate() {
            tx.execute(
                "INSERT INTO messages (id, conversation_id, role, content, timestamp,
                 metadata_json, tool_uses_json, tool_results_json, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    msg.id,
                    conv_id,
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
    }

    // 4. Multi-conversations (project_conversations)
    for (project_path, conversations) in &store.project_conversations {
        let active_id = store.active_conversation.get(project_path);

        for conv in conversations {
            let is_active = active_id
                .map(|id| id == &conv.id)
                .unwrap_or(false);

            tx.execute(
                "INSERT INTO conversations (id, project_path, name, created_at, updated_at, is_active)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    conv.id,
                    project_path,
                    conv.name,
                    conv.created_at,
                    conv.updated_at,
                    is_active as i32,
                ],
            )?;

            for (order, msg) in conv.messages.iter().enumerate() {
                tx.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, timestamp,
                     metadata_json, tool_uses_json, tool_results_json, sort_order)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        msg.id,
                        conv.id,
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
        }
    }

    tx.commit()?;
    Ok(())
}
