use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    io::{BufRead, Read},
    path::PathBuf,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Claude,
    Codex,
    #[serde(alias = "agy")]
    Antigravity,
}

impl ProviderId {
    pub fn binaries(self) -> &'static [&'static str] {
        match self {
            Self::Claude => &["claude"],
            Self::Codex => &["codex"],
            Self::Antigravity => &["agy", "antigravity"],
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskMode {
    Ask,
    Plan,
    Execute,
}

#[derive(Clone, Debug, Deserialize)]
pub struct RunRequest {
    pub request: String,
    pub provider: ProviderId,
    pub cwd: PathBuf,
    pub model: Option<String>,
    #[serde(default)]
    pub additional_dirs: Vec<PathBuf>,
    #[serde(default = "default_mode")]
    pub mode: TaskMode,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// Flags extras do CLI (ex.: --plugin-dir das skills do DevFlow), inseridas antes do prompt
    #[serde(default)]
    pub extra_args: Vec<String>,
}

fn default_mode() -> TaskMode {
    TaskMode::Execute
}

fn default_timeout() -> u64 {
    300_000
}

#[derive(Clone, Debug, Serialize)]
pub struct ProviderStatus {
    pub id: ProviderId,
    pub available: bool,
    pub version: Option<String>,
}

pub fn discover() -> Vec<ProviderStatus> {
    [
        ProviderId::Claude,
        ProviderId::Codex,
        ProviderId::Antigravity,
    ]
    .into_iter()
    .map(|id| {
        let executable = find_binary(id.binaries());
        let version = executable
            .as_ref()
            .and_then(|path| Command::new(path).arg("--version").output().ok())
            .and_then(|out| {
                out.status
                    .success()
                    .then(|| String::from_utf8_lossy(&out.stdout).trim().to_owned())
            })
            .filter(|value| !value.is_empty());
        ProviderStatus {
            id,
            available: executable.is_some(),
            version,
        }
    })
    .collect()
}

fn find_binary(binaries: &[&str]) -> Option<PathBuf> {
    let mut directories: Vec<PathBuf> = std::env::var_os("PATH")
        .into_iter()
        .flat_map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .collect();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        directories.extend([
            home.join(".local/bin"),
            home.join(".bun/bin"),
            home.join(".cargo/bin"),
        ]);
    }
    directories.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
    ]);
    directories
        .into_iter()
        .flat_map(|dir| binaries.iter().map(move |binary| dir.join(binary)))
        .find(|candidate| candidate.is_file())
}

#[derive(Clone, Debug, Serialize)]
pub struct RunResult {
    pub provider: ProviderId,
    pub text: String,
    pub events: usize,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

pub fn run(request: &RunRequest) -> Result<RunResult, String> {
    run_with_events(request, |_| {})
}

#[derive(Clone, Debug, Serialize)]
pub struct OrchestratorEvent {
    pub provider: ProviderId,
    pub kind: String,
    pub message: String,
    pub timestamp_ms: u128,
    pub payload: Value,
}

pub fn build_args(request: &RunRequest) -> Vec<String> {
    let mut args = Vec::new();
    match request.provider {
        ProviderId::Claude => {
            args.extend([
                "--print".into(),
                "--output-format".into(),
                "stream-json".into(),
                "--verbose".into(),
            ]);
            if request.mode == TaskMode::Execute {
                args.push("--dangerously-skip-permissions".into());
            } else {
                args.extend(["--permission-mode".into(), "plan".into()]);
            }
            if let Some(model) = request
                .model
                .as_ref()
                .filter(|m| !m.is_empty() && !m.eq_ignore_ascii_case("default") && !m.eq_ignore_ascii_case("padrão"))
            {
                args.extend(["--model".into(), model.clone()]);
            }
            for directory in &request.additional_dirs {
                args.extend(["--add-dir".into(), directory.display().to_string()]);
            }
            args.extend(request.extra_args.iter().cloned());
            args.push("--".into());
            args.push(request.request.clone());
        }
        ProviderId::Codex => {
            args.extend(["exec".into(), "--json".into()]);
            if request.mode == TaskMode::Execute {
                args.push("--dangerously-bypass-approvals-and-sandbox".into());
            } else {
                args.extend(["--sandbox".into(), "read-only".into()]);
            }
            args.extend([
                "--skip-git-repo-check".into(),
                "--ignore-user-config".into(),
                "--cd".into(),
                request.cwd.display().to_string(),
            ]);
            for directory in &request.additional_dirs {
                args.extend(["--add-dir".into(), directory.display().to_string()]);
            }
            if let Some(model) = request
                .model
                .as_ref()
                .filter(|m| !m.is_empty() && !m.eq_ignore_ascii_case("default") && !m.eq_ignore_ascii_case("padrão"))
            {
                args.extend(["-m".into(), model.clone()]);
            }
            args.extend(request.extra_args.iter().cloned());
            args.push("--".into());
            args.push(request.request.clone());
        }
        ProviderId::Antigravity => {
            args.extend([
                "--output-format".into(),
                "stream-json".into(),
                "--dangerously-skip-permissions".into(),
            ]);
            if let Some(model) = request
                .model
                .as_ref()
                .filter(|m| !m.is_empty() && !m.eq_ignore_ascii_case("default") && !m.eq_ignore_ascii_case("padrão"))
            {
                args.extend(["--model".into(), model.clone()]);
            }
            args.extend([
                "--add-dir".into(),
                request.cwd.display().to_string(),
            ]);
            for directory in &request.additional_dirs {
                args.extend(["--add-dir".into(), directory.display().to_string()]);
            }
            args.extend(request.extra_args.iter().cloned());
            args.extend(["-p".into(), request.request.clone()]);
        }
    }
    args
}

pub fn run_with_events<F>(request: &RunRequest, mut on_event: F) -> Result<RunResult, String>
where
    F: FnMut(OrchestratorEvent),
{
    let executable = find_binary(request.provider.binaries()).ok_or_else(|| {
        format!(
            "{} CLI was not found in PATH",
            request.provider.binaries().join("/")
        )
    })?;
    if !request.cwd.is_dir() {
        return Err(format!(
            "workspace does not exist: {}",
            request.cwd.display()
        ));
    }
    if let Some(directory) = request
        .additional_dirs
        .iter()
        .find(|directory| !directory.is_dir())
    {
        return Err(format!(
            "additional workspace directory does not exist: {}",
            directory.display()
        ));
    }

    let args = build_args(request);
    let mut command = Command::new(executable);
    command
        .args(args)
        .current_dir(&request.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to start provider: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "provider stdout unavailable".to_owned())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "provider stderr unavailable".to_owned())?;

