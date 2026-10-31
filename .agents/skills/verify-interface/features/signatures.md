---
covers:
  - src/functions.ts
docs:
  - docs/2.subscriptions.md
  - docs/4.implementing.md
journeys:
  - signatures
---

# Signatures

The compile-time contract of the calls: which argument comes where, which are optional, what they resolve to.

## Sub-features

- `signatures`: a TypeScript consumer compiling against the packed declarations: each call takes the arguments docs/2.subscriptions.md shows in order and returns `Promise<Subscription>` (`Promise<Subscription[]>` for the list), `ValidateSubscriptionRequest(request, now?)` returns `void`, `isTerminalSubscriptionStatus` takes a status, and an event handler takes one `SubscriptionEvent`.

## How to get to it (user POV)

- A TypeScript backend module importing the calls and the event handler type.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" signatures
```

## Gotchas

- The probe compiles with `--strict` against `dist/index.d.ts`; it reads types only and needs no provider.
