# @reservoir/arena

A live demo engine: bots continuously execute the same opportunity **naively** (directly, the
world today) and **via Reservoir** (cheap claim → winner executes), side by side, so the
frontend can show real-time gas savings with real on-chain tx hashes.

Three use cases run on one coordinator — **liquidation**, **DEX arbitrage**, **cron/harvest** —
proving the coordinator is protocol-agnostic. Each round the "protocol" refills the opportunity
(re-drops the price / pushes the pool off-peg / marks the job due) and the bots race again.

## Verified on Monad testnet (chainId 10143)

Coordinator `0xb26381d4a04d85f06d06d8f66548ddd502c323e4`. Every tx is real and on the
[explorer](https://testnet.monadexplorer.com). Example cron round (102 gwei):

| side | txs | declared/billed | mean savings |
| --- | --- | --- | --- |
| naive | 4 × harvest (1 ok, 3 revert) — **each billed 0.051 MON** | 0.204 MON | — |
| coordinated | 4 × claim (1 ok, 3 revert) + 1 execute | 0.1326 MON | **35%** |

The reveal: on Monad a *reverted* harvest that did nothing is billed the **full 500k declared
limit** (0.051 MON) — identical to the winner. `gasUsed == gasLimit == billed`. Losing the race
is as expensive as winning it, which is exactly what the cheap-claim path removes. (On anvil,
which bills gas *used*, the same demo shows ~49% because the claim path is even cheaper there.)

## Run

```bash
forge build --root contracts          # arena loads artifacts from contracts/out

# local anvil (free, instant)
anvil
pnpm --filter @reservoir/arena serve --chain 31337          # API on :8787
pnpm --filter @reservoir/arena serve --chain 31337 --auto   # + auto-loop

# Monad testnet (real tx hashes; needs a funded DEPLOYER_PRIVATE_KEY, arena funds the 4 bots)
pnpm --filter @reservoir/arena serve --chain 10143

# one-shot (bootstrap + one round per lane, print, exit)
pnpm --filter @reservoir/arena dev round --chain 31337
```

Bootstrap deploys a fresh world and writes `arena/deployments/arena-<chainId>.json` (reused on
restart). On non-anvil chains the deployer funds 4 bot accounts (from `ARENA_MNEMONIC`, or
`KEEPER_PRIVATE_KEY_1..4`).

## HTTP + WebSocket API (the frontend contract)

Base: `http://localhost:8787` (override with `ARENA_PORT`). CORS is open.

| method | path | purpose |
| --- | --- | --- |
| GET | `/health` | `{ ok: true }` |
| GET | `/state` | full snapshot (below) — call on page load |
| WS | `/events` | live feed; on connect it pushes one `state` event, then streams |
| POST | `/round` | fire one round of **all three** lanes |
| POST | `/round/:lane` | fire one lane (`liquidation` \| `arb` \| `cron`) |
| POST | `/auto/start` | start the capped auto-loop |
| POST | `/auto/stop` | stop the auto-loop |

### `/state` snapshot

```jsonc
{
  "chainId": 10143,
  "coordinator": "0x…",
  "explorerBase": "https://testnet.monadexplorer.com",   // "" on anvil
  "gasPriceWei": "102000000000",
  "bots": ["0x…", "0x…", "0x…", "0x…"],
  "budget": { "capWei": "…", "spentWei": "…", "remainingWei": "…" },
  "auto": { "running": false, "intervalMs": 10000 },
  "overall": { "rounds": 12, "meanSavingsPct": 41.7, "cumulativeNaiveWei": "…", "cumulativeCoordWei": "…" },
  "lanes": [
    { "id": "liquidation", "label": "Aave liquidation", "subject": "0x…", "taskId": "0x…",
      "naiveTarget": "0x…", "coordTarget": "0x…",
      "rounds": 4, "meanSavingsPct": 42.0, "cumulativeNaiveWei": "…", "cumulativeCoordWei": "…" },
    { "id": "arb", ... }, { "id": "cron", ... }
  ],
  "recentRounds": [ /* newest first, RoundRecord (below), up to 30 */ ]
}
```

### WS events

```jsonc
{ "type": "state",     "state": { /* ArenaState as above */ } }
{ "type": "roundStart","lane": "arb", "laneLabel": "DEX arbitrage", "ts": 1690000000000 }
{ "type": "round",     "round": { /* RoundRecord */ } }
{ "type": "budgetExhausted", "budget": { "capWei": "…", "spentWei": "…", "remainingWei": "…" } }
{ "type": "error",     "lane": "cron", "message": "…" }
```

### `RoundRecord`

```jsonc
{
  "id": 7, "lane": "liquidation", "laneLabel": "Aave liquidation", "ts": 1690000000000,
  "savingsPct": 42.3,
  "naive":       { "declaredWei": "…", "gasReserved": "2000000", "winnerBot": 0, "txs": [ /* TxRecord */ ] },
  "coordinated": { "declaredWei": "…", "gasReserved": "1300000", "winnerBot": 2, "txs": [ /* TxRecord */ ] }
}
```

### `TxRecord` (each row in the side-by-side columns)

```jsonc
{
  "side": "naive",            // "naive" | "coordinated"
  "role": "liquidate",        // liquidate | arb | harvest | claim | execute
  "botIndex": 0,
  "from": "0x…",
  "hash": "0x…",
  "explorerUrl": "https://testnet.monadexplorer.com/tx/0x…",   // clickable proof
  "gasLimit": "500000",       // declared — what Monad bills
  "gasUsed": "500000",        // receipt gasUsed (≈ limit on Monad reverts)
  "gasBilledWei": "…",        // gasLimit × price — the number that matters on Monad
  "gasPriceWei": "…",
  "success": true
}
```

## Suggested frontend layout

- Header: big **mean % saved** (`overall.meanSavingsPct`), gas price, budget remaining, auto toggle.
- Tabs per lane (liquidation / arb / cron). Each tab: two columns — *Without Reservoir* (naive)
  vs *With Reservoir* (coordinated) — streaming `TxRecord` rows with a ✓/✗ and a clickable
  `explorerUrl`. Losers on the naive side show `gasUsed` ≪ `gasBilledWei` — the killer reveal.
- Cumulative burn bars from `cumulative*Wei`.
- "Fire round" button → `POST /round`; "Auto" toggle → `/auto/start|stop`.

## Config (env)

`ARENA_RPC`, `ARENA_PORT` (8787), `ARENA_INTERVAL_MS` (10000), `ARENA_BUDGET_MON`
(15 on testnet), `ARENA_BOT_FUNDING` (3 MON/bot), `ARENA_MNEMONIC` or `KEEPER_PRIVATE_KEY_1..4`,
`DEPLOYER_PRIVATE_KEY`.
