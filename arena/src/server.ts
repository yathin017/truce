import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { Engine } from "./engine.js";
import type { LaneId } from "./types.js";

const LANES: LaneId[] = ["liquidation", "arb", "cron"];

/** Fastify server exposing the arena to the frontend: REST snapshot + WS live feed. */
export async function startServer(engine: Engine, port: number): Promise<void> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const clients = new Set<WebSocket>();
  engine.subscribe((event) => {
    const msg = JSON.stringify(event);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  });

  app.get("/health", async () => ({ ok: true }));

  // Full snapshot for page load.
  app.get("/state", async () => engine.state());

  // Live feed. On connect, push the current snapshot, then stream events.
  app.get("/events", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "state", state: engine.state() }));
    socket.on("close", () => clients.delete(socket));
  });

  // Fire one full round (all three lanes).
  app.post("/round", async () => {
    void engine.runAll();
    return { accepted: true };
  });

  // Fire one lane round.
  app.post<{ Params: { lane: string } }>("/round/:lane", async (req, reply) => {
    const lane = req.params.lane as LaneId;
    if (!LANES.includes(lane)) return reply.code(400).send({ error: "unknown lane" });
    void engine.runLane(lane);
    return { accepted: true, lane };
  });

  // Auto-loop controls.
  app.post("/auto/start", async () => {
    engine.startAuto();
    return { running: true };
  });
  app.post("/auto/stop", async () => {
    engine.stopAuto();
    return { running: false };
  });

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`\nArena API on http://localhost:${port}`);
  console.log(`  GET  /state          snapshot`);
  console.log(`  WS   /events         live feed`);
  console.log(`  POST /round          fire all lanes`);
  console.log(`  POST /round/:lane    fire one lane (liquidation|arb|cron)`);
  console.log(`  POST /auto/start|stop`);
}
