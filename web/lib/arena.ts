"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArenaEvent, ArenaState, LaneId, RoundRecord } from "./types";

export const ARENA_URL = process.env.NEXT_PUBLIC_ARENA_URL ?? "http://localhost:8787";

function wsUrl(): string {
  return ARENA_URL.replace(/^http/, "ws") + "/events";
}

async function post(path: string): Promise<void> {
  try {
    await fetch(`${ARENA_URL}${path}`, { method: "POST" });
  } catch {
    /* surfaced via connection state */
  }
}

export interface ArenaHandle {
  connected: boolean;
  state: ArenaState | null;
  lastRound: Partial<Record<LaneId, RoundRecord>>;
  runningLane: LaneId | null;
  fireLane: (lane: LaneId) => void;
  fireAll: () => void;
  setAuto: (on: boolean) => void;
}

/** Subscribes to the arena WS feed, keeps the latest snapshot + latest round per lane. */
export function useArena(): ArenaHandle {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<ArenaState | null>(null);
  const [lastRound, setLastRound] = useState<Partial<Record<LaneId, RoundRecord>>>({});
  const [runningLane, setRunningLane] = useState<LaneId | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
          // Seed latest round per lane from the snapshot on first load.
          setLastRound((prev) => {
            const next = { ...prev };
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

  const fireLane = useCallback((lane: LaneId) => void post(`/round/${lane}`), []);
  const fireAll = useCallback(() => void post("/round"), []);
  const setAuto = useCallback((on: boolean) => void post(on ? "/auto/start" : "/auto/stop"), []);

  return { connected, state, lastRound, runningLane, fireLane, fireAll, setAuto };
}
