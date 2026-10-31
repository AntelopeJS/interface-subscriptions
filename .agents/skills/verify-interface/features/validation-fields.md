---
covers:
  - src/validation.ts
docs:
  - docs/4.implementing.md
  - docs/2.subscriptions.md
journeys:
  - validate-fields
---

# Validation fields

`ValidateSubscriptionRequest` enforces the portable request fields so every implementation refuses the same shapes.

## Sub-features

- `validate-fields`: the packed `ValidateSubscriptionRequest` accepts the README request and refuses, with `InvalidSubscriptionRequestError` and the message naming the rule, an empty or missing reference, customer or payment method, an amount that is zero, negative, fractional, `NaN`, a string or missing, and a currency that is not three uppercase letters; it checks the format only, so `ZZZ` is accepted.

## How to get to it (user POV)

- `ValidateSubscriptionRequest(request, Date.now())` before a request reaches a provider.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" validation-fields
```

## Gotchas

- The error must be an `InvalidSubscriptionRequestError`, a `SubscriptionError` and an `Error`.