    let (sender, receiver) = mpsc::channel::<String>();
    let _stdout_reader = thread::spawn(move || {
        for line in std::io::BufReader::new(stdout).lines().map_while(Result::ok) {
            if sender.send(line).is_err() {
                break;
            }
        }
    });

    let (err_sender, err_receiver) = mpsc::channel::<Vec<u8>>();
    let _stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = std::io::BufReader::new(stderr).read_to_end(&mut bytes);
        let _ = err_sender.send(bytes);
    });

    let started = Instant::now();
    let mut lines = Vec::new();
    let status = loop {
        while let Ok(line) = receiver.try_recv() {
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                on_event(OrchestratorEvent {
                    provider: request.provider,
                    kind: event_kind(&value).into(),
                    message: event_message(&value),
                    timestamp_ms: now_ms(),
                    payload: value,
                });
            }
            lines.push(line);
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("failed waiting for provider: {error}"))?
        {
            break status;
        }
        if started.elapsed() >= Duration::from_millis(request.timeout_ms.max(1)) {
            #[cfg(unix)]
            unsafe {
                let pid = child.id() as libc::pid_t;
                libc::kill(-pid, libc::SIGTERM);
            }
            #[cfg(not(unix))]
            let _ = child.kill();

            let _ = child.wait();
            let stderr_bytes = err_receiver.recv_timeout(Duration::from_millis(50)).unwrap_or_default();
            return Err(format!(
                "provider timed out after {}ms: {}",
                request.timeout_ms,
                String::from_utf8_lossy(&stderr_bytes).trim()
            ));
        }
        thread::sleep(Duration::from_millis(10));
    };

    while let Ok(line) = receiver.recv_timeout(Duration::from_millis(25)) {
        if let Ok(value) = serde_json::from_str::<Value>(&line) {
            on_event(OrchestratorEvent {
                provider: request.provider,
                kind: event_kind(&value).into(),
                message: event_message(&value),
                timestamp_ms: now_ms(),
                payload: value,
            });
        }
        lines.push(line);
    }

    let stderr = err_receiver.recv_timeout(Duration::from_millis(50)).unwrap_or_default();

    if !status.success() {
        let last_stdout_lines = lines.iter().rev().take(10).cloned().collect::<Vec<_>>();
        let mut err_details = String::from_utf8_lossy(&stderr).trim().to_owned();
        if !last_stdout_lines.is_empty() {
            if !err_details.is_empty() {
                err_details.push_str("\n\nÚltimas linhas de stdout:\n");
            } else {
                err_details.push_str("Últimas linhas de stdout:\n");
            }
            for l in last_stdout_lines.into_iter().rev() {
                err_details.push_str(&l);
                err_details.push('\n');
            }
        }
        return Err(format!(
            "provider exited with {}: {}",
            status,
            err_details.trim()
        ));
    }

    parse_jsonl(request.provider, lines.join("\n").as_bytes())
}

