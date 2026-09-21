use devflow_orchestrator::{discover, run_with_events, RunRequest, ScheduledTask, Scheduler};
use serde_json::json;
use std::io::{self, BufRead, Write};

fn main() {
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
            "plan" => {
                let tasks = value
                    .get("tasks")
                    .cloned()
                    .and_then(|tasks| serde_json::from_value::<Vec<ScheduledTask>>(tasks).ok());
                let concurrency = value
                    .get("max_concurrency")
                    .and_then(|value| value.as_u64())
                    .unwrap_or(1) as usize;
                match tasks.and_then(|tasks| Scheduler::new(tasks, concurrency).ok()) {
                    Some(mut scheduler) => {
                        scheduler.queue_all_draft();
                        emit(
                            json!({"ok":true,"ready":scheduler.start_ready(),"tasks":scheduler.tasks().collect::<Vec<_>>() }),
                        );
                    }
                    None => emit(json!({"ok":false,"error":"invalid task DAG"})),
                }
            }
            other => emit(json!({"ok":false,"error":format!("unknown operation: {other}")})),
        }
    }
}

fn emit(value: serde_json::Value) {
    println!("{}", value);
    let _ = io::stdout().flush();
}
