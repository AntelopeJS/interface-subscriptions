---
covers:
  - src/tests/**
docs:
  - README.md
  - docs/4.implementing.md
journeys:
  - suite-helpers
  - suite-defaults
  - suite-files
---

# Conformance

The provider conformance suite ships in the package so any module that lists the interface in `antelopeJs.implements` runs it.

## Sub-features

- `suite-helpers`: the shipped `tests/support` module of the packed interface, loaded by a provider author through the package's own `exports`, reads `ANTELOPE_PAYMENT_TEST_METHOD`, `ANTELOPE_SUBSCRIPTIONS_TEST_METHOD_DECLINES_LATER`, `ANTELOPE_SUBSCRIPTIONS_TEST_EVENTS` and `ANTELOPE_PAYMENT_TEST_CURRENCY` as README.md states, with every variable set.
- `suite-defaults`: the same module with no variable set: no test method, events not observable and the currency `EUR`; epoch seconds are refused as a time, milliseconds accepted.
- `suite-files`: `dist/tests` holds the two test files and the support module, and `package.json` exports `./tests/*` and ships `dist`.

## How to get to it (user POV)

- A provider author runs `ajs module test` in their module with the `ANTELOPE_PAYMENT_TEST_*` variables from the README table.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" conformance
```

## Gotchas

- The suite itself needs a real provider, so these journeys cover its helpers and packaging, not a provider's verdict.
