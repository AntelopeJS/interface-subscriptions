# `@antelopejs/interface-subscriptions`

<div align="center">
<a href="https://www.npmjs.com/package/@antelopejs/interface-subscriptions"><img data-illustration alt="npm" src="https://img.shields.io/npm/v/@antelopejs/interface-subscriptions?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="./LICENSE"><img data-illustration alt="License" src="https://img.shields.io/npm/l/@antelopejs/interface-subscriptions?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="https://discord.gg/g4pFt6eXqu"><img data-illustration alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000"></a>
<a href="./docs/1.introduction.md"><img data-illustration alt="Docs" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000"></a>
</div>

The AntelopeJS interface for subscriptions that work with any payment provider.
Bill a saved payment method every period, with trials, a billing anchor,
cancellation now or at period end, and `past_due` reporting. Your code names no
provider, and no consumer has to build a billing cycle of its own.

## Installation

```bash
pnpm add @antelopejs/interface-subscriptions
```

This package declares the contract and ships no billing logic. Wire a module
that implements it:

- A payment module whose provider fires renewals itself implements it natively
  (Stripe, PayPal, Mollie).
- For any other `@antelopejs/interface-payment` provider, wire
  `@antelopejs/payment-subscriptions`. It runs the renewal clock itself, with
  saved methods and off-session charges.

A payment module that cannot do subscriptions does not implement this
interface. No implementation keeps only part of the contract, and the interface
has no `UnsupportedOperationError`.

For Stripe, use the native subscriptions in `@antelopejs/stripe`.
`@antelopejs/payment-subscriptions` is an alternative you choose explicitly. It
does not take over automatically. Wire one renewal owner per subscription, never
both.

## Choose a task

- Start or cancel recurring access: [subscriptions](./docs/2.subscriptions.md).
- Synchronize access after billing: [events](./docs/3.events.md).
- Implement a billing provider: [implementation guide](./docs/4.implementing.md).
- Choose native or generic billing: [provider capabilities](./docs/5.provider-capability-matrix.md).

Replay protection lasts only for the replay window that the provider defines.
Persist operation keys, subscription IDs, and payment IDs. After the window
expires, reconcile uncertain payments with the provider records before you
retry. A reused key does not protect against duplicate charges forever.

## What it covers

| Area      | Functions                                                       |
| --------- | --------------------------------------------------------------- |
| Lifecycle | `CreateSubscription`, `CancelSubscription`                      |
| Reading   | `GetSubscription`, `ListSubscriptions`                          |
| Recovery  | `UpdateSubscriptionPaymentMethod`                               |
| Events    | `SubscriptionEvents` (a registering proxy, not a webhook route) |

The portable core is small on purpose. It covers the amount, the interval and
interval count, the billing anchor, the trial end, the status including
`past_due`, cancellation now or at period end, and the current period.
Proration, dunning schedules, tax, coupons, metered billing, and multiple items
per subscription are out. The generic fallback cannot honour them, and a
contract that only some implementations keep misleads its callers. For those
features, use the provider's own interface.

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
    return undefined; // pending, requires_action, failed, or canceled: do not subscribe.
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

Use an existing payment-interface customer and a method token that the
provider issued. Persist a unique `signupId` and the returned `paymentId`
against the authenticated account. Replace the return URL with your own route.
When action is required, send the payer to `redirectUrl`. If the payment is
pending, wait for a verified `payment.succeeded` or `payment.authorized` webhook
before you retry `finishSignup`. A failed or canceled payment must not create a
subscription.

Call `finishSignup` with the saved payment ID and the account ID, and use the
same provider account throughout. The payment that saves the method and the
first subscription period are separate charges, €1 then €19 here. The
implementation charges the first period off-session before `CreateSubscription`
resolves. Adapt those amounts to your billing policy. Register an idempotent
handler for later lifecycle events:

```ts
import {
  SubscriptionEvents,
  type Subscription,
} from "@antelopejs/interface-subscriptions";

declare function grantOrRevokeAccess(subscription: Subscription): Promise<void>;

SubscriptionEvents.register("billing", async (event) => {
  await grantOrRevokeAccess(event.subscription);
});
```

`grantOrRevokeAccess` stands for your application's access policy, and its
`declare` line only gives it a type. Deduplicate events by `event.id`, as
[Events](./docs/3.events.md) describes.

## Compatibility

<!-- antelopejs-docs-compat:start -->

| Package                         | Supported        | Tested with |
| ------------------------------- | ---------------- | ----------- |
| `@antelopejs/interface-core`    | `>=0.0.5 <1.0.0` | `0.1.1`     |
| `@antelopejs/interface-payment` | `>=0.0.2 <1.0.0` | `0.0.2`     |

<!-- antelopejs-docs-compat:end -->

The table lists the peer requirements in `package.json`. Development uses the
same semver range for the payment interface. Check the requirements of your
implementing module too. `@antelopejs/core` is a test runner for development,
not a runtime peer.

## Conventions

- **Built on the portable pair of the payment interface.** One on-session
  payment saves a method, then off-session charges use it. Customers, methods,
  and payments are `@antelopejs/interface-payment` identifiers from the same
  account.
- **An idempotency key on every mutating call.** It is a positional argument.
- **A declined renewal is a status, not an exception.** Only a declined _first_
  period rejects, with `SubscriptionPaymentError`, and creates nothing.
- **`past_due` is portable to report.** The retry policy is not portable.
- **`vendorData` is a read-only echo of JSON values.** No request accepts it.
- **An optional trailing `provider` selects the payment account.** The payment
  interface uses the same argument.

## Documentation

| Document                                                             | Contents                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Introduction](./docs/1.introduction.md)                             | Why a second interface, who fires renewals, the portable core |
| [Subscriptions](./docs/2.subscriptions.md)                           | Creation, periods, trials and anchors, statuses, cancellation |
| [Events](./docs/3.events.md)                                         | The event set, delivery, and the relation to payment webhooks |
| [Implementing](./docs/4.implementing.md)                             | Native and fallback implementations, the conformance suite    |
| [Provider capability matrix](./docs/5.provider-capability-matrix.md) | Which providers fire renewals themselves, and what that means |

## Development

Use the Node.js version in `.nvmrc` and the pnpm version in the `packageManager`
field of `package.json`. Install the published payment interface from npm with
the frozen lockfile:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm format:check
pnpm knip
```

CI runs the same checks against the published dependency, without Git
submodules or workspace overrides.

## Conformance suite

`src/tests/` ships in the package as `dist/tests` and runs against whichever
module implements the interface. It checks much less than the payment suite, on
purpose. A test cannot wait a month for a renewal. For a native provider, the
suite covers creation, reading, cancellation, method changes, and request
validation, but not renewals. The generic fallback has its own suite, which
drives an injected clock through every renewal path. That suite is the
executable specification for the rest.

| Variable                                            | Purpose                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ANTELOPE_PAYMENT_TEST_METHOD`                      | A token that saves on-session and charges off-session. Without it, everything but the unknown-id tests skips. |
| `ANTELOPE_SUBSCRIPTIONS_TEST_METHOD_DECLINES_LATER` | A token that saves on-session and is declined off-session. Without it, the declined-first-period tests skip.  |
| `ANTELOPE_SUBSCRIPTIONS_TEST_EVENTS`                | Set when events can reach the test process. A native provider delivers them by webhook, which usually cannot. |
| `ANTELOPE_PAYMENT_TEST_CURRENCY`                    | ISO-4217 code to run against. Defaults to `EUR`.                                                              |

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and run the
[development checks](#development) before you open a pull request. The local
contract tests need no provider credentials. The provider conformance suite is a
separate integration check.

## License

[Apache-2.0](./LICENSE)
