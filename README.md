# @antelopejs/interface-subscriptions

[![npm version](https://img.shields.io/npm/v/@antelopejs/interface-subscriptions.svg)](https://www.npmjs.com/package/@antelopejs/interface-subscriptions)
[![license](https://img.shields.io/npm/l/@antelopejs/interface-subscriptions.svg)](./LICENSE)

Provider-agnostic subscriptions for AntelopeJS. Bill a saved payment method
every period — with trials, a billing anchor, cancellation now or at period end,
and `past_due` reporting — without naming a provider, and without every
consumer rebuilding a billing cycle of its own.

## Installation

```bash
npm install @antelopejs/interface-subscriptions
```

This package declares the contract and ships no billing logic. Wire a module
that implements it:

- a provider that fires renewals itself implements it natively (Stripe, PayPal,
  Mollie);
- for any other `@antelopejs/interface-payment` provider, wire
  `@antelopejs/payment-subscriptions`, which runs the renewal clock itself on
  saved methods and off-session charges.

A payment module that cannot do subscriptions simply does not implement this
interface. There is no half-honoured contract and no `UnsupportedOperationError`
here.

## What it covers

| Area      | Functions                                                       |
| --------- | --------------------------------------------------------------- |
| Lifecycle | `CreateSubscription`, `CancelSubscription`                      |
| Reading   | `GetSubscription`, `ListSubscriptions`                          |
| Recovery  | `UpdateSubscriptionPaymentMethod`                               |
| Events    | `SubscriptionEvents` (a registering proxy, not a webhook route) |

The portable core is small on purpose: amount, interval and interval count,
billing anchor, trial end, status including `past_due`, cancel now or at period
end, and the current period. Proration, dunning schedules, tax, coupons, metered
billing and multiple items per subscription are out, because the generic
fallback cannot honour them and a contract that only some implementations keep
is a lie. For those, use the provider's own interface.

## Quick start

```ts
import {
  CreatePayment,
  ListPaymentMethods,
} from "@antelopejs/interface-payment";
import {
  CreateSubscription,
  SubscriptionEvents,
} from "@antelopejs/interface-subscriptions";

// 1. Take the mandate on-session: a payment that saves the method.
await CreatePayment(
  {
    amount,
    reference,
    customer,
    paymentMethod: token,
    savePaymentMethod: true,
    returnUrl,
  },
  `save-${orderId}`,
);
const [method] = await ListPaymentMethods(customer);

// 2. Subscribe. The first period is charged off-session before this resolves.
const subscription = await CreateSubscription(
  {
    reference: accountId,
    customer,
    paymentMethod: method.id,
    amount,
    interval: "month",
  },
  `subscribe-${accountId}`,
);

// 3. React to what happens while nobody is calling.
SubscriptionEvents.register("billing", async (event) => {
  await grantOrRevokeAccess(event.subscription);
});
```

## Conventions

- **Built on the payment interface's portable pair**: one on-session payment that
  saves a method, then off-session charges. Customers, methods and payments are
  `@antelopejs/interface-payment` identifiers from the same account.
- **An idempotency key on every mutating call**, positionally.
- **A declined renewal is a status, not an exception.** Only a declined _first_
  period rejects, with `SubscriptionPaymentError`, and creates nothing.
- **`past_due` is portable to report; the retry policy is not.**
- **`vendorData` is a read-only echo.** No request accepts it.
- **An optional trailing `provider`** selects the payment account, as in the
  payment interface.

## Documentation

| Document                                                             | Contents                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| [Introduction](./docs/1.introduction.md)                             | Why a second interface, the portable core, who fires renewals   |
| [Subscriptions](./docs/2.subscriptions.md)                           | Creating, periods, trials and anchors, statuses, cancelling     |
| [Events](./docs/3.events.md)                                         | The event set, delivery, and how it relates to payment webhooks |
| [Implementing](./docs/4.implementing.md)                             | Native and fallback implementations, the conformance suite      |
| [Provider capability matrix](./docs/5.provider-capability-matrix.md) | Which providers fire renewals themselves, and what that means   |

## Conformance suite

`src/tests/` ships in the package as `dist/tests` and runs against whichever
module implements the interface. It is much weaker than the payment suite, and
on purpose: a test cannot wait a month for a renewal, so for a native provider it
covers creation, reading, cancellation, method changes and request validation —
not renewals. The generic fallback's own suite drives an injected clock through
every renewal path and is the executable specification for the rest.

| Variable                                            | Purpose                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ANTELOPE_PAYMENT_TEST_METHOD`                      | A token that saves on-session and charges off-session. Without it, everything but the unknown-id tests skips. |
| `ANTELOPE_SUBSCRIPTIONS_TEST_METHOD_DECLINES_LATER` | A token that saves on-session and is declined off-session. Without it, the declined-first-period tests skip.  |
| `ANTELOPE_SUBSCRIPTIONS_TEST_EVENTS`                | Set when events can reach the test process. A native provider delivers them by webhook, which usually cannot. |
| `ANTELOPE_PAYMENT_TEST_CURRENCY`                    | ISO-4217 code to run against. Defaults to `EUR`.                                                              |

## License

Apache-2.0
