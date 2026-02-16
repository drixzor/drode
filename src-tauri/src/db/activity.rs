use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityEvent {
    pub id: i64,
    pub event_id: String,
    pub project_path: String,
    pub category: String,
    pub event_type: String,
    pub title: String,
    pub detail_json: Option<String>,
    pub severity: String,
    pub source_id: Option<String>,
    pub created_at: i64,
}

pub fn insert_event(
    conn: &Connection,
    event_id: &str,
    project_path: &str,
    category: &str,
    event_type: &str,
    title: &str,
    detail_json: Option<&str>,
    severity: &str,
    source_id: Option<&str>,
    created_at: i64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO activity_events (event_id, project_path, category, event_type, title, detail_json, severity, source_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![event_id, project_path, category, event_type, title, detail_json, severity, source_id, created_at],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn query_events(
    conn: &Connection,
    project_path: &str,
    category: Option<&str>,
    limit: i32,
    before_id: Option<i64>,
) -> Result<Vec<ActivityEvent>, rusqlite::Error> {
    let mut sql = String::from(
        "SELECT id, event_id, project_path, category, event_type, title, detail_json, severity, source_id, created_at
         FROM activity_events WHERE project_path = ?1"
    );

    let mut param_index = 2;
    if category.is_some() {
        sql.push_str(&format!(" AND category = ?{}", param_index));
        param_index += 1;
    }
    if before_id.is_some() {
        sql.push_str(&format!(" AND id < ?{}", param_index));
        param_index += 1;
    }
    let _ = param_index; // suppress unused warning

    sql.push_str(" ORDER BY created_at DESC, id DESC");
    sql.push_str(&format!(" LIMIT {}", limit));

    let mut stmt = conn.prepare(&sql)?;

    // Build params dynamically
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_path.to_string())];
    if let Some(cat) = category {
        params_vec.push(Box::new(cat.to_string()));
    }
    if let Some(bid) = before_id {
        params_vec.push(Box::new(bid));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(ActivityEvent {
            id: row.get(0)?,
            event_id: row.get(1)?,
            project_path: row.get(2)?,
            category: row.get(3)?,
            event_type: row.get(4)?,
            title: row.get(5)?,
            detail_json: row.get(6)?,
            severity: row.get(7)?,
            source_id: row.get(8)?,
            created_at: row.get(9)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

pub fn clear_events(conn: &Connection, project_path: &str) -> Result<usize, rusqlite::Error> {
    conn.execute(
        "DELETE FROM activity_events WHERE project_path = ?1",
        params![project_path],
    )
}
