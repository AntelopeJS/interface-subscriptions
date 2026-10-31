# @antelopejs/interface-subscriptions

<div align="center">
<a href="https://www.npmjs.com/package/@antelopejs/interface-subscriptions"><img alt="npm" src="https://img.shields.io/npm/v/@antelopejs/interface-subscriptions?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@antelopejs/interface-subscriptions?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="https://discord.gg/kxzZMWqdFU"><img alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000"></a>
<a href="./docs/1.introduction.md"><img alt="Docs" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000"></a>
</div>

Provider-agnostic subscriptions for AntelopeJS. Bill a saved payment method
every period — with trials, a billing anchor, cancellation now or at period end,
and `past_due` reporting — without naming a provider, and without every
consumer rebuilding a billing cycle of its own.

## Installation

```bash
pnpm add @antelopejs/interface-subscriptions
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

For Stripe, native subscriptions in `@antelopejs/stripe` are recommended.
`@antelopejs/payment-subscriptions` is an explicit alternative, not an automatic
fallback. Wire one renewal owner per subscription, never both.

## Choose a task

- Start or cancel recurring access: [subscriptions](./docs/2.subscriptions.md).
- Synchronize access after billing: [events](./docs/3.events.md).
- Implement a billing provider: [implementation guide](./docs/4.implementing.md).
- Choose native or generic billing: [provider capabilities](./docs/5.provider-capability-matrix.md).

Replay protection lasts only for the provider-defined replay window. Persist
operation keys, subscription IDs and payment IDs. After expiration, applications
must reconcile uncertain payments with provider records before retrying; reusing
a key is not indefinite duplicate-charge protection.

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

```ts docs-check
import {
  CreatePayment,
  GetPayment,
  ListPaymentMethods,
} from "@antelopejs/interface-payment";
import { CreateSubscription } from "@antelopejs/interface-subscriptions";

// 1. Take the mandate with a separate €1 on-session payment.
export async function startSignup(
  customer: string,
  token: string,
  signupId: string,
) {
  const payment = await CreatePayment(
    {
      amount: { value: 100, currency: "EUR" },
      reference: signupId,
      customer,
      paymentMethod: token,
      savePaymentMethod: true,
      returnUrl: "https://shop.example/billing/return",
    },
    `save-${signupId}`,
  );

  // The route must redirect the payer when this URL is returned.
  return {
    paymentId: payment.id,
    status: payment.status,
    redirectUrl:
      payment.status === "requires_action" ? payment.redirectUrl : undefined,
  };
}

// 2. Resume from trusted server state, not the browser's claimed outcome.
export async function finishSignup(paymentId: string, accountId: string) {
  const payment = await GetPayment(paymentId);
  if (payment.status !== "succeeded" && payment.status !== "authorized") {
    return undefined; // Still pending/action required, or failed/canceled: do not subscribe.
  }
  if (!payment.customer) throw new Error("Signup payment has no customer");

  const methods = await ListPaymentMethods(payment.customer);
  const method = methods.find((saved) => saved.id === payment.paymentMethod);
  if (!method) throw new Error("Signup payment has no saved method");

  return CreateSubscription(
    {
      reference: accountId,
      customer: payment.customer,
      paymentMethod: method.id,
      amount: { value: 1900, currency: "EUR" },
      interval: "month",
    },
    `subscribe-${payment.id}`,
  );
}
```

Use an existing payment-interface customer and a provider-issued method token.
Persist a unique `signupId` and the returned `paymentId` against the authenticated
account. Replace the return URL with your own route and send the payer to
`redirectUrl` when action is required. If the payment is pending, wait for a
verified `payment.succeeded` or `payment.authorized` webhook before retrying
`finishSignup`; failed or canceled payments must not create subscriptions.

Call `finishSignup` with the saved payment ID and account ID, using the same
provider account throughout. The saved-method payment and the first subscription
period are separate charges (€1 then €19 here); the first period is charged
off-session before `CreateSubscription` resolves. Adapt those amounts to your
billing policy. Register an idempotent handler for subsequent lifecycle events:

```ts
import { SubscriptionEvents } from "@antelopejs/interface-subscriptions";

SubscriptionEvents.register("billing", async (event) => {
  await grantOrRevokeAccess(event.subscription);
});
```

`grantOrRevokeAccess` stands for your application's access policy. Deduplicate
events by `event.id` as described in [Events](./docs/3.events.md).

## Compatibility

<!-- docs-compat: ./package.json#peerDependencies -->

| Package                         | Range            |
| ------------------------------- | ---------------- |
| `@antelopejs/interface-core`    | `>=0.0.5 <1.0.0` |
| `@antelopejs/interface-payment` | `>=0.0.2 <1.0.0` |

These are the peer requirements in `package.json`. Development uses the same
payment-interface semver range. Check your implementing module's requirements
too. `@antelopejs/core` 1.16.0 is a development test runner, not a runtime peer.

## Conventions

- **Built on the payment interface's portable pair**: one on-session payment that
  saves a method, then off-session charges. Customers, methods and payments are
  `@antelopejs/interface-payment` identifiers from the same account.
- **An idempotency key on every mutating call**, positionally.
- **A declined renewal is a status, not an exception.** Only a declined _first_
  period rejects, with `SubscriptionPaymentError`, and creates nothing.
- **`past_due` is portable to report; the retry policy is not.**
- **`vendorData` is a read-only echo of JSON values.** No request accepts it.
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

## Development

Use Node.js 24 and pnpm 10.6.5. Install the published payment interface from npm using the frozen lockfile:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm format:check
pnpm knip
```

CI runs the same checks against the published dependency without Git submodules or workspace overrides.

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

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and run the [development checks](#development) before opening a pull request. Local contract tests do not require provider credentials; the provider conformance suite is a separate integration check.

## License

[Apache-2.0](./LICENSE)