fn event_kind(value: &Value) -> &'static str {
    let ty = value
        .get("type")
        .or_else(|| value.get("event"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    if ty.contains("error") || ty.contains("failed") {
        "failed"
    } else if matches!(
        ty,
        "result" | "completed" | "item.completed" | "response.completed"
    ) {
        "completed"
    } else {
        "progress"
    }
}

fn event_message(value: &Value) -> String {
    value
        .get("type")
        .or_else(|| value.get("event"))
        .and_then(Value::as_str)
        .unwrap_or("provider_event")
        .to_owned()
}

fn parse_jsonl(provider: ProviderId, bytes: &[u8]) -> Result<RunResult, String> {
    let text = std::str::from_utf8(bytes)
        .map_err(|error| format!("provider output is not UTF-8: {error}"))?;
    let mut result = None;
    let mut delta_acc = String::new();
    let mut events = 0;
    let mut input_tokens = None;
    let mut output_tokens = None;
    for raw in text.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let value: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => {
                // Non-JSON line (e.g. CLI warning or preamble); skip gracefully
                continue;
            }
        };
        events += 1;

        if value.get("is_error").and_then(Value::as_bool) == Some(true) {
            let err_msg = terminal_text(&value)
                .or_else(|| value.get("error").and_then(Value::as_str).map(String::from))
                .unwrap_or_else(|| "provider returned error status".to_owned());
            return Err(err_msg);
        }

        if let Some(usage) = value
            .get("usage")
            .or_else(|| value.get("result").and_then(|v| v.get("usage")))
            .or_else(|| value.get("step_update").and_then(|v| v.get("usage")))
        {
            input_tokens = usage
                .get("input_tokens")
                .or_else(|| usage.get("input"))
                .and_then(Value::as_u64)
                .or(input_tokens);
            output_tokens = usage
                .get("output_tokens")
                .or_else(|| usage.get("output"))
                .and_then(Value::as_u64)
                .or(output_tokens);
        }
        if let Some(step) = value.get("step_update") {
            if let Some(delta) = step.get("text_delta").and_then(Value::as_str) {
                delta_acc.push_str(delta);
            }
        }
        if let Some(candidate) = terminal_text(&value) {
            result = Some(candidate);
        }
    }

    if events == 0 {
        let raw_trimmed = text.trim();
        if !raw_trimmed.is_empty() {
            return Ok(RunResult {
                provider,
                text: raw_trimmed.to_owned(),
                events: 0,
                input_tokens: None,
                output_tokens: None,
            });
        }
    }

    let final_text = result
        .or_else(|| if !delta_acc.trim().is_empty() { Some(delta_acc) } else { None })
        .ok_or_else(|| "provider returned no terminal result text".to_owned())?;

    Ok(RunResult {
        provider,
        text: final_text,
        events,
        input_tokens,
        output_tokens,
    })
}

