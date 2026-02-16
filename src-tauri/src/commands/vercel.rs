use tauri::State;
use crate::state::{AppState, OperationResult};
use crate::db::oauth;
use serde::{Deserialize, Serialize};

fn get_vercel_token(state: &State<AppState>) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    oauth::get_token(&db, "vercel")
        .map_err(|e| e.to_string())?
        .map(|t| t.access_token)
        .ok_or_else(|| "Vercel not connected. Please authenticate first.".to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VercelProject {
    pub id: String,
    pub name: String,
    pub framework: Option<String>,
    pub updated_at: i64,
    pub latest_deployment_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VercelDeployment {
    pub uid: String,
    pub name: String,
    pub url: Option<String>,
    pub state: String,
    pub created_at: i64,
    pub ready_at: Option<i64>,
    pub git_ref: Option<String>,
    pub git_message: Option<String>,
    pub creator_username: Option<String>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VercelLogEntry {
    pub timestamp: i64,
    pub text: String,
    pub log_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VercelDomain {
    pub name: String,
    pub verified: bool,
    pub created_at: Option<i64>,
}

#[tauri::command]
pub async fn vercel_list_projects(state: State<'_, AppState>) -> Result<Vec<VercelProject>, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.vercel.com/v9/projects")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let projects = data["projects"].as_array().cloned().unwrap_or_default();

    Ok(projects.into_iter().map(|p| VercelProject {
        id: p["id"].as_str().unwrap_or("").to_string(),
        name: p["name"].as_str().unwrap_or("").to_string(),
        framework: p["framework"].as_str().map(|s| s.to_string()),
        updated_at: p["updatedAt"].as_i64().unwrap_or(0),
        latest_deployment_url: p["latestDeployments"].as_array()
            .and_then(|d| d.first())
            .and_then(|d| d["url"].as_str())
            .map(|s| s.to_string()),
    }).collect())
}

#[tauri::command]
pub async fn vercel_list_deployments(
    state: State<'_, AppState>,
    project_id: String,
    limit: Option<i32>,
) -> Result<Vec<VercelDeployment>, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();
    let limit = limit.unwrap_or(20);

    let resp = client
        .get(format!("https://api.vercel.com/v6/deployments?projectId={}&limit={}", project_id, limit))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let deployments = data["deployments"].as_array().cloned().unwrap_or_default();

    Ok(deployments.into_iter().map(|d| VercelDeployment {
        uid: d["uid"].as_str().unwrap_or("").to_string(),
        name: d["name"].as_str().unwrap_or("").to_string(),
        url: d["url"].as_str().map(|s| s.to_string()),
        state: d["state"].as_str().unwrap_or("UNKNOWN").to_string(),
        created_at: d["createdAt"].as_i64().unwrap_or(0),
        ready_at: d["ready"].as_i64(),
        git_ref: d["meta"]["githubCommitRef"].as_str().map(|s| s.to_string()),
        git_message: d["meta"]["githubCommitMessage"].as_str().map(|s| s.to_string()),
        creator_username: d["creator"]["username"].as_str().map(|s| s.to_string()),
        meta: Some(d["meta"].clone()),
    }).collect())
}

#[tauri::command]
pub async fn vercel_get_deployment(
    state: State<'_, AppState>,
    deployment_id: String,
) -> Result<VercelDeployment, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("https://api.vercel.com/v13/deployments/{}", deployment_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let d: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(VercelDeployment {
        uid: d["uid"].as_str().unwrap_or("").to_string(),
        name: d["name"].as_str().unwrap_or("").to_string(),
        url: d["url"].as_str().map(|s| s.to_string()),
        state: d["readyState"].as_str().unwrap_or("UNKNOWN").to_string(),
        created_at: d["createdAt"].as_i64().unwrap_or(0),
        ready_at: d["ready"].as_i64(),
        git_ref: d["meta"]["githubCommitRef"].as_str().map(|s| s.to_string()),
        git_message: d["meta"]["githubCommitMessage"].as_str().map(|s| s.to_string()),
        creator_username: d["creator"]["username"].as_str().map(|s| s.to_string()),
        meta: Some(d["meta"].clone()),
    })
}

#[tauri::command]
pub async fn vercel_get_deployment_logs(
    state: State<'_, AppState>,
    deployment_id: String,
) -> Result<Vec<VercelLogEntry>, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("https://api.vercel.com/v2/deployments/{}/events", deployment_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let events: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    Ok(events.into_iter().map(|e| VercelLogEntry {
        timestamp: e["created"].as_i64().unwrap_or(0),
        text: e["text"].as_str().unwrap_or("").to_string(),
        log_type: e["type"].as_str().unwrap_or("stdout").to_string(),
    }).collect())
}

#[tauri::command]
pub async fn vercel_create_deployment(
    state: State<'_, AppState>,
    project_id: String,
    git_ref: Option<String>,
) -> Result<VercelDeployment, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let mut body = serde_json::json!({
        "name": project_id,
        "target": "production",
    });

    if let Some(ref git) = git_ref {
        body["gitSource"] = serde_json::json!({ "ref": git });
    }

    let resp = client
        .post("https://api.vercel.com/v13/deployments")
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let d: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(VercelDeployment {
        uid: d["uid"].as_str().unwrap_or("").to_string(),
        name: d["name"].as_str().unwrap_or("").to_string(),
        url: d["url"].as_str().map(|s| s.to_string()),
        state: d["readyState"].as_str().unwrap_or("BUILDING").to_string(),
        created_at: d["createdAt"].as_i64().unwrap_or(0),
        ready_at: None,
        git_ref,
        git_message: None,
        creator_username: None,
        meta: None,
    })
}

#[tauri::command]
pub async fn vercel_list_domains(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<VercelDomain>, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("https://api.vercel.com/v9/projects/{}/domains", project_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let domains = data["domains"].as_array().cloned().unwrap_or_default();

    Ok(domains.into_iter().map(|d| VercelDomain {
        name: d["name"].as_str().unwrap_or("").to_string(),
        verified: d["verified"].as_bool().unwrap_or(false),
        created_at: d["createdAt"].as_i64(),
    }).collect())
}

#[tauri::command]
pub async fn vercel_add_domain(
    state: State<'_, AppState>,
    project_id: String,
    domain: String,
) -> Result<VercelDomain, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("https://api.vercel.com/v9/projects/{}/domains", project_id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": domain }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let d: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(VercelDomain {
        name: d["name"].as_str().unwrap_or(&domain).to_string(),
        verified: d["verified"].as_bool().unwrap_or(false),
        created_at: d["createdAt"].as_i64(),
    })
}

#[tauri::command]
pub async fn vercel_remove_domain(
    state: State<'_, AppState>,
    project_id: String,
    domain: String,
) -> Result<OperationResult, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    match client
        .delete(format!("https://api.vercel.com/v9/projects/{}/domains/{}", project_id, domain))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
    {
        Ok(_) => Ok(OperationResult { success: true, error: None, content: None }),
        Err(e) => Ok(OperationResult { success: false, error: Some(e.to_string()), content: None }),
    }
}

