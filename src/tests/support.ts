import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  type Amount,
  CreateCustomer,
  CreatePayment,
  DeleteCustomer,
  GetPayment,
  ListPaymentMethods,
  type Payment,
  isTerminalPaymentStatus,
} from "@antelopejs/interface-payment";

import {
  CreateSubscription,
  SUBSCRIPTION_STATUSES,
  type Subscription,
  type SubscriptionRequest,
} from "../index";

export const SUITE_TIMEOUT = 60_000;
const SETTLE_TIMEOUT = 30_000;
const SETTLE_INTERVAL = 500;
export const PERIOD_VALUE = 1900;
export const RETURN_URL = "https://merchant.invalid/return/subscription";
export const DAY_MS = 24 * 60 * 60 * 1000;
const SHORTEST_MONTH_DAYS = 28;
const LONGEST_MONTH_DAYS = 31;
export const SHORTEST_MONTH_MS = SHORTEST_MONTH_DAYS * DAY_MS;
export const LONGEST_MONTH_MS = LONGEST_MONTH_DAYS * DAY_MS;
export const TRIAL_DAYS = 14;

/**
 * Providers keep creation times and schedule times to the second. Two
 * subscriptions created within the same second may list in either order, and a
 * requested trial end or billing anchor comes back truncated to the second.
 */
export const PROVIDER_CLOCK_RESOLUTION_MS = 1100;
const SECOND_MS = 1000;

/** A time `ahead` from now, on a whole second, which every provider can echo exactly. */
export function inWholeSeconds(ahead: number): number {
  return Math.floor((Date.now() + ahead) / SECOND_MS) * SECOND_MS;
}

/** An identifier no provider has a subscription for. */
export const ABSENT_ID = `antelope-absent-${"0".repeat(24)}`;

/**
 * A provider-specific token that the payment interface charges successfully
 * on-session with `savePaymentMethod`, and whose saved method it then charges
 * off-session. The same variable the payment interface's suite reads.
 */
export const TEST_METHOD = process.env.ANTELOPE_PAYMENT_TEST_METHOD;

/**
 * A provider-specific token that saves on-session, and whose saved method the
 * provider declines off-session.
 *
 * There is no portable way to obtain one. Without it, the declined-first-period
 * test is skipped.
 */
export const TEST_METHOD_DECLINES_LATER =
  process.env.ANTELOPE_SUBSCRIPTIONS_TEST_METHOD_DECLINES_LATER;

/**
 * Set when the implementation's events can reach this process during a test
 * run. A native provider delivers them from webhooks, which a test container
 * cannot usually receive; the generic fallback raises them in-process.
 */
export const EVENTS_OBSERVABLE = Boolean(
  process.env.ANTELOPE_SUBSCRIPTIONS_TEST_EVENTS,
);

const CURRENCY = process.env.ANTELOPE_PAYMENT_TEST_CURRENCY || "EUR";

export const CHARGEABLE = "requires ANTELOPE_PAYMENT_TEST_METHOD";
export const DECLINES_LATER =
  "requires ANTELOPE_SUBSCRIPTIONS_TEST_METHOD_DECLINES_LATER";
export const OBSERVABLE = "requires ANTELOPE_SUBSCRIPTIONS_TEST_EVENTS";

export function amount(value: number): Amount {
  return { value, currency: CURRENCY };
}

export function key(): string {
  return `antelope-conformance-${randomUUID()}`;
}

export function reference(): string {
  return `conformance-${randomUUID()}`;
}

const EPOCH_MILLIS_FLOOR = Date.UTC(2020, 0, 1);
const CLOCK_SKEW_ALLOWANCE = 5 * 60 * 1000;

/**
 * Asserts a timestamp is epoch milliseconds rather than epoch seconds, and is
 * not further from now than `horizon` allows.
 */
export function assertEpochMillis(
  value: number,
  label: string,
  horizon = CLOCK_SKEW_ALLOWANCE,
): void {
  assert.ok(Number.isInteger(value), `${label} must be an integer`);
  assert.ok(
    value > EPOCH_MILLIS_FLOOR,
    `${label} is ${value}, which is not epoch milliseconds (seconds, perhaps?)`,
  );
  assert.ok(
    value < Date.now() + horizon,
    `${label} is ${value}, further ahead than expected`,
  );
}

/**
 * Asserts the invariants every subscription holds, whatever its state.
 */
