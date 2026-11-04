---
covers:
  - src/types.ts
docs:
  - docs/2.subscriptions.md
  - README.md
journeys:
  - status-vocabulary
---

# Statuses

The four normalised statuses and why a subscription ended; only `canceled` is terminal. This journey contains the Format door of `src/types.ts`.

## Sub-features

- `status-vocabulary`: the packed `SUBSCRIPTION_STATUSES` lists trialing, active, past_due and canceled in lifecycle order, `SUBSCRIPTION_END_REASONS` lists requested and payment_failed, both are frozen so a consumer cannot extend them, and `isTerminalSubscriptionStatus` is true for `canceled` only.

## How to get to it (user POV)

- `if (isTerminalSubscriptionStatus(subscription.status)) stopBilling()` and `switch (subscription.status)`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" statuses
```

## Gotchas

- The strings are stored by providers and consumers, so a rename is a data migration. That is why the door exists.
