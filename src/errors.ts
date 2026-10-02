import type { Payment } from "@antelopejs/interface-payment";

import type { SubscriptionStatus } from "./types";

/**
 * Base class for every error this interface raises.
 *
 * A failed *renewal* is not an error: it is reported as a `past_due` status
 * and a `subscription.payment_failed` event. These errors mean the call itself
 * did not happen.
 */
export class SubscriptionError extends Error {
  constructor(
    message: string,
    /** The provider's own error code, verbatim and opaque. */
    public readonly providerCode?: string,
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

/**
 * No subscription exists under that identifier, for that provider.
 *
 * Also raised for an identifier that cannot be parsed at all.
 */
export class SubscriptionNotFoundError extends SubscriptionError {
  constructor(id: string, providerCode?: string) {
    super(`No such subscription: ${id}`, providerCode);
    this.name = "SubscriptionNotFoundError";
  }
}

/**
 * The request is malformed, or asks for something outside the portable core:
 * a non-positive amount, an interval count below 1, a trial end in the past,
 * both a trial and a billing anchor, a period longer than the provider allows.
 */
export class InvalidSubscriptionRequestError extends SubscriptionError {
  constructor(message: string, providerCode?: string) {
    super(message, providerCode);
    this.name = "InvalidSubscriptionRequestError";
  }
}

/**
 * The request was well-formed but does not apply to the subscription's current
 * state: cancelling one that has already ended, changing the payment method of
 * one that has ended.
 */
export class InvalidSubscriptionStateError extends SubscriptionError {
  constructor(
    message: string,
    /** The status the subscription was actually in. */
    public readonly status?: SubscriptionStatus,
    providerCode?: string,
  ) {
    super(message, providerCode);
    this.name = "InvalidSubscriptionStateError";
  }
}

/**
 * The first period could not be charged, so no subscription was created.
 *
 * Only {@link CreateSubscription} raises this, and only when it charges at
 * once — no trial, no future billing anchor. Later charges that fail are a
 * `past_due` status, not an error.
 */
export class SubscriptionPaymentError extends SubscriptionError {
  constructor(
    /**
     * The declined payment, as the payment interface reports it: `failed`, or
     * `canceled` where the provider voids the declined attempt when it refuses
     * the subscription (Stripe does). `GetPayment` on its id agrees. The
     * decline reason is in `failure` when `failed`, and in `providerCode`.
     */
    public readonly payment: Payment,
    providerCode?: string,
  ) {
    super(
      `The first period could not be charged: payment ${payment.id} is ${payment.status}`,
      providerCode,
    );
    this.name = "SubscriptionPaymentError";
  }
}
