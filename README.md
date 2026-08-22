<div align="center">

# Truce

**A gas-aware keeper coordination layer for Monad.**

*Stake your claim before you spend your gas.*

Built for the Monad hackathon · live on Monad testnet (chainId 10143)

</div>

---

## The one-line pitch

On Monad, **losing a keeper race costs almost as much as winning it.** Truce moves the race off
the expensive execution transaction and onto a cheap, bonded reservation — so keepers compete for
pennies and only one of them ever pays for the heavy work.

## The problem (and why it's specific to Monad)

Lending liquidations, DEX arbitrage, vault harvests, upkeep jobs — they all rely on the same
pattern: a protocol can't act on itself, so it pays unaffiliated bots (**keepers**) to do it. Many
keepers watch the same opportunity, so they **race**. Only one wins; the rest revert.

On most chains a reverted transaction only pays for the gas it actually used. **On Monad you pay
for the gas limit you _declare_, not the gas you use** — because leaders propose blocks *before*
executing them, so gas has to be accounted at proposal time (charging used-gas would let anyone
declare a huge limit, consume nothing, and pay nothing — a DoS vector).

The consequence is a structural trap for keepers:

- A keeper **must** declare a success-sized limit (~500k) — declare less and it runs out of gas the
  moment it *wins*.
- When it **loses**, its transaction reverts at the eligibility check having used maybe 5% of that
  limit — **but it is billed the full amount anyway.**
- The block builder **cannot** filter those reverts out, because it proposes before it executes.

Four keepers racing one liquidation → **one useful transaction and three that are each billed a
full success-path limit for doing nothing.** Three-quarters of the reserved gas does no work, and
the waste peaks exactly during volatility, when liquidations matter most.

## The idea

Add a two-phase flow with a single, protocol-agnostic contract:

1. **Claim (cheap, bonded).** Keepers first compete with a small `claim(taskId, subject)` — one cold
   storage write plus a gas-capped eligibility check (~110k). Losing *this* race costs the claim
   limit, not the execution limit.
2. **Execute (expensive, once).** The one winner's own contract calls `consume(...)` as its first
   line to prove it holds the claim, then performs the real work. The losers stood down.

The coordinator **executes nothing and custodies nothing but bonds.** It never sees the work, never
touches user funds, and doesn't know what a liquidation is — it only verifies that *the world
changed*: a task-supplied predicate (`isEligible(subject) → bool`) flipped from true to false. That
single property is why one deployment serves liquidations, arbitrage **and** cron jobs, and why a
griefer who claims-and-vanishes is bounded: after a short window anyone can `resolve` the claim,
which **slashes** the bond if the opportunity is still live or **refunds** it if the opportunity
legitimately evaporated (e.g. the borrower repaid).

```
                              opportunity appears
                                     │
              ┌──────────┬───────────┼───────────┬──────────┐
              ▼          ▼           ▼           ▼          ▼
             K1         K2          K3          K4      (all detect)
              └──────────┴─────┬─────┴───────────┘
                               ▼
                  claim(taskId, subject) + bond      ← CHEAP  (~110k)
                               │
                     K2 wins; K1/K3/K4 revert cheaply and STAND DOWN
                               ▼
                  K2's executor: consume() → do the work   ← EXPENSIVE, paid ONCE
                               ▼
                    predicate flips false · bond returned
```

## Measured on Monad testnet

Deployed and measured live on Monad testnet. On the declared-limit basis — the way the chain
actually charges — coordination cuts what keepers are billed by roughly a third to a half,
**per use case**, because the limits are estimated per action (a liquidation saves more than a
light upkeep):

| use case | naive (4 × execute) | coordinated (4 × claim + 1 × execute) | billed reduction |
| --- | --- | --- | --- |
| Liquidation | ~604k each | ~130k claim + ~650k execute | **~51%** |
| DEX arbitrage | ~427k each | ~130k claim + ~477k execute | **~41%** |
| Cron / upkeep | ~300k each | ~130k claim + ~372k execute | **~25%** |

