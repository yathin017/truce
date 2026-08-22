# Reservoir

**A gas-aware keeper coordination layer for Monad.**
_Stake your claim before you spend your gas._

Built for the Monad hackathon. Repo/remote name is `truce`; the product is **Reservoir**.

---

## The problem (Monad-specific)

A Monad transaction is charged `value + gas_bid × gas_limit` — the **declared** gas limit,
not the gas actually used. This is deliberate: leaders propose blocks *before* executing them,
so gas must be accounted at proposal time (charging `gas_used` would be a DoS vector).

For keepers racing a liquidation (or any permissionless upkeep), this makes **losing a race
structurally expensive**:

- A keeper must declare a success-sized gas limit (~500k). Declaring less means running
  out of gas *if it wins* — so the padded limit is forced.
- When it **loses**, the tx reverts in the first few percent of execution — but it still pays
  for the full declared limit.
- The block builder **cannot** filter these reverts, because it proposes before executing.

Four keepers racing one opportunity → four ~500k charges to do one ~500k job, and ~2M gas of
**block capacity reserved** to perform ~200k of real work.

## The idea

Move contention off the expensive execution transaction and onto a cheap reservation.

**Reservoir** is a permissionless, protocol-agnostic **exclusivity registry**:

1. Anyone registers a **task** with an eligibility **predicate** (`isEligible(subject) → bool`).
2. Keepers race a cheap, bonded **`claim(taskId, subject)`** (~50k gas) instead of the
   expensive execution. Losers of *this* race pay ~50k, not ~500k, and stand down.
3. The winner's own executor calls **`consume(...)`** as its first line, then does the real work.
4. If the winner vanishes, anyone can **`resolve`** after a short window: predicate still true →
   bond **slashed**; predicate now false (opportunity legitimately evaporated) → bond **returned**.

The coordinator **executes nothing and custodies nothing but bonds**. It verifies that *the world
changed* (the predicate flipped), never that any specific work was done — which is exactly what
lets one contract serve liquidations, DEX arbitrage, and cron/harvest alike.

## Honest scope

- This is **keeper-side coordination**, not protocol-enforced exclusivity. In voluntary mode a
  keeper can ignore the registry. Enforcement is a one-line integration in the protocol's entry
  point (`require(coordinator.holder(...) == msg.sender)`), demonstrated by `EnforcedMockPool`.
- Complementary to Chainlink SVR: SVR recaptures oracle value from the *winning* liquidation;
  Reservoir eliminates wasted gas from the *losing* attempts.

## Monorepo layout

```
contracts/        Foundry — Coordinator, predicates, executors, mocks (standalone)
keeper/           TypeScript keeper daemon (config-driven)
experiment/       Run A (naive race) vs Run B (coordinated) gas experiment
web/              Next.js console (Phase B)
packages/shared/  viem chains, synced ABIs, gas/HF math
```

## Quickstart

```bash
pnpm install                       # JS workspaces
forge build --root contracts       # contracts
forge test  --root contracts -vvv  # contract tests

# local devnet
anvil
forge script contracts/script/Deploy.s.sol:Deploy --root contracts \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# the experiment (naive vs coordinated), and the 4-bot race
pnpm --filter @reservoir/experiment start        # → the three bars
pnpm --filter @reservoir/keeper dev race         # → four bots, one wins
```

Networks: local **anvil** (chainId 31337) and **Monad testnet** (chainId 10143,
RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadexplorer.com`,
faucet `https://faucet.monad.xyz`). Copy `.env.example` → `.env`.

### Monad testnet

Fund the deployer from the [faucet](https://faucet.monad.xyz), then:

```bash
export $(grep -v '^#' .env | xargs)   # DEPLOYER_PRIVATE_KEY, KEEPER_PRIVATE_KEY_1..4

# deploy the canonical contracts + tasks (writes packages/shared/deployments/10143.json)
forge script contracts/script/Deploy.s.sol:Deploy --root contracts \
  --rpc-url $MONAD_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY

# measure real declared-limit gas with a SINGLE funded account
pnpm --filter @reservoir/experiment start -- measure --chain 10143 --out reports/monad-measure.json

# or the full four-keeper experiment (needs KEEPER_PRIVATE_KEY_1..4 funded too)
pnpm --filter @reservoir/experiment start -- --chain 10143 --out reports/monad-experiment.json
```

## Measured results

Local anvil (declared-limit basis — what Monad's accounting bills):

| metric | naive | coordinated | reduction |
| --- | --- | --- | --- |
| MON charged (declared limit) | 4 × 500k | 4 × 130k + 500k | **~49%** |
| block gas reserved | 2,000,000 | 1,020,000 | **~49%** |
| useful-work ratio (used / reserved) | ~7% | ~27% | 3.7× |

Success-path gas (anvil): cheap `claim` ≈ 88k (direct) / 113k (via executor); mock
liquidation ≈ 109k. A real Aave liquidation success path is larger (~400–500k), which is
why keepers declare 500k. The Ethereum counterfactual (gas *used*, reverts refunded) shows
coordination costs slightly **more** there — the saving is specific to Monad's declared-limit
accounting, which is the whole thesis.

_Monad testnet figures: run the commands above and paste the numbers here._

| metric (Monad testnet) | value |
| --- | --- |
| gas price | _tbd_ |
| claim gas used / declared | _tbd_ |
| liquidation gas used / declared | _tbd_ |
| modeled declared-limit reduction | _tbd_ |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the git/PR conventions.
