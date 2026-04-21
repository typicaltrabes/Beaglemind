import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createChildLogger } from '../logger';

const execAsync = promisify(exec);
const log = createChildLogger({ component: 'openclaw-cli-bridge' });

export interface OpenClawBridgeConfig {
  agentId: string;
  sshHost: string;
  sessionId: string;
}

export async function sendToAgent(
  cfg: OpenClawBridgeConfig,
  message: string,
): Promise<{ text: string; runId: string; durationMs: number } | null> {
  const escapedMessage = message.replace(/'/g, "'\\''");
  const cmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${cfg.sshHost} "timeout 120 openclaw agent --message '${escapedMessage}' --session-id '${cfg.sessionId}' --agent main --json 2>/dev/null"`;
  
  log.info({ agentId: cfg.agentId, messageLength: message.length }, 'Sending message to agent via CLI bridge');

  try {
    const { stdout } = await execAsync(cmd, { timeout: 130000 });
    
    // Parse the JSON response — skip any plugin log lines
    const lines = stdout.split('\n');
    const jsonLine = lines.find(l => l.trim().startsWith('{'));
    if (!jsonLine) {
      log.error({ agentId: cfg.agentId, stdout: stdout.substring(0, 200) }, 'No JSON response from agent');
      return null;
    }

    const result = JSON.parse(jsonLine);
    if (result.status !== 'ok') {
      log.error({ agentId: cfg.agentId, status: result.status }, 'Agent returned non-ok status');
      return null;
    }

    const text = result.result?.payloads?.[0]?.text ?? '';
    const runId = result.runId ?? '';
    const durationMs = result.result?.meta?.durationMs ?? 0;

    log.info({ agentId: cfg.agentId, responseLength: text.length, durationMs }, 'Agent responded');
    return { text, runId, durationMs };
  } catch (err: any) {
    log.error({ agentId: cfg.agentId, error: err.message }, 'CLI bridge error');
    return null;
  }
}
