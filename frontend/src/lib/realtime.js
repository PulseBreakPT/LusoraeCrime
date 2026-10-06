import { API, getToken } from "./api";

const DEFAULT_CHANNELS = ["world", "city", "chat", "pvp", "alliance"];

export const realtimeUrl = () => {
  if (typeof window === "undefined") return "";
  const token = getToken();
  if (!token) return "";

  const base = new URL(API || "/api", window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}/realtime/ws`;
  base.search = "";
  base.searchParams.set("token", token);
  return base.toString();
};

export class SubmundoRealtime extends EventTarget {
  constructor({ channels = DEFAULT_CHANNELS } = {}) {
    super();
    this.channels = [...new Set(channels)];
    this.socket = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.closedByClient = false;
    this.attempt = 0;
  }

  connect() {
    const url = realtimeUrl();
    if (!url || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.closedByClient = false;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.dispatchEvent(new CustomEvent("status", { detail: { connected: true } }));
      this.send({ type: "subscribe", channels: this.channels });
      this._startHeartbeat();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.dispatchEvent(new CustomEvent("event", { detail: payload }));
        if (payload?.type) {
          this.dispatchEvent(new CustomEvent(payload.type, { detail: payload }));
        }
      } catch (_error) {
        // Ignore malformed frames instead of taking the game UI down.
      }
    };

    socket.onerror = () => {
      this.dispatchEvent(new CustomEvent("status", { detail: { connected: false, degraded: true } }));
    };

    socket.onclose = () => {
      this._stopHeartbeat();
      this.socket = null;
      this.dispatchEvent(new CustomEvent("status", { detail: { connected: false } }));
      if (!this.closedByClient) this._scheduleReconnect();
    };
  }

  disconnect() {
    this.closedByClient = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this._stopHeartbeat();
    if (this.socket) {
      this.socket.close(1000, "client disconnect");
      this.socket = null;
    }
  }

  subscribe(channels) {
    this.channels = [...new Set((channels || []).filter(Boolean))];
    this.send({ type: "subscribe", channels: this.channels });
  }

  send(payload) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  _scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(30000, 1000 * (2 ** Math.min(this.attempt, 5)));
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.send({ type: "ping" }), 25000);
  }

  _stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}

export const realtime = new SubmundoRealtime();
