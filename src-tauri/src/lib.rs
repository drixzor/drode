mod state;
mod db;
mod commands;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let state = AppState::new(app.handle());
            app.manage(state);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Project management
            commands::projects::get_recent_projects,
            commands::projects::get_current_project,
            commands::projects::set_current_project,
            commands::projects::remove_recent_project,
            // File system
            commands::files::read_directory,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::create_file,
            commands::files::create_directory,
            commands::files::delete_file,
            commands::files::rename_file,
            commands::files::file_exists,
            // Claude CLI
            commands::claude::start_claude_cli,
            commands::claude::send_to_claude,
            commands::claude::respond_to_tool,
            commands::claude::stop_claude_cli,
            commands::claude::is_claude_running,
            commands::claude::get_dangerous_mode,
            commands::claude::set_dangerous_mode,
            // Conversations (legacy)
            commands::conversations::save_conversation,
            commands::conversations::load_conversation,
            commands::conversations::clear_conversation,
            // Conversations (multi)
            commands::conversations::list_conversations,
            commands::conversations::create_conversation,
            commands::conversations::get_conversation,
            commands::conversations::save_conversation_messages,
            commands::conversations::delete_conversation,
            commands::conversations::rename_conversation,
            commands::conversations::get_active_conversation,
            commands::conversations::set_active_conversation,
            // Terminal
            commands::terminal::run_terminal_command,
            commands::terminal::kill_terminal_process,
            // Ports
            commands::ports::list_ports,
            commands::ports::kill_port,
            // Activity Log
            commands::activity::log_activity,
            commands::activity::get_activity_log,
            commands::activity::clear_activity_log,
            // OAuth
            commands::oauth::oauth_start,
            commands::oauth::oauth_get_token,
            commands::oauth::oauth_get_status,
            commands::oauth::oauth_revoke,
            // GitHub
            commands::github::github_list_repos,
            commands::github::github_get_repo_tree,
            commands::github::github_read_file,
            commands::github::github_update_file,
            commands::github::github_list_branches,
            commands::github::github_create_branch,
            commands::github::github_list_pull_requests,
            commands::github::github_create_pull_request,
            // Supabase
            commands::supabase::supabase_list_projects,
            commands::supabase::supabase_list_tables,
            commands::supabase::supabase_get_table_data,
            commands::supabase::supabase_run_sql,
            commands::supabase::supabase_insert_row,
            commands::supabase::supabase_update_row,
            commands::supabase::supabase_delete_row,
            commands::supabase::supabase_run_migration,
            // Vercel
            commands::vercel::vercel_list_projects,
            commands::vercel::vercel_list_deployments,
            commands::vercel::vercel_get_deployment,
            commands::vercel::vercel_get_deployment_logs,
            commands::vercel::vercel_create_deployment,
            commands::vercel::vercel_list_domains,
            commands::vercel::vercel_add_domain,
            commands::vercel::vercel_remove_domain,
            commands::vercel::vercel_promote_deployment,
            commands::vercel::vercel_rollback_deployment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
