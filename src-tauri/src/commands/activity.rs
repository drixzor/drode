use tauri::{AppHandle, Emitter, State};
use crate::state::{AppState, OperationResult};
use crate::db::activity::{self, ActivityEvent};

#[tauri::command]
pub fn log_activity(
    app_handle: AppHandle,
    state: State<AppState>,
    project_path: String,
    category: String,
    event_type: String,
    title: String,
    detail_json: Option<String>,
    severity: Option<String>,
    source_id: Option<String>,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    let event_id = uuid::Uuid::new_v4().to_string();
    let severity = severity.unwrap_or_else(|| "info".to_string());
    let created_at = chrono::Utc::now().timestamp_millis();

    match activity::insert_event(
        &db,
        &event_id,
        &project_path,
        &category,
        &event_type,
        &title,
        detail_json.as_deref(),
        &severity,
        source_id.as_deref(),
        created_at,
    ) {
        Ok(id) => {
            // Emit event to frontend
            let event = ActivityEvent {
                id,
                event_id,
                project_path,
                category,
                event_type,
                title,
                detail_json,
                severity,
                source_id,
                created_at,
            };
            let _ = app_handle.emit("activity-event", &event);

            OperationResult {
                success: true,
                error: None,
                content: None,
            }
        }
        Err(e) => OperationResult {
            success: false,
            error: Some(e.to_string()),
            content: None,
        },
    }
}

#[tauri::command]
pub fn get_activity_log(
    state: State<AppState>,
    project_path: String,
    category: Option<String>,
    limit: Option<i32>,
    before_id: Option<i64>,
) -> Vec<ActivityEvent> {
    let db = state.db.lock().unwrap();
    let limit = limit.unwrap_or(100);

    activity::query_events(&db, &project_path, category.as_deref(), limit, before_id)
        .unwrap_or_default()
}

#[tauri::command]
pub fn clear_activity_log(
    state: State<AppState>,
    project_path: String,
) -> OperationResult {
    let db = state.db.lock().unwrap();
    match activity::clear_events(&db, &project_path) {
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
