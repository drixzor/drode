use crate::state::OperationResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    size: u64,
    modified: String,
}

#[tauri::command]
pub fn read_directory(dir_path: String) -> Vec<FileEntry> {
    let path = PathBuf::from(&dir_path);
    let mut entries = Vec::new();

    if let Ok(read_dir) = fs::read_dir(&path) {
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files except .gitignore
            if name.starts_with('.') && name != ".gitignore" {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| {
                        chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default()
                    })
                    .unwrap_or_default();

                entries.push(FileEntry {
                    name,
                    path: entry.path().to_string_lossy().to_string(),
                    is_directory: metadata.is_dir(),
                    size: metadata.len(),
                    modified,
                });
            }
        }
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    entries
}

#[tauri::command]
pub fn read_file(file_path: String) -> OperationResult {
    match fs::read_to_string(&file_path) {
        Ok(content) => OperationResult {
            success: true,
            content: Some(content),
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn write_file(file_path: String, content: String) -> OperationResult {
    match fs::write(&file_path, &content) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn create_file(file_path: String) -> OperationResult {
    match fs::write(&file_path, "") {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn create_directory(dir_path: String) -> OperationResult {
    match fs::create_dir_all(&dir_path) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn delete_file(file_path: String) -> OperationResult {
    // Try to move to trash, fall back to delete
    match trash::delete(&file_path) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(_) => match fs::remove_file(&file_path).or_else(|_| fs::remove_dir_all(&file_path)) {
            Ok(_) => OperationResult {
                success: true,
                content: None,
                error: None,
            },
            Err(e) => OperationResult {
                success: false,
                content: None,
                error: Some(e.to_string()),
            },
        },
    }
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> OperationResult {
    match fs::rename(&old_path, &new_path) {
        Ok(_) => OperationResult {
            success: true,
            content: None,
            error: None,
        },
        Err(e) => OperationResult {
            success: false,
            content: None,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn file_exists(file_path: String) -> bool {
    PathBuf::from(&file_path).exists()
}
