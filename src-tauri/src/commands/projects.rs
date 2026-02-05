use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_recent_projects(state: State<AppState>) -> Vec<String> {
    let db = state.db.lock().unwrap();
    crate::db::projects::get_recent(&db)
}

#[tauri::command]
pub fn get_current_project(state: State<AppState>) -> Option<String> {
    let db = state.db.lock().unwrap();
    crate::db::settings::get(&db, "current_project")
}

#[tauri::command]
pub fn set_current_project(state: State<AppState>, project_path: String) -> bool {
    let db = state.db.lock().unwrap();

    if crate::db::settings::set(&db, "current_project", &project_path).is_err() {
        return false;
    }
    crate::db::projects::set_current_project(&db, &project_path).is_ok()
}

#[tauri::command]
pub fn remove_recent_project(state: State<AppState>, project_path: String) -> Vec<String> {
    let db = state.db.lock().unwrap();
    crate::db::projects::remove(&db, &project_path).unwrap_or_default()
}
