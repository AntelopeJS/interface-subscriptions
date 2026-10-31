---
covers:
  - src/validation.ts
docs:
  - docs/4.implementing.md
  - docs/2.subscriptions.md
journeys:
  - validate-interval
---

# Validation interval

A period is `intervalCount` times `interval`; the validator refuses what is not a calendar unit and a positive whole count.

## Sub-features

- `validate-interval`: `ValidateSubscriptionRequest` accepts `day`, `week`, `month` and `year`, an omitted interval count and any positive whole one, and refuses an unknown or differently cased interval and a zero, negative, fractional, `NaN`, text or `null` count.

## How to get to it (user POV)

- `{ interval: "month", intervalCount: 3 }` for a quarterly plan.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" validation-interval
```

## Gotchas

- An omitted `intervalCount` means 1 and is accepted; an explicit `null` is not.
