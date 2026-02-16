use tauri::State;
use crate::state::{AppState, OperationResult};
use crate::db::oauth;
use serde::{Deserialize, Serialize};

fn get_supabase_token(state: &State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    oauth::get_token(&db, "supabase")
        .map_err(|e| e.to_string())?
        .map(|t| t.access_token)
        .ok_or_else(|| "Supabase not connected. Please authenticate first.".to_string())
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupabaseProject {
    pub id: String,
    pub name: String,
    pub organization_id: String,
    pub region: String,
    pub created_at: String,
    pub database_host: String,
    #[serde(rename = "ref")]
    pub project_ref: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupabaseTable {
    pub name: String,
    pub schema: String,
    pub row_count: Option<i64>,
    pub columns: Vec<SupabaseColumn>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupabaseColumn {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupabaseQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub total_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupabaseSqlResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub row_count: i64,
}

#[tauri::command]
pub async fn supabase_list_projects(state: State<'_, AppState>) -> Result<Vec<SupabaseProject>, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.supabase.com/v1/projects")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let projects: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    Ok(projects.into_iter().map(|p| SupabaseProject {
        id: p["id"].as_str().unwrap_or("").to_string(),
        name: p["name"].as_str().unwrap_or("").to_string(),
        organization_id: p["organization_id"].as_str().unwrap_or("").to_string(),
        region: p["region"].as_str().unwrap_or("").to_string(),
        created_at: p["created_at"].as_str().unwrap_or("").to_string(),
        database_host: p["database"]["host"].as_str().unwrap_or("").to_string(),
        project_ref: p["ref"].as_str().unwrap_or(&p["id"].as_str().unwrap_or("").to_string()).to_string(),
    }).collect())
}

#[tauri::command]
pub async fn supabase_list_tables(
    state: State<'_, AppState>,
    project_ref: String,
) -> Result<Vec<SupabaseTable>, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    // Use the SQL endpoint to list tables and their columns
    let sql = "SELECT table_name, column_name, data_type, is_nullable, column_default \
               FROM information_schema.columns \
               WHERE table_schema = 'public' \
               ORDER BY table_name, ordinal_position";

    let resp = client
        .post(format!("https://api.supabase.com/v1/projects/{}/database/query", project_ref))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": sql }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    // Group columns by table
    let mut tables: std::collections::HashMap<String, Vec<SupabaseColumn>> = std::collections::HashMap::new();

    for row in &rows {
        let table_name = row["table_name"].as_str().unwrap_or("").to_string();
        let column = SupabaseColumn {
            name: row["column_name"].as_str().unwrap_or("").to_string(),
            data_type: row["data_type"].as_str().unwrap_or("").to_string(),
            is_nullable: row["is_nullable"].as_str().unwrap_or("YES") == "YES",
            is_primary: false, // Would need additional query
            default_value: row["column_default"].as_str().map(|s| s.to_string()),
        };
        tables.entry(table_name).or_default().push(column);
    }

    Ok(tables.into_iter().map(|(name, columns)| SupabaseTable {
        name,
        schema: "public".to_string(),
        row_count: None,
        columns,
    }).collect())
}

#[tauri::command]
pub async fn supabase_get_table_data(
    state: State<'_, AppState>,
    project_ref: String,
    table_name: String,
    page: Option<i32>,
    page_size: Option<i32>,
    order_by: Option<String>,
    filters: Option<String>,
) -> Result<SupabaseQueryResult, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();
    let page = page.unwrap_or(0);
    let page_size = page_size.unwrap_or(50);
    let offset = page * page_size;

    let mut url = format!(
        "https://{}.supabase.co/rest/v1/{}?select=*&limit={}&offset={}",
        project_ref, table_name, page_size, offset
    );

    if let Some(order) = &order_by {
        url.push_str(&format!("&order={}", order));
    }

    if let Some(filter) = &filters {
        url.push_str(&format!("&{}", filter));
    }

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("apikey", &token)
        .header("Prefer", "count=exact")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Get total count from Content-Range header
    let total_count = resp.headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split('/').last())
        .and_then(|s| s.parse::<i64>().ok());

    let rows: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    let columns = if let Some(first_row) = rows.first() {
        if let Some(obj) = first_row.as_object() {
            obj.keys().cloned().collect()
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    Ok(SupabaseQueryResult {
        columns,
        rows,
        total_count,
    })
}

#[tauri::command]
pub async fn supabase_run_sql(
    state: State<'_, AppState>,
    project_ref: String,
    sql: String,
) -> Result<SupabaseSqlResult, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("https://api.supabase.com/v1/projects/{}/database/query", project_ref))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": sql }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    let row_count = rows.len() as i64;

    let columns = if let Some(first_row) = rows.first() {
        if let Some(obj) = first_row.as_object() {
            obj.keys().cloned().collect()
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    Ok(SupabaseSqlResult {
        columns,
        rows,
        row_count,
    })
}

#[tauri::command]
pub async fn supabase_insert_row(
    state: State<'_, AppState>,
    project_ref: String,
    table_name: String,
    data_json: String,
) -> Result<serde_json::Value, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    let data: serde_json::Value = serde_json::from_str(&data_json).map_err(|e| e.to_string())?;

    let url = format!("https://{}.supabase.co/rest/v1/{}", project_ref, table_name);

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("apikey", &token)
        .header("Prefer", "return=representation")
        .json(&data)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    resp.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn supabase_update_row(
    state: State<'_, AppState>,
    project_ref: String,
    table_name: String,
    row_id: String,
    data_json: String,
) -> Result<serde_json::Value, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    let data: serde_json::Value = serde_json::from_str(&data_json).map_err(|e| e.to_string())?;

    let url = format!("https://{}.supabase.co/rest/v1/{}?id=eq.{}", project_ref, table_name, row_id);

    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("apikey", &token)
        .header("Prefer", "return=representation")
        .json(&data)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    resp.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn supabase_delete_row(
    state: State<'_, AppState>,
    project_ref: String,
    table_name: String,
    row_id: String,
) -> Result<OperationResult, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    let url = format!("https://{}.supabase.co/rest/v1/{}?id=eq.{}", project_ref, table_name, row_id);

    match client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("apikey", &token)
        .send()
        .await
    {
        Ok(_) => Ok(OperationResult { success: true, error: None, content: None }),
        Err(e) => Ok(OperationResult { success: false, error: Some(e.to_string()), content: None }),
    }
}

#[tauri::command]
pub async fn supabase_run_migration(
    state: State<'_, AppState>,
    project_ref: String,
    migration_sql: String,
    migration_name: String,
) -> Result<OperationResult, String> {
    let token = get_supabase_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("https://api.supabase.com/v1/projects/{}/database/query", project_ref))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": migration_sql }))
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            Ok(OperationResult { success: true, error: None, content: Some(migration_name) })
        }
        Ok(r) => {
            let body = r.text().await.unwrap_or_default();
            Ok(OperationResult { success: false, error: Some(format!("Migration failed: {}", body)), content: None })
        }
        Err(e) => {
            Ok(OperationResult { success: false, error: Some(e.to_string()), content: None })
        }
    }
}
