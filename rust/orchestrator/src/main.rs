use devflow_orchestrator::{discover, run_with_events, RunRequest};
use serde_json::json;
use std::io::{self, BufRead, Write};

fn main() {
    devflow_orchestrator::install_signal_handlers();
    for line in io::stdin().lock().lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) => {
                emit(json!({"ok":false,"error":error.to_string()}));
                break;
            }
        };
        if line.trim().is_empty() {
            continue;
        }
        let value: serde_json::Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(error) => {
                emit(json!({"ok":false,"error":format!("invalid request: {error}")}));
                continue;
            }
        };
        match value
            .get("operation")
            .and_then(|value| value.as_str())
            .unwrap_or("run")
        {
            "providers" => emit(json!({"ok":true,"providers":discover()})),
            "run" => match serde_json::from_value::<RunRequest>(value) {
                Ok(request) => {
                    match run_with_events(&request, |event| emit(json!({"event": event}))) {
                        Ok(result) => emit(json!({"ok":true,"result":result})),
                        Err(error) => emit(json!({"ok":false,"error":error})),
                    }
                }
                Err(error) => {
                    emit(json!({"ok":false,"error":format!("invalid run request: {error}")}))
                }
            },
            other => emit(json!({"ok":false,"error":format!("unknown operation: {other}")})),
        }
    }
}

/// Pipe quebrado (quem chamou foi embora) não pode derrubar o orquestrador com um pânico.
fn emit(value: serde_json::Value) {
    let mut out = io::stdout().lock();
    let _ = writeln!(out, "{}", value);
    let _ = out.flush();
}