The honest headline, confirmed on-chain: a **successful** liquidation that computed in ~113k of gas
was still billed its full **500,000** declared limit, and a claim declared at 130k/150k *ran out of
gas* — Monad's live metering runs above a local EVM's for cold-storage-heavy paths. On Monad you pay
the limit you declare, win or lose, which is exactly why moving contention onto the cheap claim
wins. (Raw numbers: [`reports/monad-measure.json`](./reports/monad-measure.json).)

---

## Monad testnet deployment (chainId 10143)

RPC `https://testnet-rpc.monad.xyz` · explorer `https://testnet.monadexplorer.com` · faucet
`https://faucet.monad.xyz` · native token **MON** · ~1s blocks.

**Canonical protocol deployment** (`contracts/script/Deploy.s.sol`, in
[`packages/shared/deployments/10143.json`](./packages/shared/deployments/10143.json)). This is the
single-world deployment used by the keeper and measurement flows; it is intentionally separate
from the side-by-side live-demo arena listed below.

| contract | address |
| --- | --- |
| **Coordinator** | [`0x376ffecB62143019323bD02d832903ac05fA78C7`](https://testnet.monadexplorer.com/address/0x376ffecB62143019323bD02d832903ac05fA78C7) |
| EnforcedMockPool (lending) | [`0x968cA81263A421F70D956a46Dc5048F487C3fdAE`](https://testnet.monadexplorer.com/address/0x968cA81263A421F70D956a46Dc5048F487C3fdAE) |
| MockVault (upkeep) | [`0xc8907D1E5735B8C0C6ae20e1801DE640B34Bf235`](https://testnet.monadexplorer.com/address/0xc8907D1E5735B8C0C6ae20e1801DE640B34Bf235) |
| Collateral oracle | [`0x98f564d147ee40EBBE9f7ec670a590989b5a93f3`](https://testnet.monadexplorer.com/address/0x98f564d147ee40EBBE9f7ec670a590989b5a93f3) |
| Pool price source | [`0x079c6cB5D086b5Df756C6F236992B48093704e9F`](https://testnet.monadexplorer.com/address/0x079c6cB5D086b5Df756C6F236992B48093704e9F) |
| Reference oracle | [`0x3e7d33E46B5Cd64CfFEd977038Ff5a5FE320F8ab`](https://testnet.monadexplorer.com/address/0x3e7d33E46B5Cd64CfFEd977038Ff5a5FE320F8ab) |

**Registered tasks** (predicate + `taskId`):

| task | predicate | taskId |
| --- | --- | --- |
| Aave liquidation | [`0xF1b06d0FEfDb393b90135254c478f6d63a0A32c1`](https://testnet.monadexplorer.com/address/0xF1b06d0FEfDb393b90135254c478f6d63a0A32c1) | `0x5448cbfa54b3d81a648398774862e357b0ee5b767acc6b7d85dedb748e2ca29a` |
| DEX arbitrage | [`0xdf098feF9Fc67F34E11144c0684623f763fe6d13`](https://testnet.monadexplorer.com/address/0xdf098feF9Fc67F34E11144c0684623f763fe6d13) | `0xe2b461e946a78210a12858534b9346657cbd8e1a8d4bb424e4abfac1db43614e` |
| Cron / harvest | [`0x3A80A21F3b1Cb78B053DE7F743D4F7Af14d21736`](https://testnet.monadexplorer.com/address/0x3A80A21F3b1Cb78B053DE7F743D4F7Af14d21736) | `0xdfe95f88d6e641bb13a0f3e5cf00b0715df669c8620a85b2d24b8c9a6da624f0` |

**Live-demo arena deployment** ([`arena/deployments/arena-10143.json`](./arena/deployments/arena-10143.json)).
The arena needs separate naive and coordinated targets for each lane so both approaches can run
side by side. These are the addresses printed by `@truce/arena serve --chain 10143`:

| lane / contract | naive target | coordinated target | taskId |
| --- | --- | --- | --- |
| **Arena coordinator** | — | [`0xb26381d4a04d85f06d06d8f66548ddd502c323e4`](https://testnet.monadexplorer.com/address/0xb26381d4a04d85f06d06d8f66548ddd502c323e4) | — |
| Aave liquidation | [`0xf3951119d5bce0db6943aa54f7008f6b03833408`](https://testnet.monadexplorer.com/address/0xf3951119d5bce0db6943aa54f7008f6b03833408) | [`0xac06ac357611a31374fa64547a16f8bf39f683f8`](https://testnet.monadexplorer.com/address/0xac06ac357611a31374fa64547a16f8bf39f683f8) | `0xf071b95067db0ab08fb1c0615b2d6af5e09cae13229cab17dffcd199832622ad` |
| DEX arbitrage | [`0x2301a1a79a4963a33302bbd06e93953f186228ed`](https://testnet.monadexplorer.com/address/0x2301a1a79a4963a33302bbd06e93953f186228ed) | [`0xcdcc2024d7770225354bc6524d84a261c298e462`](https://testnet.monadexplorer.com/address/0xcdcc2024d7770225354bc6524d84a261c298e462) | `0x31ee07a18bcf8ff29b363014068130e903b1d17f23b9fcc9671a623b0a2ea3d2` |
| Cron / harvest | [`0xf0d3bd99b4434fcfe7f3fd29dcc811e5e697c64f`](https://testnet.monadexplorer.com/address/0xf0d3bd99b4434fcfe7f3fd29dcc811e5e697c64f) | [`0xeb819ad76070fdaa54de37df5b3d5b17088e1b0b`](https://testnet.monadexplorer.com/address/0xeb819ad76070fdaa54de37df5b3d5b17088e1b0b) | `0x7909c9b048705f29a179791a1c3d381a0177bfd34419c9f8526231b81f70a1b9` |

---

## Tech stack

| layer | stack |
| --- | --- |
| **Contracts** | Solidity `^0.8.24`, [Foundry](https://book.getfoundry.sh/) (forge 1.7.1), OpenZeppelin (`ReentrancyGuard`), `forge-std`. 39 tests incl. a full adversarial-predicate suite + fuzz invariants. |
| **Backend** | TypeScript, [viem](https://viem.sh) v2, Node 24. Keeper daemon, gas-experiment harness, and the live arena engine ([Fastify](https://fastify.dev) + `ws`). |
| **Frontend** | [Next.js](https://nextjs.org) 15 (App Router) + React 19 + Tailwind v3. Editorial design, validated colourblind-safe data palette, live WebSocket feed. |
| **Monorepo** | [pnpm](https://pnpm.io) workspaces (`@truce/*`) for the JS packages; Foundry stands alone under `contracts/`. ABIs flow one way: `forge build` → `sync-abis` → `@truce/shared`. |
| **Chains** | Local [anvil](https://book.getfoundry.sh/anvil/) (31337) for dev; Monad testnet (10143) for the real run. |

## Repository layout

```
truce/
├── contracts/            Foundry project (standalone) — the on-chain core
│   ├── src/
│   │   ├── Coordinator.sol                  the exclusivity gate (bonds + escrow only)
│   │   ├── interfaces/                       ICoordinator, IEligibilityPredicate
│   │   ├── predicates/                       AaveHealth, PriceDivergence, Interval
│   │   ├── executors/                        BaseExecutor + one per task
│   │   ├── mocks/                            Enforced pool / arb pool / cron job + oracles
│   │   └── lib/                              TaskEncoding, GasSim
│   ├── test/                                 Coordinator · Invariants · MaliciousPredicate · Tasks · ArenaJobs
│   └── script/                               Deploy.s.sol · RegisterTasks.s.sol
├── packages/shared/      @truce/shared — viem chains, synced ABIs, gas/HF math, deployments
├── keeper/               @truce/keeper — config-driven keeper daemon (YAML, no code to run one)
├── experiment/           @truce/experiment — naive-vs-coordinated gas experiment + testnet measure
├── arena/                @truce/arena — the live demo engine (REST + WebSocket)
├── web/                  @truce/web — the Next.js console
└── reports/              recorded testnet measurements
```

## How the contract stays safe

The coordinator holds only bonds and bounty escrow, and every external call is defensive — the
adversarial-predicate test suite (`test/MaliciousPredicate.t.sol`) was written *first*:

- Predicate calls are `staticcall`, **gas-capped** (with EIP-150 63/64 headroom) and **fail closed**
  — a hostile predicate can't mutate state, burn the claimer's declared gas, or freeze bonds.
- Slashing pays a **fixed** reward to whoever resolves; the remainder goes to a non-withdrawable
  pool, so an always-true "bond farm" predicate is never profitable.
- Task parameters are immutable (`taskId` is their hash) — no bait-and-switch.
- Pull-payment withdrawals, checks-effects-interactions, `ReentrancyGuard`.
- Fuzz invariants hold over 128k calls: solvency, one-holder-per-subject, monotonic slash pool.

## Honest scope

- This is **keeper-side coordination, not protocol-enforced exclusivity.** In the demo the mock
  market honours the claim (a one-line integration: `require(coordinator.holder(...) == msg.sender)`);
  without that integration, participating keepers still save against each other.
- **Complementary to Chainlink SVR:** SVR recaptures oracle value from the *winning* liquidation;
  Truce eliminates the wasted gas from the *losing* attempts.
- The lending pool, DEX pool and cron job are **labelled mocks** with the same interfaces as the real
  thing, so the experiment is deterministic rather than a live-mainnet gamble.

---

## Quickstart

Prereqs: Node ≥ 24, [pnpm](https://pnpm.io), [Foundry](https://getfoundry.sh).

```bash
pnpm install
forge build --root contracts
forge test  --root contracts -vvv        # 39 tests
```

### The demo (local anvil — free and instant)

```bash
anvil                                                    # terminal 1
pnpm --filter @truce/arena serve --chain 31337           # terminal 2 — waits for an explicit run
pnpm --filter @truce/web  dev                            # terminal 3 — http://localhost:3000
```

Open `localhost:3000`: the landing page explains the problem without sending transactions. Open
**Experiment** and click **Run the experiment** to execute one explicit three-lane sample. Results
appear in two columns — *Without Truce* vs *With Truce* — with the losers on the left billed in full
for reverting. On the coordinated side, one claim and its execute should be ✓; the other three
claims show ✗ because they correctly lost the reservation race. Four claim ✗ marks indicate an
invalid round, which the arena now rejects instead of reporting as savings.

### On Monad testnet

Fund a deployer from the [faucet](https://faucet.monad.xyz), then:

```bash
export DEPLOYER_PRIVATE_KEY=0x...

# deploy the canonical contracts + tasks (writes packages/shared/deployments/10143.json)
forge script contracts/script/Deploy.s.sol:Deploy --root contracts \
  --rpc-url https://testnet-rpc.monad.xyz --broadcast --private-key $DEPLOYER_PRIVATE_KEY

# measure real declared-limit gas with a single funded account
pnpm --filter @truce/experiment start -- measure --chain 10143 --out reports/monad-measure.json

# run the live arena on testnet; it waits for an explicit experiment request
pnpm --filter @truce/arena serve --chain 10143
```

### Arena API (what the frontend consumes)

`GET /state` snapshot · `WS /events` live feed · `POST /round` runs exactly one explicit
three-lane experiment. Full contract in [`arena/README.md`](./arena/README.md).

### Run a keeper

Config-driven — no code required. See [`keeper/README.md`](./keeper/README.md) and
[`keeper/keeper.example.yml`](./keeper/keeper.example.yml). Its one non-negotiable line is a **tight
declared gas limit on the claim**: on Monad you pay the limit you declare, so a padded claim would
reintroduce the exact waste Truce removes.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the git and PR conventions.
