// FTS5 search support (roadmap Tier 4)
// The messages_fts virtual table and sync triggers are created in schema.rs.
// This module provides the search query interface.

// use rusqlite::{params, Connection};

// Stub for future implementation:
//
// #[derive(Debug, serde::Serialize)]
// pub struct SearchResult {
//     pub message_id: String,
//     pub conversation_id: String,
//     pub conversation_name: String,
//     pub snippet: String,
// }
//
// pub fn search_messages(
//     conn: &Connection,
//     project_path: &str,
//     query: &str,
// ) -> Vec<SearchResult> {
//     let mut stmt = conn.prepare(
//         "SELECT m.id, m.conversation_id, c.name,
//            snippet(messages_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
//          FROM messages_fts
//          JOIN messages m ON messages_fts.rowid = m.rowid
//          JOIN conversations c ON m.conversation_id = c.id
//          WHERE c.project_path = ?1 AND messages_fts MATCH ?2
//          ORDER BY rank LIMIT 50"
//     ).unwrap();
//     stmt.query_map(params![project_path, query], |row| {
//         Ok(SearchResult {
//             message_id: row.get(0)?,
//             conversation_id: row.get(1)?,
//             conversation_name: row.get(2)?,
//             snippet: row.get(3)?,
//         })
//     }).unwrap().filter_map(|r| r.ok()).collect()
// }
