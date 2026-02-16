use tauri::State;
use crate::state::AppState;
use crate::db::oauth;
use serde::{Deserialize, Serialize};

fn get_github_token(state: &State<AppState>) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    oauth::get_token(&db, "github")
        .map_err(|e| e.to_string())?
        .map(|t| t.access_token)
        .ok_or_else(|| "GitHub not connected. Please authenticate first.".to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubRepo {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub private: bool,
    pub default_branch: String,
    pub html_url: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubTreeEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String, // "file" or "dir"
    pub size: Option<i64>,
    pub sha: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubFileContent {
    pub content: String,
    pub sha: String,
    pub size: i64,
    pub path: String,
    pub encoding: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubCommitResult {
    pub sha: String,
    pub message: String,
    pub html_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubBranch {
    pub name: String,
    pub sha: String,
    pub protected: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubPullRequest {
    pub number: i64,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub created_at: String,
    pub user_login: String,
}

#[tauri::command]
pub async fn github_list_repos(state: State<'_, AppState>, page: Option<i32>) -> Result<Vec<GithubRepo>, String> {
    let token = get_github_token(&state)?;
    let page = page.unwrap_or(1);
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("https://api.github.com/user/repos?sort=updated&per_page=30&page={}", page))
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let repos: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    Ok(repos.into_iter().map(|r| GithubRepo {
        id: r["id"].as_i64().unwrap_or(0),
        name: r["name"].as_str().unwrap_or("").to_string(),
        full_name: r["full_name"].as_str().unwrap_or("").to_string(),
        description: r["description"].as_str().map(|s| s.to_string()),
        private: r["private"].as_bool().unwrap_or(false),
        default_branch: r["default_branch"].as_str().unwrap_or("main").to_string(),
        html_url: r["html_url"].as_str().unwrap_or("").to_string(),
        updated_at: r["updated_at"].as_str().unwrap_or("").to_string(),
    }).collect())
}

#[tauri::command]
pub async fn github_get_repo_tree(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
    branch: String,
    path: Option<String>,
) -> Result<Vec<GithubTreeEntry>, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();
    let api_path = path.unwrap_or_default();

    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}?ref={}",
        owner, repo, api_path, branch
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    Ok(items.into_iter().map(|item| GithubTreeEntry {
        name: item["name"].as_str().unwrap_or("").to_string(),
        path: item["path"].as_str().unwrap_or("").to_string(),
        entry_type: item["type"].as_str().unwrap_or("file").to_string(),
        size: item["size"].as_i64(),
        sha: item["sha"].as_str().unwrap_or("").to_string(),
    }).collect())
}

#[tauri::command]
pub async fn github_read_file(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
    branch: String,
    path: String,
) -> Result<GithubFileContent, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}?ref={}",
        owner, repo, path, branch
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let encoding = data["encoding"].as_str().unwrap_or("base64").to_string();
    let raw_content = data["content"].as_str().unwrap_or("").to_string();

    // Decode base64 content
    let content = if encoding == "base64" {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let cleaned = raw_content.replace('\n', "");
        let bytes = STANDARD.decode(&cleaned).map_err(|e| e.to_string())?;
        String::from_utf8(bytes).map_err(|e| e.to_string())?
    } else {
        raw_content
    };

    Ok(GithubFileContent {
        content,
        sha: data["sha"].as_str().unwrap_or("").to_string(),
        size: data["size"].as_i64().unwrap_or(0),
        path: data["path"].as_str().unwrap_or("").to_string(),
        encoding,
    })
}

