import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hex } from "viem";
import { Engine } from "./engine.js";
import { buildServer } from "./server.js";
import type { LaneId, RoundRecord, TxRecord } from "./types.js";
import type { Arena } from "./world.js";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const HASH = `0x${"1".repeat(64)}` as Hex;
const LANES: LaneId[] = ["liquidation", "arb", "cron"];

function fakeArena(): Arena {
  const lanes = Object.fromEntries(
    LANES.map((id) => [
      id,
      {
        id,
        label: id,
        subject: HASH,
        taskId: HASH,
        naiveTarget: ZERO,
        coordTarget: ZERO,
        executors: [ZERO, ZERO, ZERO, ZERO],
      },
    ]),
  );
  return {
    cfg: { chainId: 31337, budgetCapWei: 1_000_000n } as Arena["cfg"],
    world: { chainId: 31337, coordinator: ZERO, bots: [ZERO, ZERO, ZERO, ZERO], lanes } as Arena["world"],
    deployer: { publicClient: { getGasPrice: async () => 1n } } as unknown as Arena["deployer"],
    botClients: [],
  };
}

function tx(side: TxRecord["side"], role: TxRecord["role"], botIndex: number, success: boolean): TxRecord {
  return {
    side,
    role,
    botIndex,
    hash: HASH,
    from: ZERO,
    gasLimit: "1",
    gasUsed: "1",
    gasBilledWei: "1",
    gasPriceWei: "1",
    success,
    explorerUrl: "",
  };
}

function round(lane: LaneId, id: number): RoundRecord {
  return {
    id,
    lane,
    laneLabel: lane,
    ts: Date.now(),
    naive: {
      txs: [tx("naive", lane === "cron" ? "harvest" : lane === "arb" ? "arb" : "liquidate", 0, true)],
      declaredWei: "4",
      gasReserved: "4",
      winnerBot: 0,
    },
    coordinated: {
      txs: [tx("coordinated", "claim", 0, true), tx("coordinated", "execute", 0, true)],
      declaredWei: "2",
      gasReserved: "2",
      winnerBot: 0,
    },
    savingsPct: 50,
  };
}

const prepare = async () => {};

test("the arena stays idle until an experiment is explicitly requested", async () => {
  let calls = 0;
  let preparations = 0;
  const engine = new Engine(
    fakeArena(),
    async (_arena, lane, id) => {
      calls += 1;
      return round(lane, id);
    },
    async () => {
      preparations += 1;
    },
  );
  await engine.init();

  assert.equal(calls, 0);
  assert.equal(preparations, 0);
  assert.equal(engine.state().overall.rounds, 0);
  assert.equal(engine.state().busy, false);
});

test("one explicit request runs three lanes sequentially and rejects overlap", async () => {
  const calls: LaneId[] = [];
  let preparations = 0;
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const engine = new Engine(
    fakeArena(),
    async (_arena, lane, id) => {
      calls.push(lane);
      if (calls.length === 1) await firstGate;
      return round(lane, id);
    },
    async () => {
      preparations += 1;
    },
  );
  await engine.init();

  const running = engine.runAll();
  await Promise.resolve();
  assert.equal(engine.state().busy, true);
  assert.equal(await engine.runAll(), false);

  releaseFirst();
  assert.equal(await running, true);
  assert.deepEqual(calls, LANES);
  assert.equal(preparations, 1);
  assert.equal(engine.state().overall.rounds, 3);
  assert.equal(engine.state().busy, false);
});

test("setup failures are reported without running or recording a lane", async () => {
  let calls = 0;
  const messages: string[] = [];
  const engine = new Engine(
    fakeArena(),
    async (_arena, lane, id) => {
      calls += 1;
      return round(lane, id);
    },
    async () => {
      throw new Error("operator validation unavailable");
    },
  );
  await engine.init();
  engine.subscribe((event) => {
    if (event.type === "error") messages.push(event.message);
  });

  assert.equal(await engine.runAll(), false);
  assert.equal(calls, 0);
  assert.equal(engine.state().overall.rounds, 0);
  assert.match(messages[0] ?? "", /experiment setup failed: operator validation unavailable/);
});

test("the API exposes only the explicit full-experiment trigger", async () => {
  let releaseFirst!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  const engine = new Engine(
    fakeArena(),
    async (_arena, lane, id) => {
      calls += 1;
      if (calls === 1) await gate;
      return round(lane, id);
    },
    prepare,
  );
  await engine.init();
  const app = await buildServer(engine);

  assert.equal((await app.inject({ method: "GET", url: "/state" })).statusCode, 200);
  assert.equal(calls, 0);
  assert.equal((await app.inject({ method: "POST", url: "/auto/start" })).statusCode, 404);
  assert.equal((await app.inject({ method: "POST", url: "/round" })).statusCode, 202);
  assert.equal((await app.inject({ method: "POST", url: "/round" })).statusCode, 409);

  releaseFirst();
  while (engine.busy) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 3);
  await app.close();
});
