import type { Printed } from "./journey-kit.ts";

export const STATUS_SCRIPT = `
const mutation = (list) => { try { list.push("invented"); return "pushed"; } catch (error) { return error.name; } };
console.log(JSON.stringify({
  statuses: [...c.SUBSCRIPTION_STATUSES],
  terminal: c.SUBSCRIPTION_STATUSES.map((status) => [status, c.isTerminalSubscriptionStatus(status)]),
  reasons: [...c.SUBSCRIPTION_END_REASONS],
  frozen: [Object.isFrozen(c.SUBSCRIPTION_STATUSES), Object.isFrozen(c.SUBSCRIPTION_END_REASONS)],
  push: [mutation(c.SUBSCRIPTION_STATUSES), mutation(c.SUBSCRIPTION_END_REASONS)],
  afterPush: [...c.SUBSCRIPTION_STATUSES].length,
  unknown: c.isTerminalSubscriptionStatus("deleted"),
}));
`;

export const STATUS_EXPECTED: Printed = {
  statuses: ["trialing", "active", "past_due", "canceled"],
  terminal: [
    ["trialing", false],
    ["active", false],
    ["past_due", false],
    ["canceled", true],
  ],
  reasons: ["requested", "payment_failed"],
  frozen: [true, true],
  push: ["TypeError", "TypeError"],
  afterPush: 4,
  unknown: false,
};

export const VOCABULARY_SCRIPT = `
const mutation = (list) => { try { list.push("invented"); return "pushed"; } catch (error) { return error.name; } };
console.log(JSON.stringify({
  intervals: [...c.SUBSCRIPTION_INTERVALS],
  timings: [...c.CANCELLATION_TIMINGS],
  events: [...c.SUBSCRIPTION_EVENT_TYPES],
  metadataKey: c.SUBSCRIPTION_METADATA_KEY,
  maxPeriodDays: c.MAX_PORTABLE_PERIOD_DAYS,
  frozen: [c.SUBSCRIPTION_INTERVALS, c.CANCELLATION_TIMINGS, c.SUBSCRIPTION_EVENT_TYPES].map(Object.isFrozen),
  push: [c.SUBSCRIPTION_INTERVALS, c.CANCELLATION_TIMINGS, c.SUBSCRIPTION_EVENT_TYPES].map(mutation),
}));
`;

export const VOCABULARY_EXPECTED: Printed = {
  intervals: ["day", "week", "month", "year"],
  timings: ["now", "period_end"],
  events: ["subscription.created", "subscription.payment_succeeded", "subscription.payment_failed", "subscription.canceled"],
  metadataKey: "antelopeSubscription",
  maxPeriodDays: 366,
  frozen: [true, true, true],
  push: ["TypeError", "TypeError", "TypeError"],
};

export const ERROR_SCRIPT = `
const declined = { id: "pay_1", status: "failed", amount: { value: 1900, currency: "EUR" } };
const describe = (error) => ({
  name: error.name,
  message: error.message,
  providerCode: error.providerCode ?? null,
  base: error instanceof c.SubscriptionError,
  error: error instanceof Error,
});
const missing = new c.SubscriptionNotFoundError("sub_1", "resource_missing");
const invalid = new c.InvalidSubscriptionRequestError("amount must be positive", "parameter_invalid");
const state = new c.InvalidSubscriptionStateError("already ended", "canceled", "state_conflict");
const stateBare = new c.InvalidSubscriptionStateError("already ended");
const payment = new c.SubscriptionPaymentError(declined, "card_declined");
const paymentBare = new c.SubscriptionPaymentError({ ...declined, status: "canceled" });
const base = new c.SubscriptionError("could not call", "network");
console.log(JSON.stringify({
  base: describe(base),
  missing: describe(missing),
  missingBare: new c.SubscriptionNotFoundError("sub_2").providerCode ?? null,
  invalid: describe(invalid),
  siblings: [missing instanceof c.InvalidSubscriptionRequestError, invalid instanceof c.SubscriptionNotFoundError, state instanceof c.SubscriptionPaymentError],
  state: { ...describe(state), status: state.status },
  stateBare: { status: stateBare.status ?? null, providerCode: stateBare.providerCode ?? null },
  payment: { ...describe(payment), carried: payment.payment === declined, status: payment.payment.status },
  paymentBare: { message: paymentBare.message, providerCode: paymentBare.providerCode ?? null },
}));
`;

export const described = (name: string, message: string, providerCode: string | null) => ({
  name,
  message,
  providerCode,
  base: true,
  error: true,
});

export const ERROR_EXPECTED: Printed = {
  base: described("SubscriptionError", "could not call", "network"),
  missing: described("SubscriptionNotFoundError", "No such subscription: sub_1", "resource_missing"),
  missingBare: null,
  invalid: described("InvalidSubscriptionRequestError", "amount must be positive", "parameter_invalid"),
  siblings: [false, false, false],
  state: { ...described("InvalidSubscriptionStateError", "already ended", "state_conflict"), status: "canceled" },
  stateBare: { status: null, providerCode: null },
  payment: {
    ...described("SubscriptionPaymentError", "The first period could not be charged: payment pay_1 is failed", "card_declined"),
    carried: true,
    status: "failed",
  },
  paymentBare: { message: "The first period could not be charged: payment pay_1 is canceled", providerCode: null },
};
