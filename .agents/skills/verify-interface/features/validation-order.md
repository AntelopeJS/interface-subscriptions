---
covers:
  - src/validation.ts
docs:
  - docs/4.implementing.md
journeys:
  - validate-order
---

# Validation order

The error names the first rule broken, so the order of the rules is part of the contract.

## Sub-features

- `validate-order`: a request that breaks every rule is repaired one rule at a time; `ValidateSubscriptionRequest` must name reference, customer, payment method, amount, currency, interval, interval count, then the trial and anchor conflict, then the date, as docs/4.implementing.md lists.

## How to get to it (user POV)

- A form that shows the first problem `ValidateSubscriptionRequest` reports.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" validation-order
```

## Gotchas

- Each step of the journey repairs exactly one rule, so a swapped pair shows as one wrong message.
