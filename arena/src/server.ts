import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { Engine } from "./engine.js";

/** Build the arena API. Exported separately so route behavior can be tested without a port. */
export async function buildServer(engine: Engine) {
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
  app.post("/round", async (_req, reply) => {
    if (!engine.canRunManual) {
      const error = engine.budgetExhausted ? "budget exhausted" : "arena busy";
      return reply.code(409).send({ accepted: false, error, state: engine.state() });
    }
    void engine.runAll();
    return reply.code(202).send({ accepted: true, state: engine.state() });
  });

  return app;
}

/** Fastify server exposing the arena to the frontend: REST snapshot + WS live feed. */
export async function startServer(engine: Engine, port: number): Promise<void> {
  const app = await buildServer(engine);

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      throw new Error(
        `arena port ${port} is already in use; stop the existing arena or set ARENA_PORT to another port`,
      );
    }
    throw err;
  }
  console.log(`\nArena API on http://localhost:${port}`);
  console.log(`  GET  /state          snapshot`);
  console.log(`  WS   /events         live feed`);
  console.log(`  POST /round          run one explicit three-lane experiment`);
}
