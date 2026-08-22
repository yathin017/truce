"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArenaEvent, ArenaState, LaneId, RoundRecord } from "./types";

export const ARENA_URL = process.env.NEXT_PUBLIC_ARENA_URL ?? "http://localhost:8787";

function wsUrl(): string {
  return ARENA_URL.replace(/^http/, "ws") + "/events";
}

interface CommandResponse {
  state?: ArenaState;
  error?: string;
}

async function post(path: string): Promise<CommandResponse> {
  const response = await fetch(`${ARENA_URL}${path}`, { method: "POST" });
  const result = (await response.json().catch(() => ({}))) as CommandResponse;
  if (!response.ok) throw new Error(result.error ?? `arena request failed (${response.status})`);
  return result;
}

export interface ArenaHandle {
  connected: boolean;
  state: ArenaState | null;
  lastRound: Partial<Record<LaneId, RoundRecord>>;
  runningLane: LaneId | null;
  commandPending: boolean;
  commandError: string | null;
  fireAll: () => void;
}

/** Subscribes to the arena WS feed, keeps the latest snapshot + latest round per lane. */
export function useArena(): ArenaHandle {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<ArenaState | null>(null);
  const [lastRound, setLastRound] = useState<Partial<Record<LaneId, RoundRecord>>>({});
  const [runningLane, setRunningLane] = useState<LaneId | null>(null);
  const [commandPending, setCommandPending] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const commandPendingRef = useRef(false);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (closed) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl());
      } catch {
        retry = setTimeout(connect, 2000);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setRunningLane(null);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        let msg: ArenaEvent;
        try {
          msg = JSON.parse(ev.data as string) as ArenaEvent;
        } catch {
          return;
        }
        if (msg.type === "state") {
          setState(msg.state);
          setRunningLane(msg.state.runningLane);
          // Rebuild from the authoritative snapshot so reconnects cannot preserve stale rounds.
          setLastRound(() => {
            const next: Partial<Record<LaneId, RoundRecord>> = {};
            for (const r of msg.state.recentRounds) {
              if (!next[r.lane]) next[r.lane] = r;
            }
            return next;
          });
        } else if (msg.type === "roundStart") {
          setRunningLane(msg.lane);
        } else if (msg.type === "round") {
          setRunningLane(null);
          setLastRound((prev) => ({ ...prev, [msg.round.lane]: msg.round }));
        } else if (msg.type === "error") {
          setRunningLane((current) => (!msg.lane || current === msg.lane ? null : current));
          setCommandError(msg.message);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const fireAll = useCallback(() => {
    if (commandPendingRef.current) return;
    commandPendingRef.current = true;
    setCommandPending(true);
    setCommandError(null);
    void post("/round")
      .then((result) => {
        if (result.state) setState(result.state);
      })
      .catch((err: unknown) => setCommandError((err as Error).message))
      .finally(() => {
        commandPendingRef.current = false;
        setCommandPending(false);
      });
  }, []);

  return { connected, state, lastRound, runningLane, commandPending, commandError, fireAll };
}
