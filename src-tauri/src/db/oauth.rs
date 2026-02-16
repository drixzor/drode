use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthToken {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub scope: Option<String>,
    pub account_info_json: Option<String>,
    pub updated_at: i64,
}

pub fn store_token(conn: &Connection, token: &OAuthToken) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, account_info_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            token.provider,
            token.access_token,
            token.refresh_token,
            token.expires_at,
            token.scope,
            token.account_info_json,
            token.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_token(conn: &Connection, provider: &str) -> Result<Option<OAuthToken>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT provider, access_token, refresh_token, expires_at, scope, account_info_json, updated_at
         FROM oauth_tokens WHERE provider = ?1"
    )?;

    let mut rows = stmt.query_map(params![provider], |row| {
        Ok(OAuthToken {
            provider: row.get(0)?,
            access_token: row.get(1)?,
            refresh_token: row.get(2)?,
            expires_at: row.get(3)?,
            scope: row.get(4)?,
            account_info_json: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    match rows.next() {
        Some(Ok(token)) => Ok(Some(token)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

pub fn remove_token(conn: &Connection, provider: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM oauth_tokens WHERE provider = ?1",
        params![provider],
    )?;
    Ok(())
}

pub fn list_providers(conn: &Connection) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT provider FROM oauth_tokens")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut providers = Vec::new();
    for row in rows {
        providers.push(row?);
    }
    Ok(providers)
}
