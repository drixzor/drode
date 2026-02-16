use tauri::{AppHandle, Emitter, Manager, State};
use crate::state::{AppState, OperationResult};
use crate::db::oauth::{self, OAuthToken};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

// Provider configurations
struct ProviderConfig {
    auth_url: &'static str,
    token_url: &'static str,
    scopes: &'static str,
    client_id_env: &'static str,
}

fn get_provider_config(provider: &str) -> Option<ProviderConfig> {
    match provider {
        "github" => Some(ProviderConfig {
            auth_url: "https://github.com/login/oauth/authorize",
            token_url: "https://github.com/login/oauth/access_token",
            scopes: "repo,user",
            client_id_env: "DRODE_GITHUB_CLIENT_ID",
        }),
        "supabase" => Some(ProviderConfig {
            auth_url: "https://api.supabase.com/v1/oauth/authorize",
            token_url: "https://api.supabase.com/v1/oauth/token",
            scopes: "all",
            client_id_env: "DRODE_SUPABASE_CLIENT_ID",
        }),
        "vercel" => Some(ProviderConfig {
            auth_url: "https://vercel.com/integrations/oauth/authorize",
            token_url: "https://api.vercel.com/v2/oauth/access_token",
            scopes: "",
            client_id_env: "DRODE_VERCEL_CLIENT_ID",
        }),
        _ => None,
    }
}

// In-memory state for pending OAuth flows
lazy_static::lazy_static! {
    static ref PENDING_FLOWS: Mutex<HashMap<String, PendingFlow>> = Mutex::new(HashMap::new());
}

struct PendingFlow {
    provider: String,
    #[allow(dead_code)]
    state: String,
    code_verifier: String,
}

fn generate_random_string(len: usize) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        .chars()
        .collect();
    (0..len).map(|_| chars[rng.gen_range(0..chars.len())]).collect()
}

fn generate_pkce() -> (String, String) {
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

    let verifier = generate_random_string(64);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    (verifier, challenge)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthStatus {
    pub connected: bool,
    pub provider: String,
    pub account_info: Option<serde_json::Value>,
}

#[tauri::command]
pub fn oauth_get_status(state: State<AppState>) -> Vec<OAuthStatus> {
    let db = state.db.lock().unwrap();
    let providers = ["github", "supabase", "vercel"];
    let mut statuses = Vec::new();

    for provider in &providers {
        match oauth::get_token(&db, provider) {
            Ok(Some(token)) => {
                let account_info = token.account_info_json
                    .and_then(|s| serde_json::from_str(&s).ok());
                statuses.push(OAuthStatus {
                    connected: true,
                    provider: provider.to_string(),
                    account_info,
                });
            }
            _ => {
                statuses.push(OAuthStatus {
                    connected: false,
                    provider: provider.to_string(),
                    account_info: None,
                });
            }
        }
    }

    statuses
}

#[tauri::command]
pub async fn oauth_start(app_handle: AppHandle, provider: String) -> OperationResult {
    let config = match get_provider_config(&provider) {
        Some(c) => c,
        None => return OperationResult {
            success: false,
            error: Some(format!("Unknown provider: {}", provider)),
            content: None,
        },
    };

    let client_id = match std::env::var(config.client_id_env) {
        Ok(id) => id,
        Err(_) => return OperationResult {
            success: false,
            error: Some(format!("Set {} environment variable with your OAuth client ID", config.client_id_env)),
            content: None,
        },
    };

    let state_param = generate_random_string(32);
    let (_code_verifier, code_challenge) = generate_pkce();

    // Store pending flow
    {
        let mut flows = PENDING_FLOWS.lock().unwrap();
        flows.insert(state_param.clone(), PendingFlow {
            provider: provider.clone(),
            state: state_param.clone(),
            code_verifier: _code_verifier,
        });
    }

    // Build auth URL
    let redirect_uri = "http://localhost:17391/callback";
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&scope={}&state={}&response_type=code&code_challenge={}&code_challenge_method=S256",
        config.auth_url,
        urlencoding::encode(&client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(config.scopes),
        urlencoding::encode(&state_param),
        urlencoding::encode(&code_challenge),
    );

    // Start local callback server in background
    let app_handle_clone = app_handle.clone();
    let provider_clone = provider.clone();
    tokio::spawn(async move {
        start_callback_server(app_handle_clone, provider_clone).await;
    });

    // Open browser
    let _ = open::that(&auth_url);

    OperationResult {
        success: true,
        error: None,
        content: None,
    }
}

async fn start_callback_server(app_handle: AppHandle, provider: String) {
    // Run the blocking server in a spawn_blocking to avoid blocking tokio
    let result = tokio::task::spawn_blocking(move || {
        let server = match tiny_http::Server::http("127.0.0.1:17391") {
            Ok(s) => s,
            Err(e) => {
                return Err((app_handle, provider, format!("Failed to start callback server: {}", e)));
            }
        };

        // Wait for callback (timeout after 5 minutes)
        let timeout = std::time::Duration::from_secs(300);

        if let Ok(Some(request)) = server.recv_timeout(timeout) {
            let url = request.url().to_string();

            // Parse query params
            let query = url.split('?').nth(1).unwrap_or("");
            let params: HashMap<String, String> = query
                .split('&')
                .filter_map(|pair| {
                    let mut parts = pair.splitn(2, '=');
                    let key = parts.next()?.to_string();
                    let value = parts.next().unwrap_or("").to_string();
                    Some((key, urlencoding::decode(&value).unwrap_or_default().to_string()))
                })
                .collect();

            let code = params.get("code").cloned().unwrap_or_default();
            let state = params.get("state").cloned().unwrap_or_default();

            // Respond to browser
            let response_html = "<html><body><h2>Authentication successful!</h2><p>You can close this tab and return to Drode.</p><script>window.close()</script></body></html>";
            let response = tiny_http::Response::from_string(response_html)
                .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap());
            let _ = request.respond(response);

            // Validate state and extract flow
            let flow = {
                let mut flows = PENDING_FLOWS.lock().unwrap();
                flows.remove(&state)
            };

            if let Some(flow) = flow {
                Ok((app_handle, flow.provider, code, flow.code_verifier))
            } else {
                Err((app_handle, provider, "Invalid OAuth state parameter".to_string()))
            }
        } else {
            Err((app_handle, provider, "OAuth callback timed out".to_string()))
        }
    }).await;

    match result {
        Ok(Ok((app_handle, provider, code, code_verifier))) => {
            exchange_code(app_handle, &provider, &code, &code_verifier).await;
        }
        Ok(Err((app_handle, provider, error))) => {
            let _ = app_handle.emit("oauth-error", serde_json::json!({
                "provider": provider,
                "error": error,
            }));
        }
        Err(e) => {
            eprintln!("OAuth callback server task failed: {}", e);
        }
    }
}

