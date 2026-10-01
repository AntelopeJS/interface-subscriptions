import {
  InterfaceFunction,
  RegisteringProxy,
} from "@antelopejs/interface-core";

import type {
  CancellationTiming,
  Subscription,
  SubscriptionEventHandler,
  SubscriptionRequest,
} from "./types";

/**
 * Starts billing a saved payment method every period.
 *
 * Without a trial or a future billing anchor, the first period is charged
 * before this resolves. A declined first charge creates nothing and rejects
 * with {@link SubscriptionPaymentError}. A first charge that is still settling
 * — a bank debit, say — creates the subscription as `active`; if it then
 * fails, the subscription goes `past_due` like any other failed period.
 *
 * Every charge is an off-session payment-interface payment against
 * `paymentMethod`, carrying {@link SUBSCRIPTION_METADATA_KEY} in its metadata.
 *
 * @param request - Who, what, how often, and when to start
 * @param idempotencyKey - Caller-generated key; replaying it returns the
 *   original subscription, or the original rejection, rather than creating or
 *   charging a second time
 * @param provider - Optional payment account selector, passed through to the
 *   payment interface. Later calls on the subscription must name the same one.
 * @returns The subscription
 * @throws InvalidSubscriptionRequestError if the request is outside the
 *   contract
 * @throws SubscriptionPaymentError if the first period was charged and declined
 */
export const CreateSubscription =
  InterfaceFunction<
    (
      request: SubscriptionRequest,
      idempotencyKey: string,
      provider?: string,
    ) => Promise<Subscription>
  >();

/**
 * Reads a subscription's current state.
 *
 * @param id - Opaque subscription identifier
 * @param provider - Optional payment account selector
 * @returns The subscription
 * @throws SubscriptionNotFoundError if no subscription has that identifier
 */
export const GetSubscription =
  InterfaceFunction<(id: string, provider?: string) => Promise<Subscription>>();

/**
 * Lists a customer's subscriptions, ended ones included.
 *
 * @param customer - Opaque payment-interface customer identifier
 * @param provider - Optional payment account selector
 * @returns The subscriptions, newest first. Empty when there are none.
 */
export const ListSubscriptions =
  InterfaceFunction<
    (customer: string, provider?: string) => Promise<Subscription[]>
  >();

/**
 * Cancels a subscription, now or when the period paid for runs out.
 *
 * Asking for `period_end` on a subscription already set to end then is not an
 * error. Asking for `now` on one set to end at period end ends it now.
 *
 * @param id - Opaque subscription identifier
 * @param idempotencyKey - Caller-generated key; replaying it returns the
 *   subscription rather than raising a state error
 * @param timing - `now`, or `period_end`; see {@link CancellationTiming}
 * @param provider - Optional payment account selector
 * @returns The subscription after the change
 * @throws SubscriptionNotFoundError if no subscription has that identifier
 * @throws InvalidSubscriptionStateError if the subscription has already ended
 */
export const CancelSubscription =
  InterfaceFunction<
    (
      id: string,
      idempotencyKey: string,
      timing: CancellationTiming,
      provider?: string,
    ) => Promise<Subscription>
  >();

/**
 * Charges a different saved method from the next attempt onwards.
 *
 * This is how a `past_due` subscription recovers when the old method will not:
 * save a new one on-session, then switch to it. Nothing is charged by this
 * call; the next scheduled attempt uses the new method.
 *
 * @param id - Opaque subscription identifier
 * @param paymentMethod - Opaque payment-interface identifier of a method saved
 *   against the subscription's customer
 * @param idempotencyKey - Caller-generated key; replaying it is safe
 * @param provider - Optional payment account selector
 * @returns The subscription after the change
 * @throws SubscriptionNotFoundError if no subscription has that identifier
 * @throws InvalidSubscriptionStateError if the subscription has ended
 */
export const UpdateSubscriptionPaymentMethod =
  InterfaceFunction<
    (
      id: string,
      paymentMethod: string,
      idempotencyKey: string,
      provider?: string,
    ) => Promise<Subscription>
  >();

/**
 * Where subscription events are delivered.
 *
 * Register a handler under an identifier unique within your module:
 *
 * ```ts
 * SubscriptionEvents.register("billing", async (event) => { ... });
 * ```
 *
 * Handlers are unregistered when the registering module unloads. Delivery is at
 * least once: an event is delivered again if a handler throws, and may be
 * delivered again after a crash. De-duplicate on
 * {@link SubscriptionEvent.id}. In a cluster, each event is delivered by one
 * instance, to the handlers registered in that instance.
 *
 * How an implementation learns of an event is its own business: the generic
 * fallback raises them from its own clock, and a native provider from the
 * provider's webhooks.
 */
export const SubscriptionEvents = new RegisteringProxy<
  (id: string, handler: SubscriptionEventHandler) => void
>();
