# @reservoir/keeper

A gas-aware keeper daemon for Reservoir. Config-driven — run a keeper without writing code.

## Commands

```bash
# Read-only: poll eligibility + current claim holders for the configured tasks
pnpm --filter @reservoir/keeper dev simulate --config keeper.example.yml

# Run the daemon: claim (tight gas) → execute → settle, with safety limits
pnpm --filter @reservoir/keeper dev run --config keeper.example.yml [--dry-run]

# Demo: four keeper bots race one liquidation on local anvil
pnpm --filter @reservoir/keeper dev race [--rpc <url>] [--chain <id>]
```

## The race demo (the product in one screen)

With `anvil` running and the contracts deployed
(`forge script contracts/script/Deploy.s.sol --broadcast`):

```
pnpm --filter @reservoir/keeper dev race
```

Four bots compete through the **cheap claim** instead of the expensive liquidation. One wins
and executes; three stand down after paying only their tight declared claim limit. The summary
reports declared-limit exposure (what Monad bills) for the naive race vs the coordinated race,
plus the useful-work ratio.

## Config

See [`keeper.example.yml`](./keeper.example.yml). Key points:

- **`claimGasLimit`** must be tight (~130k). On Monad you pay the gas limit you *declare*, so a
  padded claim reintroduces the exact waste this project removes.
- **`safety`** is default-safe: `onlyVerifiedTasks`, a per-claim bond cap, a daily exposure hard
  stop, a max tolerated task slash rate, and `requireStableEligible`. Opt into risk consciously.
- **`account`** supports `${ENV_VAR}` — keep real keys in `.env`, never in the YAML.

## How it works

1. Poll `coordinator.isEligible(taskId, subject)` for each configured subject.
2. **Stand down** if a live rival already holds the claim — this is the coordination working.
3. Check safety limits, then race `executor.reserve(...)` with a tight declared gas limit.
4. On winning, `executor.perform(...)` runs the real work while the claim is still active, then
   settles via `consume` to reclaim the bond (and any bounty).
