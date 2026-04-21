import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createChildLogger } from '../logger';

const execAsync = promisify(exec);
const log = createChildLogger({ component: 'openclaw-cli-bridge' });

export interface OpenClawBridgeConfig {
  agentId: string;
  sshHost: string;
  sessionId: string;
  sudoUser?: string; // Run openclaw as this user (e.g. 'mo', 'sam') via sudo -u
}

export async function sendToAgent(
  cfg: OpenClawBridgeConfig,
  message: string,
): Promise<{ text: string; runId: string; durationMs: number } | null> {
  const escapedMessage = message.replace(/'/g, "'\\''");
  const openclawCmd = cfg.sudoUser
    ? `sudo -u ${cfg.sudoUser} openclaw agent --message '${escapedMessage}' --session-id '${cfg.sessionId}' --agent main --json 2>/dev/null`
    : `openclaw agent --message '${escapedMessage}' --session-id '${cfg.sessionId}' --agent main --json 2>/dev/null`;
  const cmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${cfg.sshHost} "timeout 120 ${openclawCmd}"`;
  
  log.info({ agentId: cfg.agentId, messageLength: message.length }, 'Sending message to agent via CLI bridge');

  try {
    const { stdout } = await execAsync(cmd, { timeout: 130000, maxBuffer: 10 * 1024 * 1024 });

    // Parse the JSON response — the output may have [plugins] log lines before the JSON
    // The JSON object is multi-line pretty-printed, so find the first '{' and take everything from there
    const jsonStart = stdout.indexOf('\n{');
    const jsonStr = jsonStart >= 0 ? stdout.substring(jsonStart + 1) : stdout.trim();

    log.debug({ agentId: cfg.agentId, rawLength: stdout.length, jsonStart }, 'Parsing CLI response');

    let result: any;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // Try finding JSON between first { and last }
      const firstBrace = stdout.indexOf('{');
      const lastBrace = stdout.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        result = JSON.parse(stdout.substring(firstBrace, lastBrace + 1));
      } else {
        log.error({ agentId: cfg.agentId, stdout: stdout.substring(0, 300) }, 'No parseable JSON in agent response');
        return null;
      }
    }
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
