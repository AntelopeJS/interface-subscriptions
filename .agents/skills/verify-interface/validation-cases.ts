import type { Printed } from "./journey-kit.ts";

export const FIELD_CASES = `
const cases = {
  base: verdict(base),
  referenceEmpty: refused({ ...base, reference: "" }),
  referenceMissing: refused({ ...base, reference: undefined }),
  customerEmpty: refused({ ...base, customer: "" }),
  methodEmpty: refused({ ...base, paymentMethod: "" }),
  amountZero: refused({ ...base, amount: { value: 0, currency: "EUR" } }),
  amountNegative: refused({ ...base, amount: { value: -5, currency: "EUR" } }),
  amountFraction: refused({ ...base, amount: { value: 19.5, currency: "EUR" } }),
  amountNaN: refused({ ...base, amount: { value: NaN, currency: "EUR" } }),
  amountText: refused({ ...base, amount: { value: "1900", currency: "EUR" } }),
  amountMissing: refused({ ...base, amount: undefined }),
  currencyLower: refused({ ...base, amount: { value: 1900, currency: "eur" } }),
  currencyLong: refused({ ...base, amount: { value: 1900, currency: "EURO" } }),
  currencyShort: refused({ ...base, amount: { value: 1900, currency: "EU" } }),
  currencyEmpty: refused({ ...base, amount: { value: 1900, currency: "" } }),
  currencyUnlisted: refused({ ...base, amount: { value: 1, currency: "ZZZ" } }),
  smallestAmount: refused({ ...base, amount: { value: 1, currency: "JPY" } }),
  errorKind: verdict({ ...base, reference: "" }),
};
console.log(JSON.stringify(cases));
`;

export const FIELD_EXPECTED: Printed = {
  base: "accepted",
  referenceEmpty: "reference must be a non-empty string",
  referenceMissing: "reference must be a non-empty string",
  customerEmpty: "customer is required",
  methodEmpty: "paymentMethod is required",
  amountZero: "amount must be a positive integer of minor units",
  amountNegative: "amount must be a positive integer of minor units",
  amountFraction: "amount must be a positive integer of minor units",
  amountNaN: "amount must be a positive integer of minor units",
  amountText: "amount must be a positive integer of minor units",
  amountMissing: "amount must be a positive integer of minor units",
  currencyLower: "amount.currency must be an uppercase ISO-4217 code",
  currencyLong: "amount.currency must be an uppercase ISO-4217 code",
  currencyShort: "amount.currency must be an uppercase ISO-4217 code",
  currencyEmpty: "amount.currency must be an uppercase ISO-4217 code",
  currencyUnlisted: "accepted",
  smallestAmount: "accepted",
  errorKind: ["InvalidSubscriptionRequestError", "reference must be a non-empty string", true, true, true],
};

export const ORDER_CASES = `
const broken = { reference: "", customer: "", paymentMethod: "", amount: { value: 0, currency: "x" }, interval: "x", intervalCount: 0, trialEnd: 1, billingAnchor: 2 };
const order = [];
let request = broken;
for (const key of ["reference", "customer", "paymentMethod", "amount", "currency", "interval", "intervalCount", "trialEnd"]) {
  order.push(refused(request, NOW));
  if (key === "reference") request = { ...request, reference: "r" };
  if (key === "customer") request = { ...request, customer: "c" };
  if (key === "paymentMethod") request = { ...request, paymentMethod: "m" };
  if (key === "amount") request = { ...request, amount: { value: 1, currency: "x" } };
  if (key === "currency") request = { ...request, amount: { value: 1, currency: "EUR" } };
  if (key === "interval") request = { ...request, interval: "day" };
  if (key === "intervalCount") request = { ...request, intervalCount: 1 };
  if (key === "trialEnd") request = { ...request, billingAnchor: undefined };
}
order.push(refused(request, NOW));
console.log(JSON.stringify(order));
`;

export const ORDER_EXPECTED: Printed = [
  "reference must be a non-empty string",
  "customer is required",
  "paymentMethod is required",
  "amount must be a positive integer of minor units",
  "amount.currency must be an uppercase ISO-4217 code",
  "interval must be one of day, week, month, year",
  "intervalCount must be a positive integer",
  "trialEnd and billingAnchor are mutually exclusive",
  "trialEnd must be a finite timestamp in the future",
];

