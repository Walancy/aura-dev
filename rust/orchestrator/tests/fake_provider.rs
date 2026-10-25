//! Testes de integração com "provedores" falsos (scripts no PATH): sucesso, falha, timeout, UTF-8 inválido e cancelamento.
#![cfg(unix)]

use std::{
    fs,
    io::Write,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::OnceLock,
    time::{Duration, Instant},
};

use devflow_orchestrator::{run_with_events, ProviderId, RunRequest, TaskMode};

/// Diretório com `claude`, `codex` e `agy` falsos; o comportamento vem do texto do pedido (último argumento).
fn fake_bin_dir() -> &'static PathBuf {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        let dir = std::env::temp_dir().join(format!("devflow-orch-fake-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = r#"#!/bin/sh
# o pedido é o último argumento
for a in "$@"; do prompt="$a"; done
case "$prompt" in
  ok)
    echo '{"type":"system","subtype":"init"}'
    echo '{"type":"result","subtype":"success","result":"feito","usage":{"input_tokens":7,"output_tokens":2}}'
    ;;
  fail)
    echo "algo deu errado" >&2
    exit 3
    ;;
  badutf8)
    printf '{"type":"progress"}\n'
    printf 'linha \377\376 invalida\n'
    # muita saída depois da linha inválida: se o leitor parar, o pipe enche e o provedor trava
    i=0; while [ $i -lt 4000 ]; do echo "ruido ruido ruido ruido ruido ruido ruido ruido ruido ruido $i"; i=$((i+1)); done
    echo '{"type":"result","result":"depois do lixo"}'
    ;;
  sleep:*)
    pidfile="${prompt#sleep:}"
    echo $$ > "$pidfile"
    sleep 30 &
    echo $! >> "$pidfile"
    wait
    ;;
  stubborn:*)
    pidfile="${prompt#stubborn:}"
    trap '' TERM
    echo $$ > "$pidfile"
    while true; do sleep 1; done
    ;;
  *)
    echo '{"type":"result","result":"?"}'
    ;;
esac
"#;
        for name in ["claude", "codex", "agy"] {
            let path = dir.join(name);
            fs::write(&path, script).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let old = std::env::var("PATH").unwrap_or_default();
        std::env::set_var("PATH", format!("{}:{old}", dir.display()));
        dir
    })
}

fn request(prompt: &str, provider: ProviderId, timeout_ms: u64) -> RunRequest {
    fake_bin_dir();
    RunRequest {
        request: prompt.into(),
        provider,
        cwd: std::env::temp_dir(),
        model: None,
        additional_dirs: vec![],
        mode: TaskMode::Execute,
        timeout_ms,
        extra_args: vec![],
    }
}

fn alive(pid: i32) -> bool {
    unsafe { libc::kill(pid, 0) == 0 }
}

fn read_pids(file: &Path) -> Vec<i32> {
    fs::read_to_string(file).unwrap_or_default().lines().filter_map(|l| l.trim().parse().ok()).collect()
}

fn wait_until(deadline: Duration, mut cond: impl FnMut() -> bool) -> bool {
    let start = Instant::now();
    while start.elapsed() < deadline {
        if cond() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    cond()
}

#[test]
fn sucesso_devolve_texto_e_tokens() {
    let result = run_with_events(&request("ok", ProviderId::Claude, 10_000), |_| {}).unwrap();
    assert_eq!(result.text, "feito");
    assert_eq!(result.input_tokens, Some(7));
    assert_eq!(result.output_tokens, Some(2));
}

#[test]
fn eventos_chegam_em_ordem() {
    let mut kinds = Vec::new();
    run_with_events(&request("ok", ProviderId::Codex, 10_000), |e| kinds.push(e.kind)).unwrap();
    assert_eq!(kinds, vec!["progress", "completed"]);
}

#[test]
fn saida_com_erro_inclui_stderr() {
    let err = run_with_events(&request("fail", ProviderId::Claude, 10_000), |_| {}).unwrap_err();
    assert!(err.contains("algo deu errado"), "{err}");
}

#[test]
fn utf8_invalido_nao_trava_o_provedor() {
    let result = run_with_events(&request("badutf8", ProviderId::Antigravity, 15_000), |_| {}).unwrap();
    assert_eq!(result.text, "depois do lixo");
}

#[test]
fn timeout_mata_o_provedor_e_os_netos() {
    let pidfile = std::env::temp_dir().join(format!("devflow-orch-timeout-{}.pid", std::process::id()));
    let _ = fs::remove_file(&pidfile);
    let started = Instant::now();
    let err = run_with_events(&request(&format!("sleep:{}", pidfile.display()), ProviderId::Claude, 2_000), |_| {}).unwrap_err();
    assert!(err.contains("timed out"), "{err}");
    assert!(started.elapsed() < Duration::from_secs(10));
    let pids = read_pids(&pidfile);
    assert_eq!(pids.len(), 2, "o script deve registrar o pid dele e o do neto");
    assert!(wait_until(Duration::from_secs(3), || pids.iter().all(|p| !alive(*p))), "processos sobraram: {pids:?}");
}

#[test]
fn timeout_escala_para_sigkill_quando_ignora_sigterm() {
    let pidfile = std::env::temp_dir().join(format!("devflow-orch-stubborn-{}.pid", std::process::id()));
    let _ = fs::remove_file(&pidfile);
    let started = Instant::now();
    let err = run_with_events(&request(&format!("stubborn:{}", pidfile.display()), ProviderId::Codex, 500), |_| {}).unwrap_err();
    assert!(err.contains("timed out"), "{err}");
    assert!(started.elapsed() < Duration::from_secs(12), "o timeout travou esperando o SIGTERM ignorado");
    let pids = read_pids(&pidfile);
    assert!(wait_until(Duration::from_secs(3), || pids.iter().all(|p| !alive(*p))), "processo teimoso sobrou: {pids:?}");
}

#[test]
fn cancelar_o_orquestrador_mata_o_provedor() {
    fake_bin_dir();
    let pidfile = std::env::temp_dir().join(format!("devflow-orch-cancel-{}.pid", std::process::id()));
    let _ = fs::remove_file(&pidfile);
    let mut child = Command::new(env!("CARGO_BIN_EXE_devflow-orchestrator"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let payload = serde_json::json!({
        "operation": "run", "request": format!("sleep:{}", pidfile.display()), "provider": "claude",
        "cwd": std::env::temp_dir(), "timeout_ms": 60_000
    });
    writeln!(child.stdin.as_mut().unwrap(), "{payload}").unwrap();
    child.stdin.take(); // EOF, como o serviço do Electron faz
    assert!(wait_until(Duration::from_secs(10), || read_pids(&pidfile).len() == 2), "o provedor falso não subiu");
    let pids = read_pids(&pidfile);
    unsafe { libc::kill(child.id() as i32, libc::SIGTERM) };
    let _ = child.wait();
    assert!(wait_until(Duration::from_secs(5), || pids.iter().all(|p| !alive(*p))), "o provedor ficou órfão: {pids:?}");
}
