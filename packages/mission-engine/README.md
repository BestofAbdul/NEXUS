# @nexus/mission-engine

The single responsibility of this package is to own mission lifecycle rules,
progress calculation, and persistence through exported interfaces.

## Commands

```bash
pnpm --filter @nexus/mission-engine test
pnpm --filter @nexus/mission-engine typecheck
pnpm mission:verify
```

`pnpm mission:verify` synchronizes the local SQLite schema, creates a mission,
and fetches it through the exported Mission Engine interfaces.
