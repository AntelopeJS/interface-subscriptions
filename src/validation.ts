import { InvalidSubscriptionRequestError } from "./errors";
import { SUBSCRIPTION_INTERVALS, type SubscriptionRequest } from "./types";

type Rule = (request: SubscriptionRequest, now?: number) => string | undefined;

function positiveInteger(value: number | undefined): boolean {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function validTime(value: number | undefined, now?: number): boolean {
  return (
    value === undefined ||
    (Number.isFinite(value) && (now === undefined || value > now))
  );
}

const RULES: Rule[] = [
  (request) =>
    request.reference ? undefined : "reference must be a non-empty string",
  (request) => (request.customer ? undefined : "customer is required"),
  (request) =>
    request.paymentMethod ? undefined : "paymentMethod is required",
  (request) =>
    positiveInteger(request.amount?.value)
      ? undefined
      : "amount must be a positive integer of minor units",
  (request) =>
    /^[A-Z]{3}$/.test(request.amount?.currency ?? "")
      ? undefined
      : "amount.currency must be an uppercase ISO-4217 code",
  (request) =>
    SUBSCRIPTION_INTERVALS.includes(request.interval)
      ? undefined
      : `interval must be one of ${SUBSCRIPTION_INTERVALS.join(", ")}`,
  (request) =>
    request.intervalCount === undefined ||
    positiveInteger(request.intervalCount)
      ? undefined
      : "intervalCount must be a positive integer",
  (request) =>
    request.trialEnd !== undefined && request.billingAnchor !== undefined
      ? "trialEnd and billingAnchor are mutually exclusive"
      : undefined,
  (request, now) =>
    validTime(request.trialEnd, now)
      ? undefined
      : "trialEnd must be a finite timestamp in the future",
  (request, now) =>
    validTime(request.billingAnchor, now)
      ? undefined
      : "billingAnchor must be a finite timestamp in the future",
];

/**
 * Checks a {@link SubscriptionRequest} against the portable contract, so every
 * implementation refuses the same request shapes. Consumers can supply `now`
 * to also check that trial and billing dates are in the future.
 *
 * Implementations may omit `now` only when their provider validates future
 * dates after checking for an idempotent replay. This lets a saved result be
 * returned after its original date has passed without accepting a new request
 * with a past date. Finite timestamps and all other rules are always checked.
 *
 * @param request - The request to check
 * @param now - Optional Unix epoch milliseconds for relative date validation
 * @throws InvalidSubscriptionRequestError naming the first rule broken
 */
export function ValidateSubscriptionRequest(
  request: SubscriptionRequest,
  now?: number,
): void {
  const problem = RULES.map((rule) => rule(request, now)).find(Boolean);
  if (problem) throw new InvalidSubscriptionRequestError(problem);
}
