# Feature map

One file per feature. `covers:` lists the source globs it owns, `docs:` the pages a verdict judges, `journeys:` the journeys it runs, and `seeded-breaks/<feature>.patch` the break its journeys must catch. `pnpm exec antelopejs-verify map` checks that every user-facing file is covered.

| Feature | What the user does | Journeys |
|---|---|---|
| [smoke](smoke.md) | The fixed journey every verdict runs, whatever the diff touches: pack the interface, load it in `ajs project dev` with a stub provider and a consumer, and call everything it declares. | every-function |
| [calls](calls.md) | A backend starts, reads, lists, cancels and re-methods a subscription through the five `InterfaceFunction`s, each with an idempotency key positionally and an optional trailing `provider`. | calls-through-core |
| [signatures](signatures.md) | The compile-time contract of the calls: which argument comes where, which are optional, what they resolve to. | signatures |
| [field-types](field-types.md) | The data a backend reads and writes: `Subscription`, `SubscriptionRequest`, `SubscriptionEvent` and the `JsonObject` that `vendorData` is limited to. | field-types |
| [validation-fields](validation-fields.md) | `ValidateSubscriptionRequest` enforces the portable request fields so every implementation refuses the same shapes. | validate-fields |
| [validation-order](validation-order.md) | The error names the first rule broken, so the order of the rules is part of the contract. | validate-order |
| [validation-interval](validation-interval.md) | A period is `intervalCount` times `interval`; the validator refuses what is not a calendar unit and a positive whole count. | validate-interval |
| [validation-dates](validation-dates.md) | Trials and billing anchors defer the first charge; they are mutually exclusive, must be finite, and with `now` must be strictly in the future. | validate-dates |
| [statuses](statuses.md) | The four normalised statuses and why a subscription ended; only `canceled` is terminal. | status-vocabulary |
| [vocabularies](vocabularies.md) | The other strings consumers branch on and providers store: intervals, cancellation timings, event types, the metadata key marking subscription charges, and the one-year period cap. | wire-names |
| [errors](errors.md) | What a consumer catches when a call did not happen: not found, invalid request, invalid state, first period declined. | error-classes |
| [conformance](conformance.md) | The provider conformance suite ships in the package so any module that lists the interface in `antelopeJs.implements` runs it. | suite-helpers, suite-defaults, suite-files |
