---
covers:
  - src/types.ts
docs:
  - docs/2.subscriptions.md
  - docs/3.events.md
journeys:
  - field-types
---

# Field types

The data a backend reads and writes: `Subscription`, `SubscriptionRequest`, `SubscriptionEvent` and the `JsonObject` that `vendorData` is limited to.

## Sub-features

- `field-types`: a TypeScript consumer compiling against the packed declarations: the fields of `Subscription`, `SubscriptionRequest` and `SubscriptionEvent` that are required and optional as docs/ state, the literal unions of status, interval, end reason, timing and event type, no `vendorData` in a request, and what `JsonObject` accepts (`undefined` values, nested objects) and refuses (`Date`, `Buffer`, functions, read-only arrays, interface-typed objects).

## How to get to it (user POV)

- A TypeScript backend reading `subscription.status`, `subscription.endedAt` and `event.payment`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" field-types
```

## Gotchas

- Types only: the probe cannot see a runtime value.
