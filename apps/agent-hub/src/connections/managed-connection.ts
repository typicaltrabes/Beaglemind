import WebSocket from 'ws';
import { createChildLogger } from '../logger';
import { calculateBackoff, type ConnectionState } from './reconnect';

const MAX_OUTBOUND_QUEUE = 100;

export interface ManagedConnectionConfig {
  agentId: string;
  url: string;
  pingIntervalMs: number;
  pongTimeoutMs: number;
  onMessage: (agentId: string, data: unknown) => void;
  onStateChange: (agentId: string, state: ConnectionState) => void;
}

export class ManagedConnection {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'closed';
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private outboundQueue: string[] = [];
  private log;

  constructor(private readonly cfg: ManagedConnectionConfig) {
    this.log = createChildLogger({ agentId: cfg.agentId });
  }

  connect(): void {
    this.setState('connecting');
    this.log.info({ url: this.cfg.url }, 'Connecting to agent');

    const ws = new WebSocket(this.cfg.url);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.startPingPong();
      this.log.info('Connected to agent');
      this.flushQueue();
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg: unknown = JSON.parse(raw.toString());
        this.cfg.onMessage(this.cfg.agentId, msg);
      } catch (err) {
        this.log.warn({ err }, 'Failed to parse inbound message, dropping');
      }
    });

    ws.on('pong', () => {
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.log.info({ code, reason: reason.toString() }, 'Connection closed');
      this.stopPingPong();
      if (this.state === 'disconnecting') {
        this.setState('closed');
        return;
      }
      this.setState('reconnecting');
      this.scheduleReconnect();
    });

    ws.on('error', (err: Error) => {
      // Log only -- ws emits 'close' after 'error' (Pitfall 1: no reconnect here)
      this.log.error({ err: err.message }, 'WebSocket error');
    });
  }

  send(message: object): void {
    const data = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return;
    }

    // Queue during reconnection, cap at MAX_OUTBOUND_QUEUE (Pitfall 3)
    if (this.outboundQueue.length >= MAX_OUTBOUND_QUEUE) {
      this.log.warn('Outbound queue full, dropping oldest message');
      this.outboundQueue.shift();
    }
    this.outboundQueue.push(data);
  }

  close(): void {
    this.setState('disconnecting');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingPong();
    if (this.ws) {
      this.ws.close(1000, 'Graceful shutdown');
    } else {
      this.setState('closed');
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.cfg.onStateChange(this.cfg.agentId, state);
  }

  private startPingPong(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.pongTimer = setTimeout(() => {
          this.log.warn('Pong timeout, terminating connection');
          this.ws?.terminate();
        }, this.cfg.pongTimeoutMs);
      }
    }, this.cfg.pingIntervalMs);
  }

  private stopPingPong(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = calculateBackoff(this.reconnectAttempt);
    this.log.info({ attempt: this.reconnectAttempt, delayMs: delay }, 'Scheduling reconnect');
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private flushQueue(): void {
    while (this.outboundQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const data = this.outboundQueue.shift()!;
      this.ws.send(data);
    }
  }
}
