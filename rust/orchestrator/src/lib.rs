use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
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

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskDepth {
    Fast,
    Balanced,
    Deep,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Analyze,
    Plan,
    Edit,
    Test,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskState {
    Draft,
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ScheduledTask {
    pub id: String,
    pub request: String,
    pub dependencies: Vec<String>,
    pub state: TaskState,
    #[serde(default)]
    pub attempts: u32,
}

/// Deterministic DAG scheduler used by the UI-independent orchestration layer.
#[derive(Debug)]
pub struct Scheduler {
    tasks: BTreeMap<String, ScheduledTask>,
    max_concurrency: usize,
}

impl Scheduler {
    pub fn new(tasks: Vec<ScheduledTask>, max_concurrency: usize) -> Result<Self, String> {
        if tasks.is_empty() {
            return Err("task DAG must not be empty".into());
        }
        if max_concurrency == 0 {
            return Err("max_concurrency must be positive".into());
        }
        let mut indexed = BTreeMap::new();
        for task in tasks {
            if task.id.trim().is_empty() {
                return Err("task id must not be empty".into());
            }
            if indexed.insert(task.id.clone(), task).is_some() {
                return Err("duplicate task id".into());
            }
        }
        for (id, task) in &indexed {
            for dependency in &task.dependencies {
                if dependency == id {
                    return Err(format!("task {id} depends on itself"));
                }
                if !indexed.contains_key(dependency) {
                    return Err(format!("unknown dependency: {dependency}"));
                }
            }
        }
        if has_cycle(&indexed) {
            return Err("task DAG contains a cycle".into());
        }
        Ok(Self {
            tasks: indexed,
            max_concurrency,
        })
    }

    pub fn ready(&self) -> Vec<String> {
        let running = self
            .tasks
            .values()
            .filter(|task| task.state == TaskState::Running)
            .count();
        let slots = self.max_concurrency.saturating_sub(running);
        self.tasks
            .values()
            .filter(|task| {
                task.state == TaskState::Queued
                    && task
                        .dependencies
                        .iter()
                        .all(|id| self.tasks[id].state == TaskState::Succeeded)
            })
            .map(|task| task.id.clone())
            .take(slots)
            .collect()
    }

    pub fn queue_all_draft(&mut self) {
        for task in self.tasks.values_mut() {
            if task.state == TaskState::Draft {
                task.state = TaskState::Queued;
            }
        }
    }
    pub fn start_ready(&mut self) -> Vec<String> {
        let ready = self.ready();
        for id in &ready {
            self.tasks.get_mut(id).expect("ready task exists").state = TaskState::Running;
        }
        ready
    }
    pub fn finish(&mut self, id: &str, success: bool) -> Result<(), String> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or_else(|| format!("unknown task: {id}"))?;
        if task.state != TaskState::Running {
            return Err(format!("task {id} is not running"));
        }
        task.state = if success {
            TaskState::Succeeded
        } else {
            TaskState::Failed
        };
        Ok(())
    }
    pub fn retry(&mut self, id: &str) -> Result<(), String> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or_else(|| format!("unknown task: {id}"))?;
        if task.state != TaskState::Failed {
            return Err(format!("task {id} is not failed"));
        }
        task.attempts = task.attempts.saturating_add(1);
        task.state = TaskState::Queued;
        Ok(())
    }
    pub fn tasks(&self) -> impl Iterator<Item = &ScheduledTask> {
        self.tasks.values()
    }
}

fn has_cycle(tasks: &BTreeMap<String, ScheduledTask>) -> bool {
    let mut incoming: BTreeMap<&str, usize> = tasks
        .iter()
        .map(|(id, task)| (id.as_str(), task.dependencies.len()))
        .collect();
    let mut ready: VecDeque<&str> = incoming
        .iter()
        .filter(|(_, count)| **count == 0)
        .map(|(id, _)| *id)
        .collect();
    let mut visited = 0;
    while let Some(id) = ready.pop_front() {
        visited += 1;
        for task in tasks.values() {
            if task.dependencies.iter().any(|dependency| dependency == id) {
                let count = incoming.get_mut(task.id.as_str()).expect("task is indexed");
                *count -= 1;
                if *count == 0 {
                    ready.push_back(task.id.as_str());
                }
            }
        }
    }
    visited != tasks.len()
}