fn terminal_text(value: &Value) -> Option<String> {
    let event_type = value
        .get("type")
        .or_else(|| value.get("event"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    let terminal = matches!(
        event_type,
        "result" | "completed" | "item.completed" | "response.completed"
    );
    if !terminal {
        return None;
    }
    if let Some(result_obj) = value.get("result") {
        if let Some(text) = result_obj.as_str() {
            return Some(text.to_owned());
        }
        for subkey in ["response", "text", "message", "output"] {
            if let Some(text) = result_obj.get(subkey).and_then(Value::as_str) {
                return Some(text.to_owned());
            }
        }
    }
    for key in ["result", "text", "message", "output", "response"] {
        if let Some(text) = value.get(key).and_then(Value::as_str) {
            return Some(text.to_owned());
        }
        if let Some(text) = value
            .get(key)
            .and_then(|v| v.get("text").or_else(|| v.get("response")).or_else(|| v.get("message")))
            .and_then(Value::as_str)
        {
            return Some(text.to_owned());
        }
    }
    if event_type == "item.completed" {
        let item = value.get("item")?;
        if matches!(item.get("type").and_then(Value::as_str), Some("agent_message" | "assistant_message")) {
            for key in ["text", "message", "output", "response"] {
                if let Some(text) = item.get(key).and_then(Value::as_str) {
                    return Some(text.to_owned());
                }
            }
        }
    }
    None
}

pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_args_claude_execute_mode() {
        let req = RunRequest {
            request: "do work".into(),
            provider: ProviderId::Claude,
            cwd: PathBuf::from("/tmp"),
            model: Some("claude-3-7-sonnet".into()),
            additional_dirs: vec![PathBuf::from("/extra")],
            mode: TaskMode::Execute,
            timeout_ms: 10000,
            extra_args: vec!["--plugin-dir".into(), "/plugins".into()],
        };
        let args = build_args(&req);
        assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
        assert!(!args.contains(&"--permission-mode".to_string()));
        assert!(args.contains(&"--add-dir".to_string()));
        assert!(args.contains(&"/extra".to_string()));
        assert!(args.contains(&"--plugin-dir".to_string()));
        let dash_dash_idx = args.iter().position(|a| a == "--").unwrap();
        assert_eq!(args[dash_dash_idx + 1], "do work");
    }

    #[test]
    fn build_args_claude_plan_mode() {
        let req = RunRequest {
            request: "plan work".into(),
            provider: ProviderId::Claude,
            cwd: PathBuf::from("/tmp"),
            model: None,
            additional_dirs: vec![],
            mode: TaskMode::Plan,
            timeout_ms: 10000,
            extra_args: vec![],
        };
        let args = build_args(&req);
        assert!(!args.contains(&"--dangerously-skip-permissions".to_string()));
        let perm_idx = args.iter().position(|a| a == "--permission-mode").unwrap();
        assert_eq!(args[perm_idx + 1], "plan");
    }

    #[test]
    fn build_args_codex_modes() {
        let req_exec = RunRequest {
            request: "fix code".into(),
            provider: ProviderId::Codex,
            cwd: PathBuf::from("/tmp"),
            model: None,
            additional_dirs: vec![],
            mode: TaskMode::Execute,
            timeout_ms: 10000,
            extra_args: vec![],
        };
        let args_exec = build_args(&req_exec);
        assert!(args_exec.contains(&"--dangerously-bypass-approvals-and-sandbox".to_string()));
        assert!(!args_exec.contains(&"--sandbox".to_string()));

        let req_plan = RunRequest {
            request: "review code".into(),
            provider: ProviderId::Codex,
            cwd: PathBuf::from("/tmp"),
            model: None,
            additional_dirs: vec![],
            mode: TaskMode::Plan,
            timeout_ms: 10000,
            extra_args: vec![],
        };
        let args_plan = build_args(&req_plan);
        assert!(!args_plan.contains(&"--dangerously-bypass-approvals-and-sandbox".to_string()));
        let sb_idx = args_plan.iter().position(|a| a == "--sandbox").unwrap();
        assert_eq!(args_plan[sb_idx + 1], "read-only");
    }

    #[test]
    fn parses_claude_is_error() {
        let result = parse_jsonl(
            ProviderId::Claude,
            br#"{"type":"result","is_error":true,"result":"model capacity exceeded"}"#,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("model capacity exceeded"));
    }

    #[test]
    fn parses_terminal_result() {
        let result = parse_jsonl(
            ProviderId::Codex,
            br#"{"type":"progress"}
{"type":"result","result":"done"}"#,
        )
        .unwrap();
        assert_eq!(result.text, "done");
        assert_eq!(result.events, 2);
    }

    #[test]
    fn parses_codex_agent_message_item() {
        let result = parse_jsonl(
            ProviderId::Codex,
            br#"{"type":"thread.started","thread_id":"thread_1"}
{"type":"item.completed","item":{"type":"agent_message","text":"STATUS: PASS"}}
{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":3}}"#,
        )
        .unwrap();
        assert_eq!(result.text, "STATUS: PASS");
        assert_eq!(result.input_tokens, Some(10));
        assert_eq!(result.output_tokens, Some(3));
    }

    #[test]
    fn parses_antigravity_stream_json() {
        let result = parse_jsonl(
            ProviderId::Antigravity,
            r#"{"event":"init","init":{"model":"gemini-3.8-flash-high"}}
{"event":"step_update","step_update":{"step_index":0,"state":"DONE"}}
{"event":"step_update","step_update":{"step_index":1,"state":"DONE","text_delta":"Olá!"}}
{"event":"result","result":{"status":"SUCCESS","response":"Olá! Como posso ajudar você hoje?","usage":{"input_tokens":120,"output_tokens":15}}}"#.as_bytes(),
        )
        .unwrap();
        assert_eq!(result.text, "Olá! Como posso ajudar você hoje?");
        assert_eq!(result.input_tokens, Some(120));
        assert_eq!(result.output_tokens, Some(15));
    }

    #[test]
    fn handles_non_json_preamble_and_plain_text() {
        let with_warning = parse_jsonl(
            ProviderId::Antigravity,
            r#"WARNING: using experimental features
{"event":"result","result":{"status":"SUCCESS","response":"OK"}}"#.as_bytes(),
        )
        .unwrap();
        assert_eq!(with_warning.text, "OK");

        let plain_text = parse_jsonl(
            ProviderId::Antigravity,
            "Olá direto em texto sem JSON!".as_bytes(),
        )
        .unwrap();
        assert_eq!(plain_text.text, "Olá direto em texto sem JSON!");
        assert_eq!(plain_text.events, 0);
    }
}