async fn exchange_code(app_handle: AppHandle, provider: &str, code: &str, code_verifier: &str) {
    let config = match get_provider_config(provider) {
        Some(c) => c,
        None => return,
    };

    let client_id = match std::env::var(config.client_id_env) {
        Ok(id) => id,
        Err(_) => return,
    };

    let client_secret_env = format!("{}_SECRET", config.client_id_env);
    let client_secret = std::env::var(&client_secret_env).unwrap_or_default();

    let client = reqwest::Client::new();
    let mut form = HashMap::new();
    form.insert("grant_type", "authorization_code".to_string());
    form.insert("code", code.to_string());
    form.insert("redirect_uri", "http://localhost:17391/callback".to_string());
    form.insert("client_id", client_id);
    form.insert("code_verifier", code_verifier.to_string());
    if !client_secret.is_empty() {
        form.insert("client_secret", client_secret);
    }

    let response = client
        .post(config.token_url)
        .header("Accept", "application/json")
        .form(&form)
        .send()
        .await;

    match response {
        Ok(resp) => {
            let body: serde_json::Value = match resp.json().await {
                Ok(v) => v,
                Err(e) => {
                    let _ = app_handle.emit("oauth-error", serde_json::json!({
                        "provider": provider, "error": format!("Failed to parse token response: {}", e)
                    }));
                    return;
                }
            };

            let access_token = body["access_token"].as_str().unwrap_or("").to_string();
            if access_token.is_empty() {
                let _ = app_handle.emit("oauth-error", serde_json::json!({
                    "provider": provider, "error": format!("No access_token in response: {}", body)
                }));
                return;
            }

            let refresh_token = body["refresh_token"].as_str().map(|s| s.to_string());
            let expires_in = body["expires_in"].as_i64();
            let scope = body["scope"].as_str().map(|s| s.to_string());

            let expires_at = expires_in.map(|e| chrono::Utc::now().timestamp() + e);

            // Fetch account info for display
            let account_info = fetch_account_info(provider, &access_token).await;

            let token = OAuthToken {
                provider: provider.to_string(),
                access_token,
                refresh_token,
                expires_at,
                scope,
                account_info_json: account_info.as_ref().map(|v| v.to_string()),
                updated_at: chrono::Utc::now().timestamp_millis(),
            };

            // Store token - access AppState directly from app_handle
            let app_state = app_handle.state::<AppState>();
            let db = app_state.db.lock().unwrap();
            if let Err(e) = oauth::store_token(&db, &token) {
                let _ = app_handle.emit("oauth-error", serde_json::json!({
                    "provider": provider, "error": format!("Failed to store token: {}", e)
                }));
                return;
            }

            let _ = app_handle.emit("oauth-complete", serde_json::json!({
                "provider": provider,
                "account_info": account_info,
            }));
        }
        Err(e) => {
            let _ = app_handle.emit("oauth-error", serde_json::json!({
                "provider": provider, "error": format!("Token exchange failed: {}", e)
            }));
        }
    }
}

async fn fetch_account_info(provider: &str, access_token: &str) -> Option<serde_json::Value> {
    let client = reqwest::Client::new();
    match provider {
        "github" => {
            let resp = client
                .get("https://api.github.com/user")
                .header("Authorization", format!("Bearer {}", access_token))
                .header("User-Agent", "Drode-IDE")
                .send()
                .await
                .ok()?;
            let user: serde_json::Value = resp.json().await.ok()?;
            Some(serde_json::json!({
                "username": user["login"],
                "avatar_url": user["avatar_url"],
                "name": user["name"],
            }))
        }
        "supabase" => {
            Some(serde_json::json!({ "connected": true }))
        }
        "vercel" => {
            let resp = client
                .get("https://api.vercel.com/v2/user")
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await
                .ok()?;
            let data: serde_json::Value = resp.json().await.ok()?;
            Some(serde_json::json!({
                "username": data["user"]["username"],
                "name": data["user"]["name"],
            }))
        }
        _ => None,
    }
}

#[tauri::command]
pub fn oauth_revoke(state: State<AppState>, provider: String) -> OperationResult {
    let db = state.db.lock().unwrap();
    match oauth::remove_token(&db, &provider) {
        Ok(_) => OperationResult {
            success: true,
            error: None,
            content: None,
        },
        Err(e) => OperationResult {
            success: false,
            error: Some(e.to_string()),
            content: None,
        },
    }
}

#[tauri::command]
pub fn oauth_get_token(state: State<AppState>, provider: String) -> Option<String> {
    let db = state.db.lock().unwrap();
    oauth::get_token(&db, &provider)
        .ok()
        .flatten()
        .map(|t| t.access_token)
}
