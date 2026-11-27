import {
  isInvalidSubscriptionRequestError,
  isInvalidSubscriptionStateError,
  isSubscriptionError,
  isSubscriptionNotFoundError,
  isSubscriptionPaymentError,
} from "../src/index";
import type {
  InvalidSubscriptionRequestError,
  InvalidSubscriptionStateError,
  SubscriptionError,
  SubscriptionNotFoundError,
  SubscriptionPaymentError,
} from "../src/index";

type Proof<Flag extends true> = Flag;
type Narrows<Value, Target> = [Value] extends [Target] ? true : false;

/** Narrows the value a strict `catch (error)` clause binds, which is `unknown`. */
export function narrowCaught(): void {
  try {
    return;
  } catch (error) {
    if (isSubscriptionError(error)) {
      const narrowed: Proof<Narrows<typeof error, SubscriptionError>> = true;
      void narrowed;
    }
    if (isSubscriptionNotFoundError(error)) {
      const narrowed: Proof<Narrows<typeof error, SubscriptionNotFoundError>> =
        true;
      void narrowed;
    }
    if (isInvalidSubscriptionRequestError(error)) {
      const narrowed: Proof<
        Narrows<typeof error, InvalidSubscriptionRequestError>
      > = true;
      void narrowed;
    }
    if (isInvalidSubscriptionStateError(error)) {
      const narrowed: Proof<
        Narrows<typeof error, InvalidSubscriptionStateError>
      > = true;
      void narrowed;
    }
    if (isSubscriptionPaymentError(error)) {
      const narrowed: Proof<Narrows<typeof error, SubscriptionPaymentError>> =
        true;
      void narrowed;
    }
  }
}

declare const unknownValue: unknown;

export const unknownResults: boolean[] = [
  isSubscriptionError(unknownValue),
  isSubscriptionNotFoundError(unknownValue),
  isInvalidSubscriptionRequestError(unknownValue),
  isInvalidSubscriptionStateError(unknownValue),
  isSubscriptionPaymentError(unknownValue),
];
