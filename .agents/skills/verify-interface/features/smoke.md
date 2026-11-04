---
covers:
docs:
  - README.md
  - docs/1.introduction.md
journeys:
  - every-function
---

# Smoke

The fixed journey every verdict runs, whatever the diff touches: pack the interface, load it in `ajs project dev` with a stub provider and a consumer, and call everything it declares.

## Sub-features

- `every-function`: a fixture project loads the packed interface with a stub provider and a consumer module; every declared call, the event proxy and the two plain helpers (`ValidateSubscriptionRequest` refuses a zero amount with `InvalidSubscriptionRequestError`, `isTerminalSubscriptionStatus` answers true for `canceled` and false for `past_due`) answer through core, and the stub provider logs each call.

## How to get to it (user POV)

- A project with a billing module and a module that imports `@antelopejs/interface-subscriptions`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" smoke
```

## Gotchas

- The smoke feature covers no glob, so it never marks a file as mapped.
