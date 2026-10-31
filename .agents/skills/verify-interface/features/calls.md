---
covers:
  - src/functions.ts
  - src/index.ts
docs:
  - README.md
  - docs/2.subscriptions.md
  - docs/3.events.md
journeys:
  - calls-through-core
---

# Calls

A backend starts, reads, lists, cancels and re-methods a subscription through the five `InterfaceFunction`s, each with an idempotency key positionally and an optional trailing `provider`.

## Sub-features

- `calls-through-core`: `CreateSubscription`, `GetSubscription`, `ListSubscriptions`, `CancelSubscription` and `UpdateSubscriptionPaymentMethod` are called through core by a consumer module with the arguments a backend passes (the request, the idempotency key positionally, the cancellation timing, the optional trailing `provider` both given and left out); the stub provider must receive the same arguments in the same order.

## How to get to it (user POV)

- `await CreateSubscription(request, `subscribe-${accountId}`)` and `await CancelSubscription(id, `cancel-now-${id}`, "now")` in a module next to a billing provider.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" calls
```

## Gotchas

- The stub provider echoes its arguments, so this feature proves what reaches a provider, not what a provider answers. Provider behaviour belongs to its conformance suite.
