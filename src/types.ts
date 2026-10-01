import type { Amount } from "@antelopejs/interface-payment";

/**
 * Every value {@link SubscriptionInterval} can take.
 */
export const SUBSCRIPTION_INTERVALS = Object.freeze([
  "day",
  "week",
  "month",
  "year",
] as const);

/**
 * The unit a billing period is counted in.
 *
 * Calendar units are calendar units: a `month` period that starts on 31 January
 * ends on the last day of February, and the one after it ends on 31 March. The
 * day of the month comes from the billing anchor, not from the end of the
 * previous period, so short months do not drift the cycle.
 */
export type SubscriptionInterval = (typeof SUBSCRIPTION_INTERVALS)[number];

/**
 * The longest billing period every implementation must accept: one year.
 *
 * Providers cap the period differently. A request for a longer one may be
 * refused with {@link InvalidSubscriptionRequestError}.
 */
export const MAX_PORTABLE_PERIOD_DAYS = 366;

/**
 * Every value {@link SubscriptionStatus} can take, in lifecycle order.
 */
export const SUBSCRIPTION_STATUSES = Object.freeze([
  "trialing",
  "active",
  "past_due",
  "canceled",
] as const);

/**
 * Normalised subscription status.
 *
 * | Status | Meaning |
 * | --- | --- |
 * | `trialing` | Before {@link Subscription.trialEnd}. Nothing has been charged. |
 * | `active` | The current period is paid for, or not yet due. |
 * | `past_due` | Charging the current period failed. The implementation is retrying under its own policy. |
 * | `canceled` | Ended. Terminal: nothing is charged again. |
 *
 * `past_due` is reported the same way everywhere, but what happens next is
 * not portable: native providers follow their configured retry schedule, and
 * the generic fallback follows its documented policy. Decide access by status;
 * do not predict when a `past_due` subscription will recover or end.
 */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Whether a subscription has ended for good.
 *
 * @param status - The status to classify
 * @returns true for `canceled` only
 */
export function isTerminalSubscriptionStatus(
  status: SubscriptionStatus,
): boolean {
  return status === "canceled";
}

/**
 * Every value {@link SubscriptionEndReason} can take.
 */
export const SUBSCRIPTION_END_REASONS = Object.freeze([
  "requested",
  "payment_failed",
] as const);

/**
 * Why a subscription ended: someone cancelled it, or the implementation gave up
 * charging it.
 */
export type SubscriptionEndReason = (typeof SUBSCRIPTION_END_REASONS)[number];

/**
 * Every value {@link CancellationTiming} can take.
 */
export const CANCELLATION_TIMINGS = Object.freeze([
  "now",
  "period_end",
] as const);

/**
 * When {@link CancelSubscription} takes effect.
 *
 * - `now` ends the subscription immediately. Nothing is refunded: a refund is a
 *   separate `RefundPayment` through the payment interface.
 * - `period_end` lets the period that has been paid for run out, and ends the
 *   subscription then instead of renewing it. The status does not change until
 *   it ends.
 */
export type CancellationTiming = (typeof CANCELLATION_TIMINGS)[number];

/**
 * A subscription, in whatever state it was last reported in.
 *
 * `id` is opaque. Correlate with your own records through
 * {@link Subscription.reference}.
 */
export interface Subscription {
  /** Opaque identifier. */
  id: string;
  /** The caller's own identifier, echoed back from the request. */
  reference: string;
  /** Opaque payment-interface customer identifier. */
  customer: string;
  /** Opaque payment-interface identifier of the saved method charged. */
  paymentMethod: string;
  /** Charged once per period. */
  amount: Amount;
  /** The unit a period is counted in. */
  interval: SubscriptionInterval;
  /** How many `interval`s make one period. At least 1. */
  intervalCount: number;
  /** Normalised status. */
  status: SubscriptionStatus;
  /**
   * Unix epoch milliseconds. Start of the period most recently billed for, or
   * of the trial or pre-anchor period before the first charge.
   */
  currentPeriodStart: number;
  /**
   * Unix epoch milliseconds. When the current period ends and the next one is
   * charged, unless {@link Subscription.cancelAtPeriodEnd} is set.
   */
  currentPeriodEnd: number;
  /** Unix epoch milliseconds. Present when the subscription began with a trial. */
  trialEnd?: number;
  /** The subscription ends at `currentPeriodEnd` instead of renewing. */
  cancelAtPeriodEnd: boolean;
  /** Unix epoch milliseconds. Present exactly when `status` is `canceled`. */
  endedAt?: number;
  /** Present exactly when `status` is `canceled`. */
  endReason?: SubscriptionEndReason;
  /**
   * Opaque payment-interface identifier of the most recent charge attempt.
   * Absent until something has been charged.
   */
  latestPayment?: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** The metadata the subscription was created with. */
  metadata?: Record<string, string>;
  /**
   * What the provider said about this subscription, verbatim, for logs and
   * support tickets.
   *
   * Read-only. Nothing a caller does with this object reaches the provider, and
   * no request type accepts it: provider-specific behaviour belongs in the
   * provider's own interface, where the coupling is visible.
   */
  vendorData?: Readonly<Record<string, unknown>>;
}

