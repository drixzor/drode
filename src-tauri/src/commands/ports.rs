use crate::state::OperationResult;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortInfo {
    port: u16,
    pid: u32,
    process_name: String,
    state: String,
    protocol: String,
}

#[tauri::command]
pub fn list_ports() -> Vec<PortInfo> {
    let mut ports = Vec::new();

    // Use lsof to list network connections (macOS)
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-i", "-P", "-n", "-sTCP:LISTEN"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 9 {
                    let process_name = parts[0].to_string();
                    let pid: u32 = parts[1].parse().unwrap_or(0);
                    let addr = parts[8];

                    // Extract port from address (format: *:PORT or IP:PORT)
                    if let Some(port_str) = addr.rsplit(':').next() {
                        if let Ok(port) = port_str.parse::<u16>() {
                            // Check if we already have this port
                            if !ports
                                .iter()
                                .any(|p: &PortInfo| p.port == port && p.pid == pid)
                            {
                                ports.push(PortInfo {
                                    port,
                                    pid,
                                    process_name,
                                    state: "LISTEN".to_string(),
                                    protocol: "TCP".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by port number
    ports.sort_by_key(|p| p.port);
    ports
}

#[tauri::command]
pub fn kill_port(port: u16) -> OperationResult {
    // Find process using this port and kill it
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t"])
            .output();

        if let Ok(output) = output {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                if let Ok(pid_num) = pid.trim().parse::<i32>() {
                    // Try graceful kill first
                    let _ = Command::new("kill")
                        .args(["-TERM", &pid_num.to_string()])
                        .output();

                    // Wait a moment
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    // Force kill if still running
                    let _ = Command::new("kill")
                        .args(["-9", &pid_num.to_string()])
                        .output();
                }
            }
            return OperationResult {
                success: true,
                content: None,
                error: None,
            };
        }
    }

    OperationResult {
        success: false,
        content: None,
        error: Some("Failed to kill process on port".to_string()),
    }
}
