---
covers:
  - src/validation.ts
docs:
  - docs/4.implementing.md
  - docs/2.subscriptions.md
journeys:
  - validate-dates
---

# Validation dates

Trials and billing anchors defer the first charge; they are mutually exclusive, must be finite, and with `now` must be strictly in the future.

## Sub-features

- `validate-dates`: with a fixed `now`, `ValidateSubscriptionRequest` accepts a trial end or billing anchor one millisecond ahead and refuses one equal to `now`, behind it, or in epoch seconds; a trial together with an anchor is refused before any date; without `now` a past date passes while `NaN` and infinities are refused; it returns `undefined` on success.

## How to get to it (user POV)

- `ValidateSubscriptionRequest({ ...request, trialEnd: Date.now() + 14 * DAY }, Date.now())`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" validation-dates
```

## Gotchas

- `now` is Unix epoch milliseconds, not seconds.
