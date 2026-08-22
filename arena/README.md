# @truce/arena

A live demo engine: one explicit experiment executes the same opportunity **naively** (directly,
the world today) and **via Truce** (cheap claim → winner executes), side by side, so the
frontend can show real-time gas savings with real on-chain tx hashes.

Three use cases run on one coordinator — **liquidation**, **DEX arbitrage**, **cron/harvest** —
proving the coordinator is protocol-agnostic. Each round the "protocol" refills the opportunity
(re-drops the price / pushes the pool off-peg / marks the job due) and the bots race again.

## Verified on Monad testnet (chainId 10143)

This arena deployment is separate from the canonical protocol deployment in the root README. Every
transaction is real and visible on the [explorer](https://testnet.monadexplorer.com). The addresses
below are persisted in [`deployments/arena-10143.json`](./deployments/arena-10143.json) and are the
same ones printed by the arena at startup:

| lane / contract | naive target | coordinated target | taskId |
| --- | --- | --- | --- |
| **Arena coordinator** | — | [`0xb26381d4a04d85f06d06d8f66548ddd502c323e4`](https://testnet.monadexplorer.com/address/0xb26381d4a04d85f06d06d8f66548ddd502c323e4) | — |
| Aave liquidation | [`0xf3951119d5bce0db6943aa54f7008f6b03833408`](https://testnet.monadexplorer.com/address/0xf3951119d5bce0db6943aa54f7008f6b03833408) | [`0xac06ac357611a31374fa64547a16f8bf39f683f8`](https://testnet.monadexplorer.com/address/0xac06ac357611a31374fa64547a16f8bf39f683f8) | `0xf071b95067db0ab08fb1c0615b2d6af5e09cae13229cab17dffcd199832622ad` |
| DEX arbitrage | [`0x2301a1a79a4963a33302bbd06e93953f186228ed`](https://testnet.monadexplorer.com/address/0x2301a1a79a4963a33302bbd06e93953f186228ed) | [`0xcdcc2024d7770225354bc6524d84a261c298e462`](https://testnet.monadexplorer.com/address/0xcdcc2024d7770225354bc6524d84a261c298e462) | `0x31ee07a18bcf8ff29b363014068130e903b1d17f23b9fcc9671a623b0a2ea3d2` |
| Cron / harvest | [`0xf0d3bd99b4434fcfe7f3fd29dcc811e5e697c64f`](https://testnet.monadexplorer.com/address/0xf0d3bd99b4434fcfe7f3fd29dcc811e5e697c64f) | [`0xeb819ad76070fdaa54de37df5b3d5b17088e1b0b`](https://testnet.monadexplorer.com/address/0xeb819ad76070fdaa54de37df5b3d5b17088e1b0b) | `0x7909c9b048705f29a179791a1c3d381a0177bfd34419c9f8526231b81f70a1b9` |

Example cron round (102 gwei):

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
pnpm --filter @truce/arena serve --chain 31337          # API on :8787

# Monad testnet (real tx hashes; needs a funded DEPLOYER_PRIVATE_KEY, arena funds the 4 bots)
pnpm --filter @truce/arena serve --chain 10143

# one-shot (bootstrap + one round per lane, print, exit)
pnpm --filter @truce/arena dev round --chain 31337
```

Bootstrap deploys a fresh world and writes `arena/deployments/arena-<chainId>.json` (reused on
restart). On non-anvil chains the arena uses 4 bot accounts from `ARENA_MNEMONIC`,
`KEEPER_PRIVATE_KEY_1..4`, or its gitignored generated-key file. Starting a service with a persisted
world does not fund accounts, repair executors, or run a round. Those transaction-producing steps
happen only after an explicit `POST /round` request from the experiment page. If the generated key
file changed, the first explicit experiment replaces only the keeper executors; the documented
coordinator, tasks, and lane targets remain unchanged.

## HTTP + WebSocket API (the frontend contract)

Base: `http://localhost:8787` (override with `ARENA_PORT`). CORS is open.

| method | path | purpose |
| --- | --- | --- |
| GET | `/health` | `{ ok: true }` |
| GET | `/state` | full snapshot (below) — call on page load |
| WS | `/events` | live feed; on connect it pushes one `state` event, then streams |
| POST | `/round` | run exactly one explicit experiment across **all three** lanes |

### `/state` snapshot

```jsonc
{
  "chainId": 10143,
  "coordinator": "0x…",
  "explorerBase": "https://testnet.monadexplorer.com",   // "" on anvil
  "gasPriceWei": "102000000000",
  "bots": ["0x…", "0x…", "0x…", "0x…"],
  "busy": false,
  "runningLane": null,
  "budget": { "capWei": "…", "spentWei": "…", "remainingWei": "…" },
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

- Header: fixed measured headline, gas price and budget remaining; it never submits transactions.
- Tabs per lane (liquidation / arb / cron). Each tab: two columns — *Without Truce* (naive)
  vs *With Truce* (coordinated) — streaming `TxRecord` rows with a ✓/✗ and a clickable
  `explorerUrl`. Losers on the naive side show `gasUsed` ≪ `gasBilledWei` — the killer reveal.
- A valid coordinated result contains one successful claim ✓, three losing claims ✗, and one
  successful execute ✓. A losing claim is expected; four losing claims are rejected as an invalid
  round and never included in the savings calculation.
- Cumulative burn bars from `cumulative*Wei`.
- The experiment page's **Run the experiment** button → one `POST /round` request.

## Config (env)

`ARENA_RPC`, `ARENA_PORT` (8787), `ARENA_BUDGET_MON` (15 on testnet), `ARENA_BOT_FUNDING`
(3 MON/bot), `ARENA_MNEMONIC` or `KEEPER_PRIVATE_KEY_1..4`,
`DEPLOYER_PRIVATE_KEY`.
