use rusqlite::{params, Connection};

pub fn get_recent(conn: &Connection) -> Vec<String> {
    let mut stmt = match conn.prepare(
        "SELECT path FROM recent_projects ORDER BY position ASC",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let result = match stmt.query_map([], |row| row.get(0)) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };
    result
}

pub fn set_current_project(
    conn: &Connection,
    project_path: &str,
) -> Result<(), rusqlite::Error> {
    // Remove existing entry if present
    conn.execute(
        "DELETE FROM recent_projects WHERE path = ?1",
        params![project_path],
    )?;

    // Shift all positions up by 1
    conn.execute("UPDATE recent_projects SET position = position + 1", [])?;

    // Insert at position 0 (most recent)
    conn.execute(
        "INSERT INTO recent_projects (path, position) VALUES (?1, 0)",
        params![project_path],
    )?;

    // Remove entries beyond 10
    conn.execute(
        "DELETE FROM recent_projects WHERE position >= 10",
        [],
    )?;

    Ok(())
}

pub fn remove(conn: &Connection, project_path: &str) -> Result<Vec<String>, rusqlite::Error> {
    conn.execute(
        "DELETE FROM recent_projects WHERE path = ?1",
        params![project_path],
    )?;

    // Re-normalize positions
    let paths = get_recent(conn);
    conn.execute("DELETE FROM recent_projects", [])?;
    for (i, path) in paths.iter().enumerate() {
        conn.execute(
            "INSERT INTO recent_projects (path, position) VALUES (?1, ?2)",
            params![path, i as i32],
        )?;
    }

    Ok(get_recent(conn))
}