export const INTERVAL_CASES = `
const cases = {
  day: refused({ ...base, interval: "day" }),
  week: refused({ ...base, interval: "week" }),
  month: refused({ ...base, interval: "month" }),
  year: refused({ ...base, interval: "year" }),
  fortnight: refused({ ...base, interval: "fortnight" }),
  capitalised: refused({ ...base, interval: "Month" }),
  empty: refused({ ...base, interval: "" }),
  missing: refused({ ...base, interval: undefined }),
  countOmitted: refused({ ...base, intervalCount: undefined }),
  countOne: refused({ ...base, intervalCount: 1 }),
  countTwelve: refused({ ...base, intervalCount: 12 }),
  countZero: refused({ ...base, intervalCount: 0 }),
  countNegative: refused({ ...base, intervalCount: -1 }),
  countFraction: refused({ ...base, intervalCount: 1.5 }),
  countNaN: refused({ ...base, intervalCount: NaN }),
  countText: refused({ ...base, intervalCount: "2" }),
  countNull: refused({ ...base, intervalCount: null }),
  vocabulary: [...c.SUBSCRIPTION_INTERVALS],
};
console.log(JSON.stringify(cases));
`;

export const INTERVAL_EXPECTED: Printed = {
  day: "accepted",
  week: "accepted",
  month: "accepted",
  year: "accepted",
  fortnight: "interval must be one of day, week, month, year",
  capitalised: "interval must be one of day, week, month, year",
  empty: "interval must be one of day, week, month, year",
  missing: "interval must be one of day, week, month, year",
  countOmitted: "accepted",
  countOne: "accepted",
  countTwelve: "accepted",
  countZero: "intervalCount must be a positive integer",
  countNegative: "intervalCount must be a positive integer",
  countFraction: "intervalCount must be a positive integer",
  countNaN: "intervalCount must be a positive integer",
  countText: "intervalCount must be a positive integer",
  countNull: "intervalCount must be a positive integer",
  vocabulary: ["day", "week", "month", "year"],
};

export const DATE_CASES = `
const later = NOW + 86_400_000;
const cases = {
  trialFuture: refused({ ...base, trialEnd: later }, NOW),
  trialNow: refused({ ...base, trialEnd: NOW }, NOW),
  trialOneMsLater: refused({ ...base, trialEnd: NOW + 1 }, NOW),
  trialOneMsEarlier: refused({ ...base, trialEnd: NOW - 1 }, NOW),
  anchorFuture: refused({ ...base, billingAnchor: later }, NOW),
  anchorNow: refused({ ...base, billingAnchor: NOW }, NOW),
  anchorPast: refused({ ...base, billingAnchor: NOW - 86_400_000 }, NOW),
  trialInSeconds: refused({ ...base, trialEnd: Math.floor(NOW / 1000) + 86_400 }, NOW),
  bothFuture: refused({ ...base, trialEnd: later, billingAnchor: later }, NOW),
  bothWithoutClock: refused({ ...base, trialEnd: later, billingAnchor: later }),
  bothPast: refused({ ...base, trialEnd: 1, billingAnchor: 2 }, NOW),
  pastWithoutClock: refused({ ...base, trialEnd: 1 }),
  anchorPastWithoutClock: refused({ ...base, billingAnchor: 1 }),
  trialNaN: refused({ ...base, trialEnd: NaN }),
  trialInfinite: refused({ ...base, trialEnd: Infinity }),
  anchorNaN: refused({ ...base, billingAnchor: NaN }, NOW),
  anchorInfinite: refused({ ...base, billingAnchor: -Infinity }),
  neither: refused(base, NOW),
  returned: c.ValidateSubscriptionRequest(base, NOW) === undefined,
};
console.log(JSON.stringify(cases));
`;

export const DATE_EXPECTED: Printed = {
  trialFuture: "accepted",
  trialNow: "trialEnd must be a finite timestamp in the future",
  trialOneMsLater: "accepted",
  trialOneMsEarlier: "trialEnd must be a finite timestamp in the future",
  anchorFuture: "accepted",
  anchorNow: "billingAnchor must be a finite timestamp in the future",
  anchorPast: "billingAnchor must be a finite timestamp in the future",
  trialInSeconds: "trialEnd must be a finite timestamp in the future",
  bothFuture: "trialEnd and billingAnchor are mutually exclusive",
  bothWithoutClock: "trialEnd and billingAnchor are mutually exclusive",
  bothPast: "trialEnd and billingAnchor are mutually exclusive",
  pastWithoutClock: "accepted",
  anchorPastWithoutClock: "accepted",
  trialNaN: "trialEnd must be a finite timestamp in the future",
  trialInfinite: "trialEnd must be a finite timestamp in the future",
  anchorNaN: "billingAnchor must be a finite timestamp in the future",
  anchorInfinite: "billingAnchor must be a finite timestamp in the future",
  neither: "accepted",
  returned: true,
};
