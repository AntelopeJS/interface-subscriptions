---
name: subscriptions-interface
description: Provider-agnostic AntelopeJS subscriptions — bill a saved payment method every period, with trials, a billing anchor, past_due reporting, cancellation now or at period end, and lifecycle events. Use when code imports "@antelopejs/interface-subscriptions", when an AntelopeJS module sells recurring access or renews anything on a schedule against a payment provider, or when you encounter CreateSubscription, CancelSubscription, UpdateSubscriptionPaymentMethod, SubscriptionEvents, SubscriptionStatus, past_due, or SUBSCRIPTION_METADATA_KEY.
category: antelopejs-interface
tags: [subscriptions, billing, recurring, payment, antelopejs]
---

# subscriptions interface

Recurring billing without a billing cycle in your own module. Every call is an
`InterfaceFunction`, so it is async and queues until an implementation attaches.
This package declares the contract and contains no billing logic.

Implementations: a provider that fires renewals itself implements it natively; for
any other payment-interface provider, wire `@antelopejs/payment-subscriptions`
(it needs `@antelopejs/interface-database`, and uses the Redis scheduler when one
is wired).

## Imports

Add `@antelopejs/interface-subscriptions` and `@antelopejs/interface-payment` to
the module's `dependencies`:

```ts
import {
  CreateSubscription,
  GetSubscription,
  ListSubscriptions,
  CancelSubscription,
  UpdateSubscriptionPaymentMethod,
  SubscriptionEvents,
  isTerminalSubscriptionStatus,
  SubscriptionError,
  SubscriptionNotFoundError,
  InvalidSubscriptionRequestError,
  InvalidSubscriptionStateError,
  SubscriptionPaymentError,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_EVENT_TYPES,
  SUBSCRIPTION_METADATA_KEY,
} from "@antelopejs/interface-subscriptions";
import type {
  Subscription,
  SubscriptionRequest,
  SubscriptionStatus,
  SubscriptionEvent,
  SubscriptionEventHandler,
  CancellationTiming,
} from "@antelopejs/interface-subscriptions";
```

## Five rules that are easy to get wrong

1. **Take the mandate first, on-session.** `CreatePayment` with
   `savePaymentMethod: true` and the payer present, then `ListPaymentMethods`.
   `savePaymentMethod` and `offSession` cannot be combined.
2. **A declined first period throws; a declined renewal does not.** Creation
   rejects with `SubscriptionPaymentError` (and creates nothing). A later failure
   is `status: "past_due"` plus a `subscription.payment_failed` event.
3. **Decide access from `status`, never from a predicted retry date.** The retry
   policy after `past_due` differs per implementation.
4. **Events are at least once.** De-duplicate on `event.id`. Register with an id
   unique within your module; handlers unload with it.
5. **Subscription charges also arrive as `payment.*` webhooks.** Skip any whose
   `payment.metadata[SUBSCRIPTION_METADATA_KEY]` is set; the subscription event is
   the one that says what the charge meant.

## Subscribing

```ts
await CreatePayment(
  {
    amount,
    reference,
    customer,
    paymentMethod: token,
    savePaymentMethod: true,
    returnUrl,
  },
  `save-${accountId}`,
);
const [method] = await ListPaymentMethods(customer);

const subscription = await CreateSubscription(
  {
    reference: accountId,
    customer,
    paymentMethod: method.id,
    amount: { value: 1900, currency: "EUR" },
    interval: "month", // "day" | "week" | "month" | "year"
    intervalCount: 1,
    trialEnd: Date.now() + 14 * 24 * 60 * 60 * 1000, // optional; or billingAnchor, not both
  },
  `subscribe-${accountId}`, // idempotency key: derive it from your record
);
```

Periods count from the anchor in UTC calendar units: anchored on 31 January, it
renews on 28 February, then 31 March.

## Reacting

```ts
SubscriptionEvents.register("billing", async (event) => {
  // "subscription.created" | "subscription.payment_succeeded"
  // | "subscription.payment_failed" | "subscription.canceled"
  await syncAccess(event.subscription.reference, event.subscription.status);
});
```

## Recovering and ending

```ts
await UpdateSubscriptionPaymentMethod(id, newMethodId, key); // next attempt uses it; charges nothing now
await CancelSubscription(id, key, "period_end"); // runs out the paid period
await CancelSubscription(id, key, "now"); // ends now; refunds are RefundPayment's job
```

Changing a subscription that has ended raises `InvalidSubscriptionStateError`.

## Not here, by design

Proration, dunning schedules, tax, coupons, metered billing, several items per
subscription, and writing provider settings through `vendorData` (it is a
read-only echo). For those, use the provider's own interface alongside this one.

## Implementing it

`ImplementInterface(await import("@antelopejs/interface-subscriptions"), impl)`
with the five calls plus `SubscriptionEvents: { register, unregister }`, and list
the package in `antelopeJs.implements`. The conformance suite in `dist/tests`
then runs under `ajs module test`; `docs/4.implementing.md` lists its variables.