/**
 * Parameters for {@link CreateSubscription}.
 *
 * The payer is not present. Take the mandate first, with an on-session
 * payment-interface payment that sets `savePaymentMethod`, and pass the method
 * it saved.
 */
export interface SubscriptionRequest {
  /** Your own identifier for this subscription. */
  reference: string;
  /** Opaque payment-interface customer identifier. */
  customer: string;
  /**
   * Opaque payment-interface identifier of a method saved against `customer`
   * and chargeable off-session, from `ListPaymentMethods`.
   */
  paymentMethod: string;
  /** Charged once per period. A positive integer of minor units. */
  amount: Amount;
  /** The unit a period is counted in. */
  interval: SubscriptionInterval;
  /** How many `interval`s make one period. Defaults to 1. */
  intervalCount?: number;
  /**
   * Unix epoch milliseconds. Start with a free trial that ends here; the first
   * charge is made at this time. Must be in the future. Mutually exclusive with
   * `billingAnchor`.
   */
  trialEnd?: number;
  /**
   * Unix epoch milliseconds. Start the first paid period here rather than now;
   * nothing is charged before it, and the status is `active` meanwhile. Must
   * be in the future. Mutually exclusive with `trialEnd`.
   */
  billingAnchor?: number;
  /** Shown to the payer where supported. */
  description?: string;
  /** Round-tripped opaque key/value pairs. */
  metadata?: Record<string, string>;
}

/**
 * Every value {@link SubscriptionEventType} can take.
 */
export const SUBSCRIPTION_EVENT_TYPES = Object.freeze([
  "subscription.created",
  "subscription.payment_succeeded",
  "subscription.payment_failed",
  "subscription.canceled",
] as const);

/**
 * Normalised subscription event type.
 *
 * | Type | When |
 * | --- | --- |
 * | `subscription.created` | The subscription exists. |
 * | `subscription.payment_succeeded` | A period was paid for, including the first. |
 * | `subscription.payment_failed` | Charging a period failed; the status is `past_due`. |
 * | `subscription.canceled` | The subscription ended, for any {@link SubscriptionEndReason}. |
 */
export type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];

/**
 * Something that happened to a subscription, normalised.
 *
 * Delivered at least once. De-duplicate on {@link SubscriptionEvent.id}.
 */
export interface SubscriptionEvent {
  /** Opaque identifier, stable across redeliveries of the same event. */
  id: string;
  /** Normalised type. */
  type: SubscriptionEventType;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** The subscription as it was when the event happened. */
  subscription: Subscription;
  /**
   * Opaque payment-interface identifier of the charge behind a
   * `subscription.payment_*` event. Read it with `GetPayment`.
   */
  payment?: string;
}

/**
 * Receives subscription events.
 *
 * A rejection, or a throw, means the event was not handled and will be
 * delivered again.
 */
export type SubscriptionEventHandler = (
  event: SubscriptionEvent,
) => void | Promise<void>;

/**
 * The metadata key every charge made for a subscription carries, set to the
 * subscription's identifier.
 *
 * Those charges are ordinary payment-interface payments, so their
 * `payment.*` events reach your payment webhook route as well. Use this key to
 * tell them from one-off payments.
 */
export const SUBSCRIPTION_METADATA_KEY = "antelopeSubscription";
