import type { InterfaceHooks, VerifyConfig } from "@antelopejs/tooling-configs/verify";

import type * as SubscriptionsInterface from "../../../src/index.ts";
import { declared, packed, REQUEST, suite, throughCore } from "./journey-kit.ts";
import { DATE_CASES, DATE_EXPECTED, FIELD_CASES, FIELD_EXPECTED, INTERVAL_CASES, INTERVAL_EXPECTED, ORDER_CASES, ORDER_EXPECTED } from "./validation-cases.ts";
import { ERROR_EXPECTED, ERROR_SCRIPT, STATUS_EXPECTED, STATUS_SCRIPT, VOCABULARY_EXPECTED, VOCABULARY_SCRIPT } from "./vocabulary-cases.ts";
import { FIELD_TYPES, SIGNATURES } from "./probes.ts";
import { CONFORMANCE_FILES, CONFORMANCE_SCRIPT } from "./suite-scripts.ts";

const CALLS: NonNullable<InterfaceHooks<typeof SubscriptionsInterface>["calls"]> = {
  ".:ValidateSubscriptionRequest": {
    async call(api) {
      try {
        api.ValidateSubscriptionRequest({
          reference: "acct_1",
          customer: "cus_1",
          paymentMethod: "pm_1",
          amount: { value: 0, currency: "EUR" },
          interval: "month",
        });
        return "accepted";
      } catch (error) {
        return error instanceof Error ? error.name : "thrown";
      }
    },
    expect: "InvalidSubscriptionRequestError",
  },
  ".:isTerminalSubscriptionStatus": {
    call: (api) => Promise.resolve([api.isTerminalSubscriptionStatus("canceled"), api.isTerminalSubscriptionStatus("past_due")]),
    expect: [true, false],
  },
};

const config: VerifyConfig<typeof SubscriptionsInterface> = {
  doors: {
    data: null,
    format: {
      globs: ["src/types.ts"],
      funnels: [],
      containments: ["statuses/status-vocabulary", "vocabularies/wire-names"],
      why: "the status, end reason, interval, timing and event strings and the antelopeSubscription metadata key are what providers store in their subscription rows and payment metadata, and what consumers branch on",
    },
    contract: {
      globs: ["src/index.ts", "src/functions.ts", "package.json"],
      funnels: [],
      containments: [],
      why: "the five calls, the event proxy, the validator, the error classes and the vocabularies are what every billing module and provider imports",
    },
    outbound: null,
    exposure: null,
    publish: {
      globs: ["package.json", ".release-it.json", "changelogen.config.json", ".github/workflows/release.yml"],
      funnels: [],
      containments: [],
      why: "the package name and release workflow claim @antelopejs/interface-subscriptions on npm",
    },
  },
  interface: {
    calls: CALLS,
  },
  journeys: {
    "calls-through-core": throughCore("the five calls reach the provider with their arguments in order", [
      { name: "CreateSubscription", args: [REQUEST, "subscribe-acct_1"] },
      { name: "CreateSubscription", args: [REQUEST, "subscribe-acct_1", "eu-account"] },
      { name: "GetSubscription", args: ["sub_1"] },
      { name: "GetSubscription", args: ["sub_1", "eu-account"] },
      { name: "ListSubscriptions", args: ["cus_1"] },
      { name: "ListSubscriptions", args: ["cus_1", "eu-account"] },
      { name: "CancelSubscription", args: ["sub_1", "cancel-period-end-sub_1", "period_end"] },
      { name: "CancelSubscription", args: ["sub_1", "cancel-now-sub_1", "now", "eu-account"] },
      { name: "UpdateSubscriptionPaymentMethod", args: ["sub_1", "pm_2", "switch-sub_1"] },
      { name: "UpdateSubscriptionPaymentMethod", args: ["sub_1", "pm_2", "switch-sub_1", "eu-account"] },
    ]),
    signatures: declared("every call and the validator have the documented signatures", SIGNATURES, "every export has the documented signature"),
    "field-types": declared("Subscription, SubscriptionRequest, SubscriptionEvent and JsonObject have the documented shapes", FIELD_TYPES, "every type has the documented shape"),
    "validate-fields": packed(
      "ValidateSubscriptionRequest refuses an empty reference, customer or method, a non-positive amount and a malformed currency",
      FIELD_CASES,
      FIELD_EXPECTED,
      "field rules",
    ),
    "validate-order": packed(
      "ValidateSubscriptionRequest names the first rule broken, in the order docs/4.implementing.md lists",
      ORDER_CASES,
      ORDER_EXPECTED,
      "rule order",
    ),
    "validate-interval": packed(
      "ValidateSubscriptionRequest accepts day, week, month and year and a positive whole interval count",
      INTERVAL_CASES,
      INTERVAL_EXPECTED,
      "interval rules",
    ),
    "validate-dates": packed(
      "ValidateSubscriptionRequest refuses both a trial and an anchor, and past or non-finite dates",
      DATE_CASES,
      DATE_EXPECTED,
      "date rules",
    ),
    "status-vocabulary": packed(
      "the four statuses and two end reasons are frozen and only canceled is terminal",
      STATUS_SCRIPT,
      STATUS_EXPECTED,
      "status vocabulary",
    ),
    "wire-names": packed(
      "intervals, timings, event types and the metadata key are the strings docs/ names",
      VOCABULARY_SCRIPT,
      VOCABULARY_EXPECTED,
      "wire names",
    ),
    "error-classes": packed(
      "the error classes carry the names, messages, codes, status and declined payment docs/2.subscriptions.md lists",
      ERROR_SCRIPT,
      ERROR_EXPECTED,
      "error classes",
    ),
    "suite-helpers": suite(
      "the shipped conformance helpers read the environment variables README.md lists",
      CONFORMANCE_SCRIPT,
      {
        method: "tok_ok",
        declines: "tok_later",
        events: true,
        currency: "JPY",
        value: 5,
        absent: true,
        seconds: "AssertionError",
        millis: "accepted",
        whole: 0,
        day: 86_400_000,
        trialDays: 14,
        keyDiffers: true,
        referenceDiffers: true,
      },
      "suite helpers with every variable set",
      {
        ANTELOPE_PAYMENT_TEST_METHOD: "tok_ok",
        ANTELOPE_SUBSCRIPTIONS_TEST_METHOD_DECLINES_LATER: "tok_later",
        ANTELOPE_SUBSCRIPTIONS_TEST_EVENTS: "1",
        ANTELOPE_PAYMENT_TEST_CURRENCY: "JPY",
      },
    ),
    "suite-defaults": suite(
      "without the variables the suite defaults to EUR and skips what needs a provider token",
      CONFORMANCE_SCRIPT,
      {
        method: null,
        declines: null,
        events: false,
        currency: "EUR",
        value: 5,
        absent: true,
        seconds: "AssertionError",
        millis: "accepted",
        whole: 0,
        day: 86_400_000,
        trialDays: 14,
        keyDiffers: true,
        referenceDiffers: true,
      },
      "suite helpers with no variable set",
    ),
    "suite-files": suite(
      "the package ships dist/tests and exports it as ./tests/*",
      CONFORMANCE_FILES,
      {
        files: ["subscriptions-changes.test.js", "subscriptions.test.js", "support.js"],
        exported: { types: "./dist/tests/*.d.ts", default: "./dist/tests/*.js" },
        shipped: ["dist", "docs", "skills"],
      },
      "shipped suite files",
    ),
  },
};

export default config;