#[tauri::command]
pub async fn github_update_file(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
    branch: String,
    path: String,
    content: String,
    message: String,
    sha: String,
) -> Result<GithubCommitResult, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let encoded_content = STANDARD.encode(content.as_bytes());

    let url = format!("https://api.github.com/repos/{}/{}/contents/{}", owner, repo, path);

    let body = serde_json::json!({
        "message": message,
        "content": encoded_content,
        "sha": sha,
        "branch": branch,
    });

    let resp = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(GithubCommitResult {
        sha: data["commit"]["sha"].as_str().unwrap_or("").to_string(),
        message: data["commit"]["message"].as_str().unwrap_or("").to_string(),
        html_url: data["commit"]["html_url"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
pub async fn github_list_branches(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
) -> Result<Vec<GithubBranch>, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com/repos/{}/{}/branches?per_page=100", owner, repo);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let branches: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    Ok(branches.into_iter().map(|b| GithubBranch {
        name: b["name"].as_str().unwrap_or("").to_string(),
        sha: b["commit"]["sha"].as_str().unwrap_or("").to_string(),
        protected: b["protected"].as_bool(),
    }).collect())
}

#[tauri::command]
pub async fn github_create_branch(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
    branch_name: String,
    from_branch: String,
) -> Result<GithubBranch, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();

    // First get the SHA of the source branch
    let ref_url = format!("https://api.github.com/repos/{}/{}/git/ref/heads/{}", owner, repo, from_branch);
    let ref_resp = client
        .get(&ref_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let ref_data: serde_json::Value = ref_resp.json().await.map_err(|e| e.to_string())?;
    let sha = ref_data["object"]["sha"].as_str().unwrap_or("").to_string();

    // Create new branch
    let create_url = format!("https://api.github.com/repos/{}/{}/git/refs", owner, repo);
    let body = serde_json::json!({
        "ref": format!("refs/heads/{}", branch_name),
        "sha": sha,
    });

    let resp = client
        .post(&create_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(GithubBranch {
        name: branch_name,
        sha: data["object"]["sha"].as_str().unwrap_or(&sha).to_string(),
        protected: Some(false),
    })
}

#[tauri::command]
pub async fn github_list_pull_requests(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
    state_filter: Option<String>,
) -> Result<Vec<GithubPullRequest>, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();
    let pr_state = state_filter.unwrap_or_else(|| "open".to_string());

    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls?state={}&per_page=30",
        owner, repo, pr_state
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let prs: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    Ok(prs.into_iter().map(|pr| GithubPullRequest {
        number: pr["number"].as_i64().unwrap_or(0),
        title: pr["title"].as_str().unwrap_or("").to_string(),
        state: pr["state"].as_str().unwrap_or("").to_string(),
        html_url: pr["html_url"].as_str().unwrap_or("").to_string(),
        head_ref: pr["head"]["ref"].as_str().unwrap_or("").to_string(),
        base_ref: pr["base"]["ref"].as_str().unwrap_or("").to_string(),
        created_at: pr["created_at"].as_str().unwrap_or("").to_string(),
        user_login: pr["user"]["login"].as_str().unwrap_or("").to_string(),
    }).collect())
}

#[tauri::command]
pub async fn github_create_pull_request(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
    title: String,
    body: String,
    head: String,
    base: String,
) -> Result<GithubPullRequest, String> {
    let token = get_github_token(&state)?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);

    let payload = serde_json::json!({
        "title": title,
        "body": body,
        "head": head,
        "base": base,
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Drode-IDE")
        .header("Accept", "application/vnd.github+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let pr: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(GithubPullRequest {
        number: pr["number"].as_i64().unwrap_or(0),
        title: pr["title"].as_str().unwrap_or("").to_string(),
        state: pr["state"].as_str().unwrap_or("").to_string(),
        html_url: pr["html_url"].as_str().unwrap_or("").to_string(),
        head_ref: pr["head"]["ref"].as_str().unwrap_or("").to_string(),
        base_ref: pr["base"]["ref"].as_str().unwrap_or("").to_string(),
        created_at: pr["created_at"].as_str().unwrap_or("").to_string(),
        user_login: pr["user"]["login"].as_str().unwrap_or("").to_string(),
    })
}
