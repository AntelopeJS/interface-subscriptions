---
covers:
  - src/types.ts
docs:
  - docs/2.subscriptions.md
  - docs/3.events.md
journeys:
  - wire-names
---

# Vocabularies

The other strings consumers branch on and providers store: intervals, cancellation timings, event types, the metadata key marking subscription charges, and the one-year period cap. This journey contains the Format door of `src/types.ts`.

## Sub-features

- `wire-names`: the packed `SUBSCRIPTION_INTERVALS`, `CANCELLATION_TIMINGS` and `SUBSCRIPTION_EVENT_TYPES` hold the strings docs/ names in the documented order and are frozen, `SUBSCRIPTION_METADATA_KEY` is `antelopeSubscription` and `MAX_PORTABLE_PERIOD_DAYS` is 366.

## How to get to it (user POV)

- `if (event?.payment?.metadata?.[SUBSCRIPTION_METADATA_KEY]) return;` in a payment webhook route.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" vocabularies
```

## Gotchas

- The metadata key is how a payment webhook tells a subscription charge from a one-off payment.