#[tauri::command]
pub async fn vercel_promote_deployment(
    state: State<'_, AppState>,
    deployment_id: String,
) -> Result<VercelDeployment, String> {
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("https://api.vercel.com/v13/deployments/{}/promote", deployment_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let d: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(VercelDeployment {
        uid: d["uid"].as_str().unwrap_or(&deployment_id).to_string(),
        name: d["name"].as_str().unwrap_or("").to_string(),
        url: d["url"].as_str().map(|s| s.to_string()),
        state: d["readyState"].as_str().unwrap_or("READY").to_string(),
        created_at: d["createdAt"].as_i64().unwrap_or(0),
        ready_at: d["ready"].as_i64(),
        git_ref: None,
        git_message: None,
        creator_username: None,
        meta: None,
    })
}

#[tauri::command]
pub async fn vercel_rollback_deployment(
    state: State<'_, AppState>,
    _project_id: String,
    deployment_id: String,
) -> Result<VercelDeployment, String> {
    // Rollback is essentially promoting a previous deployment
    let token = get_vercel_token(&state)?;
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("https://api.vercel.com/v13/deployments/{}/promote", deployment_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let d: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(VercelDeployment {
        uid: d["uid"].as_str().unwrap_or(&deployment_id).to_string(),
        name: d["name"].as_str().unwrap_or("").to_string(),
        url: d["url"].as_str().map(|s| s.to_string()),
        state: d["readyState"].as_str().unwrap_or("READY").to_string(),
        created_at: d["createdAt"].as_i64().unwrap_or(0),
        ready_at: d["ready"].as_i64(),
        git_ref: None,
        git_message: None,
        creator_username: None,
        meta: None,
    })
}
