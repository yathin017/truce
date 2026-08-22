# @truce/web

The Truce console — a Next.js frontend that explains the Monad gas-billing problem and shows
the [arena](../arena) running live: two side-by-side columns, real transactions, clickable
explorer links, and the mean gas saved.

## Design

Warm editorial paper + ink, a validated rust (`#C4551D`, waste) / green (`#118A64`, efficient)
data palette — deliberately not the generic AI blue/violet. System fonts, tabular monospace
numbers, hairline Swiss grid. Colour is only ever an accent; identity always carries a ✓/✗ and a
label too.

## Run

```bash
# 1. start the arena (see ../arena) — e.g. on Monad testnet:
DEPLOYER_PRIVATE_KEY=0x… pnpm --filter @truce/arena serve --chain 10143

# 2. start the console
pnpm --filter @truce/web dev        # http://localhost:3000
```

Point it at a different arena with `NEXT_PUBLIC_ARENA_URL` (default `http://localhost:8787`).
If the arena is down, the page still renders with a clear "arena offline" banner.

## Structure

```
app/            layout + page (renders <Console/>)
components/      Nav · Hero · HowItWorks · Arena · LaneColumns · TxRow · GasCompare · BurnMeter · Footer
lib/arena.ts     useArena() — REST snapshot + WS live feed
lib/types.ts     arena API shapes (mirrored from arena/README.md)
lib/format.ts    MON / gas / hash formatting
```

It consumes only the arena HTTP+WS API — no coupling to the arena or contract code.
