# Contributing to Reservoir

House rules for keeping this hackathon repo clean and reviewable.

## Git workflow

- **Trunk-based.** `main` is always green. Never commit directly to `main`.
- **Short-lived branches** off `main`, one per unit of work:
  `type/scope-desc` — e.g. `feat/contracts-coordinator`, `chore/repo-scaffold`, `fix/keeper-nonce`.
- Open a **PR** into `main`, fill in the template, get CI green, **squash-merge**, then delete the branch.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`

- **types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `perf`
- **scopes:** `contracts`, `keeper`, `experiment`, `web`, `shared`, `ci`, `repo`
- Subject in the imperative, ≤ 50 chars, no trailing period.
- Body (optional) explains the *why* when it isn't obvious.

> **No AI attribution.** Do not add `Co-Authored-By: Claude`, "Generated with …", or any
> tool/AI trailer to commits or PR bodies. Keep the history clean and human.

## Layout

| Path             | What                                                        |
| ---------------- | ---------------------------------------------------------- |
| `contracts/`     | Foundry project (standalone, not in the pnpm graph)        |
| `keeper/`        | TypeScript keeper daemon                                    |
| `experiment/`    | Run A vs Run B gas experiment harness                      |
| `web/`           | Next.js console (Phase B)                                   |
| `packages/shared`| viem chains, synced ABIs, gas/HF math shared across TS pkgs |

## Checks before opening a PR

```bash
# contracts
forge test --root contracts -vvv
forge fmt --check --root contracts

# typescript
pnpm -r typecheck
```

## Solidity conventions

- `^0.8.24`, `forge fmt` formatting (see `contracts/foundry.toml`).
- Checks-effects-interactions; pull-payment withdrawals; fail-closed external calls.
- Every non-trivial contract ships with a Foundry test in `contracts/test/`.
