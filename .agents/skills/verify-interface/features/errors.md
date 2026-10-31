---
covers:
  - src/errors.ts
docs:
  - docs/2.subscriptions.md
journeys:
  - error-classes
---

# Errors

What a consumer catches when a call did not happen: not found, invalid request, invalid state, first period declined.

## Sub-features

- `error-classes`: the five error classes, built the way docs/2.subscriptions.md says (`new InvalidSubscriptionStateError(message, status?, providerCode?)`, `SubscriptionPaymentError(payment, providerCode?)`): each has its own `name`, is a `SubscriptionError` and an `Error`, siblings are not each other, the provider code is kept verbatim, the state error carries the status, the payment error carries the declined `Payment` and the message `The first period could not be charged: payment <id> is <status>`, and the not-found message is `No such subscription: <id>`.

## How to get to it (user POV)

- `catch (error) { if (error instanceof SubscriptionPaymentError) show(error.payment.failure) }`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" errors
```

## Gotchas

- A failed renewal is a `past_due` status, not an error; only a declined first period rejects.
