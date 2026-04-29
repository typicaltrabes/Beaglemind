import { spawn } from 'node:child_process';
import { createChildLogger } from '../logger';

const log = createChildLogger({ component: 'persona-loader' });

// Where each agent's SOUL.md lives. The agent-hub container has SSH keys
// mounted to reach both hosts (per Phase 17 deploy notes).
const PERSONA_PATHS: Record<string, { sshHost: string; remotePath: string; needsSudo: boolean }> = {
  mo: {
    sshHost: 'lucas@46.225.56.122',
    remotePath: '/home/mo/workspace/SOUL.md',
    needsSudo: true, // file owned mo:mo, lucas reads via sudo
  },
  jarvis: {
    sshHost: 'root@142.93.76.133',
    remotePath: '/root/.openclaw/workspace/SOUL.md',
    needsSudo: false,
  },
};

interface CacheEntry {
  content: string;
  loadedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes — SOUL.md doesn't change often

export async function getPersona(agentId: string): Promise<string | null> {
  const cfg = PERSONA_PATHS[agentId];
  if (!cfg) return null;

  const cached = cache.get(agentId);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) {
    return cached.content;
  }

  return new Promise<string | null>((resolve) => {
    const remoteCmd = cfg.needsSudo ? `sudo cat ${cfg.remotePath}` : `cat ${cfg.remotePath}`;
    const proc = spawn(
      'ssh',
      ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=5', cfg.sshHost, remoteCmd],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => {
      stdout += c.toString();
    });
    proc.stderr.on('data', (c) => {
      stderr += c.toString();
    });

    proc.on('error', (err) => {
      log.error({ agentId, error: err.message }, 'Persona load spawn error');
      resolve(null);
    });

    proc.on('close', (code) => {
      if (code !== 0 || !stdout) {
        log.error(
          { agentId, code, stderrTail: stderr.slice(-200) },
          'Persona load failed',
        );
        resolve(null);
        return;
      }
      cache.set(agentId, { content: stdout, loadedAt: Date.now() });
      log.info({ agentId, length: stdout.length }, 'Persona loaded');
      resolve(stdout);
    });
  });
}

export function clearPersonaCache() {
  cache.clear();
}