export function assertSubscriptionShape(
  subscription: Subscription,
  request: SubscriptionRequest,
): void {
  assert.ok(subscription.id.length > 0, "subscription id must be non-empty");
  assert.ok(
    SUBSCRIPTION_STATUSES.includes(subscription.status),
    `status ${subscription.status} is outside the contract`,
  );
  assert.equal(subscription.reference, request.reference);
  assert.equal(subscription.customer, request.customer);
  assert.equal(subscription.interval, request.interval);
  assert.equal(subscription.intervalCount, request.intervalCount ?? 1);
  assert.deepEqual(subscription.amount, request.amount);
  assert.equal(typeof subscription.cancelAtPeriodEnd, "boolean");
  assertEpochMillis(subscription.createdAt, "createdAt");
  assertEpochMillis(subscription.currentPeriodStart, "currentPeriodStart");
  assertEpochMillis(
    subscription.currentPeriodEnd,
    "currentPeriodEnd",
    400 * DAY_MS,
  );
  assert.ok(
    subscription.currentPeriodEnd > subscription.currentPeriodStart,
    "a period must end after it starts",
  );
  const isCanceled = subscription.status === "canceled";
  assert.equal(
    subscription.endedAt !== undefined,
    isCanceled,
    "endedAt is present exactly when the subscription has ended",
  );
  assert.equal(
    subscription.endReason !== undefined,
    isCanceled,
    "endReason is present exactly when the subscription has ended",
  );
}

/**
 * Polls until the payment leaves `pending`, the only status an off-session
 * charge can sit in.
 */
export async function settledPayment(id: string): Promise<Payment> {
  const deadline = Date.now() + SETTLE_TIMEOUT;
  let payment = await GetPayment(id);
  while (!isTerminalPaymentStatus(payment.status) && Date.now() < deadline) {
    await delay(SETTLE_INTERVAL);
    payment = await GetPayment(id);
  }
  return payment;
}

const customers: string[] = [];

after(async () => {
  await Promise.all(
    customers.map((id) => DeleteCustomer(id, key()).catch(() => undefined)),
  );
});

/**
 * A customer with a method saved the only way the contract allows: an
 * on-session payment that saves it, taken with the payer present.
 */
export interface Payer {
  customer: string;
  paymentMethod: string;
}

export async function newPayer(token = TEST_METHOD): Promise<Payer> {
  const customer = await CreateCustomer(
    { email: `${randomUUID()}@merchant.invalid`, name: "Conformance Payer" },
    key(),
  );
  customers.push(customer.id);
  return {
    customer: customer.id,
    paymentMethod: await saveMethod(customer.id, token),
  };
}

/** Saves another method against an existing customer and returns its id. */
export async function saveMethod(
  customer: string,
  token = TEST_METHOD,
): Promise<string> {
  const before = await ListPaymentMethods(customer);
  const payment = await CreatePayment(
    {
      amount: amount(PERIOD_VALUE),
      reference: reference(),
      customer,
      paymentMethod: token,
      savePaymentMethod: true,
      returnUrl: RETURN_URL,
    },
    key(),
  );
  const settled = await settledPayment(payment.id);
  assert.equal(settled.status, "succeeded", "the saving payment must succeed");
  const known = new Set(before.map((method) => method.id));
  const saved = (await ListPaymentMethods(customer)).find(
    (method) => !known.has(method.id),
  );
  assert.ok(saved, "the saving payment must leave a method saved");
  return saved.id;
}

export function monthly(
  payer: Payer,
  overrides: Partial<SubscriptionRequest> = {},
): SubscriptionRequest {
  return {
    reference: reference(),
    customer: payer.customer,
    paymentMethod: payer.paymentMethod,
    amount: amount(PERIOD_VALUE),
    interval: "month",
    description: "Conformance subscription",
    ...overrides,
  };
}

export async function subscribe(
  payer: Payer,
  overrides: Partial<SubscriptionRequest> = {},
): Promise<Subscription> {
  const request = monthly(payer, overrides);
  const subscription = await CreateSubscription(request, key());
  assertSubscriptionShape(subscription, request);
  return subscription;
}

/**
 * Asserts that a call rejects with exactly the given error class, rather than
 * any Error at all.
 */
export async function rejectsWith(
  work: Promise<unknown>,
  expected: abstract new (...args: never[]) => Error,
  label: string,
): Promise<Error> {
  const error = await work.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  assert.ok(
    error instanceof expected,
    `${label}: expected ${expected.name}, got ${String(error)}`,
  );
  return error;
}
