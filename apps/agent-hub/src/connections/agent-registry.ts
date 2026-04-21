import { type AgentConfig } from '../config';
import { createChildLogger } from '../logger';
import { ManagedConnection } from './managed-connection';
import type { ConnectionState } from './reconnect';

export interface AgentStatus {
  id: string;
  url: string;
  state: ConnectionState;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  agents: Record<string, ConnectionState>;
}

export class AgentRegistry {
  private connections = new Map<string, ManagedConnection>();
  private states = new Map<string, ConnectionState>();
  private log = createChildLogger({ component: 'agent-registry' });

  constructor(
    private readonly agents: readonly AgentConfig[],
    private readonly pingIntervalMs: number,
    private readonly pongTimeoutMs: number,
    private readonly onMessage: (agentId: string, data: unknown) => void,
  ) {
    for (const agent of agents) {
      this.states.set(agent.id, 'closed');
    }
  }

  connectAll(): void {
    for (const agent of this.agents) {
      const conn = new ManagedConnection({
        agentId: agent.id,
        url: agent.url,
        pingIntervalMs: this.pingIntervalMs,
        pongTimeoutMs: this.pongTimeoutMs,
        onMessage: this.onMessage,
        onStateChange: (agentId, state) => {
          this.states.set(agentId, state);
          this.log.info({ agentId, state }, 'Agent connection state changed');
        },
      });
      this.connections.set(agent.id, conn);
      conn.connect();
    }
  }

  send(agentId: string, message: object): void {
    const conn = this.connections.get(agentId);
    if (!conn) {
      this.log.warn({ agentId }, 'No connection found for agent');
      return;
    }
    conn.send(message);
  }

  getStatus(): AgentStatus[] {
    return this.agents.map((agent) => ({
      id: agent.id,
      url: agent.url,
      state: this.states.get(agent.id) ?? 'closed',
    }));
  }

  getHealthStatus(): HealthStatus {
    const agents: Record<string, ConnectionState> = {};
    let allConnected = true;
    for (const agent of this.agents) {
      const state = this.states.get(agent.id) ?? 'closed';
      agents[agent.id] = state;
      if (state !== 'connected') {
        allConnected = false;
      }
    }
    return {
      status: allConnected ? 'ok' : 'degraded',
      agents,
    };
  }

  closeAll(): void {
    for (const [agentId, conn] of this.connections) {
      this.log.info({ agentId }, 'Closing agent connection');
      conn.close();
    }
  }
}
