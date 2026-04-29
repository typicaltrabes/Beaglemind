import { spawn } from 'node:child_process';
import { createChildLogger } from '../logger';

const log = createChildLogger({ component: 'openclaw-cli-bridge' });

export interface OpenClawBridgeConfig {
  agentId: string;
  sshHost: string;
  runId: string;
  sudoUser?: string;
}

// Remote bash script — single-quoted as the bash -c arg, contains no single
// quotes by design. Reads the user's message from stdin (via $(cat)) so the
// content never touches shell escaping. Phase 17.1 gap-fix: the prior version
// inlined the message into the SSH command and broke on apostrophes/newlines
// once attachment blocks pushed the prompt past trivial size.
const REMOTE_SCRIPT = `set -eu
MSG=$(cat)
exec timeout 120 \${OC_SUDO_USER:+sudo -u $OC_SUDO_USER} openclaw agent --message "$MSG" --session-id "$OC_SESSION_ID" --agent main --json`;

function buildRemoteCommand(sudoUser: string, sessionId: string): string {
  // sudoUser is one of 'mo'|'sam'|'herman'|'' — known safe identifiers.
  // sessionId is `console:<agentId>:<uuid>` — alphanumeric + hyphens + colons.
  // Neither can contain quotes; we still validate to be defensive.
  if (!/^[a-z0-9_-]*$/.test(sudoUser)) {
    throw new Error(`Invalid sudoUser: ${sudoUser}`);
  }
  if (!/^[a-zA-Z0-9:_-]+$/.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${sessionId}`);
  }
  // Use bash -c '<script>'. The script has no single quotes inside, so the
  // outer single-quoting is safe. Env vars passed inline before bash so they
  // populate the bash -c subshell environment.
  return `OC_SUDO_USER=${sudoUser} OC_SESSION_ID=${sessionId} bash -c '${REMOTE_SCRIPT}'`;
}

export async function sendToAgent(
  cfg: OpenClawBridgeConfig,
  message: string,
): Promise<{
  text: string;
  runId: string;
  durationMs: number;
  costUsd: number;
  model: string;
} | null> {
  const sessionId = `console:${cfg.agentId}:${cfg.runId}`;
  const remoteCmd = buildRemoteCommand(cfg.sudoUser ?? '', sessionId);

  log.info(
    { agentId: cfg.agentId, messageLength: message.length },
    'Sending message to agent via CLI bridge',
  );

  return new Promise((resolve) => {
    const proc = spawn(
      'ssh',
      ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=5', cfg.sshHost, remoteCmd],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';
    const killer = setTimeout(() => {
      log.error({ agentId: cfg.agentId }, 'CLI bridge hard-timeout (130s) — killing ssh');
      proc.kill('SIGKILL');
    }, 130_000);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(killer);
      log.error({ agentId: cfg.agentId, error: err.message }, 'CLI bridge spawn error');
      resolve(null);
    });

    proc.on('close', (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        log.error(
          { agentId: cfg.agentId, code, stderrTail: stderr.slice(-400) },
          'CLI bridge non-zero exit',
        );
        resolve(null);
        return;
      }

      try {
        const jsonStart = stdout.indexOf('\n{');
        const jsonStr = jsonStart >= 0 ? stdout.substring(jsonStart + 1) : stdout.trim();

        let result: any;
        try {
          result = JSON.parse(jsonStr);
        } catch {
          const firstBrace = stdout.indexOf('{');
          const lastBrace = stdout.lastIndexOf('}');
          if (firstBrace >= 0 && lastBrace > firstBrace) {
            result = JSON.parse(stdout.substring(firstBrace, lastBrace + 1));
          } else {
            log.error(
              { agentId: cfg.agentId, stdout: stdout.substring(0, 300) },
              'No parseable JSON in agent response',
            );
            resolve(null);
            return;
          }
        }

        if (result.status !== 'ok') {
          log.error({ agentId: cfg.agentId, status: result.status }, 'Agent returned non-ok status');
          resolve(null);
          return;
        }

        const text = result.result?.payloads?.[0]?.text ?? '';
        const runId = result.runId ?? '';
        const durationMs = result.result?.meta?.durationMs ?? 0;
        const usage = result.result?.meta?.agentMeta?.usage;
        const model = result.result?.meta?.agentMeta?.model ?? 'unknown';

        let costUsd = 0;
        if (usage) {
          const inputTokens = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
          const outputTokens = usage.output ?? 0;
          costUsd = (inputTokens * 15 + outputTokens * 75) / 1_000_000;
        }

        log.info(
          { agentId: cfg.agentId, responseLength: text.length, durationMs, costUsd: costUsd.toFixed(4) },
          'Agent responded',
        );
        resolve({ text, runId, durationMs, costUsd, model });
      } catch (err: any) {
        log.error({ agentId: cfg.agentId, error: err.message }, 'CLI bridge parse error');
        resolve(null);
      }
    });

    proc.stdin.write(message);
    proc.stdin.end();
  });
}