#[derive(Clone, Debug, Serialize)]
pub struct TaskAnalysis {
    pub capabilities: BTreeSet<Capability>,
    pub suggested_depth: TaskDepth,
}

pub fn analyze(request: &str, mode: TaskMode, depth: TaskDepth) -> Result<TaskAnalysis, String> {
    if request.trim().is_empty() {
        return Err("task request must not be empty".into());
    }
    let mut capabilities = BTreeSet::from([Capability::Analyze]);
    if matches!(mode, TaskMode::Plan | TaskMode::Execute) {
        capabilities.insert(Capability::Plan);
    }
    if mode == TaskMode::Execute {
        let text = request.to_ascii_lowercase();
        if ["edit", "change", "implement", "fix", "write", "remove"]
            .iter()
            .any(|term| text.contains(term))
        {
            capabilities.insert(Capability::Edit);
        }
        if ["test", "verify", "check"]
            .iter()
            .any(|term| text.contains(term))
        {
            capabilities.insert(Capability::Test);
        }
    }
    Ok(TaskAnalysis {
        capabilities,
        suggested_depth: depth,
    })
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
    #[serde(default = "default_depth")]
    pub depth: TaskDepth,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}
fn default_mode() -> TaskMode {
    TaskMode::Execute
}
fn default_depth() -> TaskDepth {
    TaskDepth::Balanced
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

pub fn run_with_events<F>(request: &RunRequest, mut on_event: F) -> Result<RunResult, String>
where
    F: FnMut(OrchestratorEvent),
{
    let analysis = analyze(&request.request, request.mode, request.depth)?;
    if request.mode != TaskMode::Execute && analysis.capabilities.contains(&Capability::Edit) {
        return Err("task mode does not permit edits".into());
    }
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

    let mut args = Vec::new();
    match request.provider {
        ProviderId::Claude => {
            args.extend(
                ["--print", "--output-format", "stream-json", "--verbose"].map(String::from),
            );
            if let Some(model) = &request.model {
                args.extend(["--model".into(), model.clone()]);
            }
            args.push(request.request.clone());
        }
        ProviderId::Codex => {
            args.extend(
                [
                    "exec",
                    "--json",
                    "--dangerously-bypass-approvals-and-sandbox",
                    "--cd",
                ]
                .map(String::from),
            );
            args.push(request.cwd.display().to_string());
            for directory in &request.additional_dirs {
                args.extend(["--add-dir".into(), directory.display().to_string()]);
            }
            if let Some(model) = &request.model {
                args.extend(["-m".into(), model.clone()]);
            }
            args.push(request.request.clone());
        }
        ProviderId::Antigravity => {
            if let Some(model) = &request.model {
                args.extend(["--model".into(), model.clone()]);
            }
            args.extend([
                "--dangerously-skip-permissions".into(),
                "--add-dir".into(),
                request.cwd.display().to_string(),
            ]);
            for directory in &request.additional_dirs {
                args.extend(["--add-dir".into(), directory.display().to_string()]);
            }
            args.extend(["-p".into(), request.request.clone()]);
        }
    }
    let mut command = Command::new(executable);
    command
        .args(args)
        .current_dir(&request.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
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
    let stdout_reader = thread::spawn(move || {
        for line in std::io::BufReader::new(stdout).lines().flatten() {
            if sender.send(line).is_err() {
                break;
            }
        }
    });
    let stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = std::io::BufReader::new(stderr).read_to_end(&mut bytes);
        bytes
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
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let stderr = stderr_reader.join().unwrap_or_default();
            return Err(format!(
                "provider timed out after {}ms: {}",
                request.timeout_ms,
                String::from_utf8_lossy(&stderr).trim()
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
    let _ = stdout_reader.join();
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
    let stderr = stderr_reader.join().unwrap_or_default();
    if !status.success() {
        return Err(format!(
            "provider exited with {}: {}",
            status,
            String::from_utf8_lossy(&stderr).trim()
        ));
    }
    parse_jsonl(request.provider, lines.join("\n").as_bytes())
}

fn event_kind(value: &Value) -> &'static str {
    let ty = value
        .get("type")
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
        .and_then(Value::as_str)
        .unwrap_or("provider_event")
        .to_owned()
}

fn parse_jsonl(provider: ProviderId, bytes: &[u8]) -> Result<RunResult, String> {
    let text = std::str::from_utf8(bytes)
        .map_err(|error| format!("provider output is not UTF-8: {error}"))?;
    let mut result = None;
    let mut events = 0;
    let mut input_tokens = None;
    let mut output_tokens = None;
    for (line, raw) in text.lines().enumerate() {
        if raw.trim().is_empty() {
            continue;
        }
        let value: Value = serde_json::from_str(raw)
            .map_err(|error| format!("invalid provider JSON on line {}: {error}", line + 1))?;
        events += 1;
        if let Some(usage) = value
            .get("usage")
            .or_else(|| value.get("result").and_then(|v| v.get("usage")))
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
        if let Some(candidate) = terminal_text(&value) {
            result = Some(candidate);
        }
    }
    let text = result.ok_or_else(|| "provider returned no terminal result text".to_owned())?;
    Ok(RunResult {
        provider,
        text,
        events,
        input_tokens,
        output_tokens,
    })
}

fn terminal_text(value: &Value) -> Option<String> {
    let event_type = value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let terminal = matches!(
        event_type,
        "result" | "completed" | "item.completed" | "response.completed"
    );
    if !terminal {
        return None;
    }
    for key in ["result", "text", "message", "output"] {
        if let Some(text) = value.get(key).and_then(Value::as_str) {
            return Some(text.to_owned());
        }
        if let Some(text) = value
            .get(key)
            .and_then(|v| v.get("text"))
            .and_then(Value::as_str)
        {
            return Some(text.to_owned());
        }
    }
    if event_type == "item.completed" {
        let item = value.get("item")?;
        if matches!(item.get("type").and_then(Value::as_str), Some("agent_message" | "assistant_message")) {
            for key in ["text", "message", "output"] {
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
    fn analyzer_limits_edit_capability() {
        let result = analyze("implement feature", TaskMode::Plan, TaskDepth::Deep).unwrap();
        assert!(!result.capabilities.contains(&Capability::Edit));
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

    fn task(id: &str, dependencies: &[&str]) -> ScheduledTask {
        ScheduledTask {
            id: id.into(),
            request: id.into(),
            dependencies: dependencies.iter().map(|value| (*value).into()).collect(),
            state: TaskState::Draft,
            attempts: 0,
        }
    }

    #[test]
    fn scheduler_respects_dependencies_and_concurrency() {
        let mut scheduler =
            Scheduler::new(vec![task("a", &[]), task("b", &["a"]), task("c", &[])], 1).unwrap();
        scheduler.queue_all_draft();
        assert_eq!(scheduler.start_ready(), vec!["a"]);
        scheduler.finish("a", true).unwrap();
        assert_eq!(scheduler.start_ready(), vec!["b"]);
    }

    #[test]
    fn scheduler_rejects_cycles_and_missing_dependencies() {
        assert!(Scheduler::new(vec![task("a", &["missing"])], 1).is_err());
        assert!(Scheduler::new(vec![task("a", &["b"]), task("b", &["a"])], 1).is_err());
    }

    #[test]
    fn failed_task_can_be_retried_explicitly() {
        let mut scheduler = Scheduler::new(vec![task("a", &[])], 1).unwrap();
        scheduler.queue_all_draft();
        scheduler.start_ready();
        scheduler.finish("a", false).unwrap();
        scheduler.retry("a").unwrap();
        assert_eq!(scheduler.start_ready(), vec!["a"]);
        assert_eq!(scheduler.tasks().next().unwrap().attempts, 1);
    }
}
