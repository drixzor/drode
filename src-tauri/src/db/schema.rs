use rusqlite::Connection;

pub fn initialize(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        -- Schema version tracking for future migrations
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Key-value settings
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        -- Recent projects, ordered by position (0 = most recent)
        CREATE TABLE IF NOT EXISTS recent_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            position INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_recent_projects_position
            ON recent_projects(position);

        -- Conversations (replaces both legacy and multi-conversation formats)
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY NOT NULL,
            project_path TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_conversations_project
            ON conversations(project_path);
        CREATE INDEX IF NOT EXISTS idx_conversations_project_active
            ON conversations(project_path, is_active);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated
            ON conversations(updated_at DESC);

        -- Messages within conversations
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY NOT NULL,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL DEFAULT '',
            timestamp INTEGER NOT NULL,
            metadata_json TEXT,
            tool_uses_json TEXT,
            tool_results_json TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conversation
            ON messages(conversation_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp
            ON messages(timestamp);

        -- Full-text search for conversation search feature (roadmap Tier 4)
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content=messages,
            content_rowid=rowid,
            tokenize='porter unicode61'
        );

        -- Triggers to keep FTS index in sync
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content)
                VALUES('delete', old.rowid, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content)
                VALUES('delete', old.rowid, old.content);
            INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        -- Record schema version
        INSERT OR IGNORE INTO schema_version (version) VALUES (1);
        ",
    )?;

    // Version 2 migration: activity_events + oauth_tokens
    let version: i32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    )?;

    if version < 2 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS activity_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                project_path TEXT NOT NULL,
                category TEXT NOT NULL,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                detail_json TEXT,
                severity TEXT NOT NULL DEFAULT 'info',
                source_id TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_events(project_path, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_activity_category ON activity_events(category, created_at DESC);

            CREATE TABLE IF NOT EXISTS oauth_tokens (
                provider TEXT PRIMARY KEY NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at INTEGER,
                scope TEXT,
                account_info_json TEXT,
                updated_at INTEGER NOT NULL
            );

            INSERT OR IGNORE INTO schema_version (version) VALUES (2);
            ",
        )?;
    }

    Ok(())
}
