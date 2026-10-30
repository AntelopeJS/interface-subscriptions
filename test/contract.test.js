const assert = require("node:assert/strict");
const { RegisteringProxy } = require("@antelopejs/interface-core");

/** @type {typeof import("../src/index")} */
const subscriptions = require("../dist/index.js");

/**
 * This package is a contract: the calls are `InterfaceFunction` declarations
 * with no body. What it does execute is the status helper, the error classes,
 * the frozen vocabularies and the event proxy, so that is what is covered
 * here. The calls themselves are covered by the shared conformance suite in
 * `src/tests`, against a real implementation.
 */

const HELPERS = ["ValidateSubscriptionRequest"];

const CALLS = [
  "CreateSubscription",
  "GetSubscription",
  "ListSubscriptions",
  "CancelSubscription",
  "UpdateSubscriptionPaymentMethod",
];

it("declares every call the contract documents, and nothing undocumented", () => {
  const declared = Object.entries(subscriptions)
    .filter(([, value]) => value instanceof Function)
    .filter(([name]) => /^[A-Z]/.test(name))
    .filter(([name]) => !name.endsWith("Error"))
    .filter(([name]) => !HELPERS.includes(name))
    .map(([name]) => name)
    .sort();

  assert.deepEqual(declared, [...CALLS].sort());
});

it("delivers events through a registering proxy, so handlers unload with their module", () => {
  assert.ok(subscriptions.SubscriptionEvents instanceof RegisteringProxy);
});

it("classifies only an ended subscription as terminal", () => {
  for (const status of subscriptions.SUBSCRIPTION_STATUSES) {
    assert.equal(
      subscriptions.isTerminalSubscriptionStatus(status),
      status === "canceled",
      `${status} is ${status === "canceled" ? "" : "not "}terminal`,
    );
  }
});

it("reports past_due as a status of its own", () => {
  assert.ok(subscriptions.SUBSCRIPTION_STATUSES.includes("past_due"));
  assert.equal(subscriptions.isTerminalSubscriptionStatus("past_due"), false);
});

it("names an event for every way a subscription changes on its own", () => {
  const byCodeUnit = (left, right) =>
    left < right ? -1 : left > right ? 1 : 0;
  assert.deepEqual(
    [...subscriptions.SUBSCRIPTION_EVENT_TYPES].sort(byCodeUnit),
    [
      "subscription.canceled",
      "subscription.created",
      "subscription.payment_failed",
      "subscription.payment_succeeded",
    ],
  );
});

const VOCABULARIES = [
  "SUBSCRIPTION_INTERVALS",
  "SUBSCRIPTION_STATUSES",
  "SUBSCRIPTION_END_REASONS",
  "SUBSCRIPTION_EVENT_TYPES",
  "CANCELLATION_TIMINGS",
];

for (const name of VOCABULARIES) {
  it(`freezes ${name} against a consumer that tries to extend it`, () => {
    assert.ok(Object.isFrozen(subscriptions[name]), `${name} must be frozen`);
    assert.throws(() => subscriptions[name].push("invented"));
  });
}

it("keeps classifying correctly after a consumer tries to corrupt the statuses", () => {
  assert.throws(() => subscriptions.SUBSCRIPTION_STATUSES.splice(0, 1));
  assert.equal(subscriptions.isTerminalSubscriptionStatus("active"), false);
});

it("allows every calendar unit, and a period of up to a year", () => {
  assert.deepEqual(
    [...subscriptions.SUBSCRIPTION_INTERVALS],
    ["day", "week", "month", "year"],
  );
  assert.ok(subscriptions.MAX_PORTABLE_PERIOD_DAYS >= 365);
});

const SUBSCRIPTION_ID = "sub_contract";
const PROVIDER_CODE = "provider_specific_code";
const DECLINED = {
  id: "pay_declined",
  status: "failed",
  amount: { value: 1900, currency: "EUR" },
};

const ERRORS = [
  {
    name: "SubscriptionNotFoundError",
    build: () => new subscriptions.SubscriptionNotFoundError(SUBSCRIPTION_ID),
    withCode: () =>
      new subscriptions.SubscriptionNotFoundError(
        SUBSCRIPTION_ID,
        PROVIDER_CODE,
      ),
  },
  {
    name: "InvalidSubscriptionRequestError",
    build: () =>
      new subscriptions.InvalidSubscriptionRequestError("bad interval"),
    withCode: () =>
      new subscriptions.InvalidSubscriptionRequestError(
        "bad interval",
        PROVIDER_CODE,
      ),
  },
  {
    name: "InvalidSubscriptionStateError",
    build: () =>
      new subscriptions.InvalidSubscriptionStateError("already ended"),
    withCode: () =>
      new subscriptions.InvalidSubscriptionStateError(
        "already ended",
        "canceled",
        PROVIDER_CODE,
      ),
  },
  {
    name: "SubscriptionPaymentError",
    build: () => new subscriptions.SubscriptionPaymentError(DECLINED),
    withCode: () =>
      new subscriptions.SubscriptionPaymentError(DECLINED, PROVIDER_CODE),
  },
];

for (const { name, build, withCode } of ERRORS) {
  it(`${name} can be caught as itself and as a SubscriptionError`, () => {
    const error = build();

    assert.ok(error instanceof Error);
    assert.ok(error instanceof subscriptions.SubscriptionError);
    assert.ok(error instanceof subscriptions[name]);
    assert.equal(error.name, name);
    assert.ok(error.message.length > 0);

    for (const other of ERRORS) {
      if (other.name === name) continue;
      assert.equal(
        error instanceof subscriptions[other.name],
        false,
        `catching ${other.name} must not also catch ${name}`,
      );
    }
  });

  it(`${name} carries the provider's own code to a support ticket`, () => {
    assert.equal(withCode().providerCode, PROVIDER_CODE);
    assert.equal(build().providerCode, undefined);
  });
}

it("names the subscription it could not find", () => {
  assert.match(
    new subscriptions.SubscriptionNotFoundError(SUBSCRIPTION_ID).message,
    /No such subscription: sub_contract/,
  );
});

it("hands back the declined payment, so the caller can tell the payer why", () => {
  const error = new subscriptions.SubscriptionPaymentError(DECLINED);
  assert.equal(error.payment, DECLINED);
  assert.match(error.message, /pay_declined/);
});

it("says which status blocked a call", () => {
  const error = new subscriptions.InvalidSubscriptionStateError(
    "nope",
    "canceled",
  );
  assert.equal(error.status, "canceled");
});

it("marks subscription charges with a key a payment webhook handler can test for", () => {
  assert.match(subscriptions.SUBSCRIPTION_METADATA_KEY, /./s);
});

const NOW = Date.UTC(2027, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
const VALID = {
  reference: "account-1",
  customer: "cus_contract",
  paymentMethod: "pm_contract",
  amount: { value: 1900, currency: "EUR" },
  interval: "month",
};

it("accepts a request inside the contract", () => {
  assert.doesNotThrow(() =>
    subscriptions.ValidateSubscriptionRequest(VALID, NOW),
  );
  assert.doesNotThrow(() =>
    subscriptions.ValidateSubscriptionRequest(
      { ...VALID, intervalCount: 3, trialEnd: NOW + DAY_MS },
      NOW,
    ),
  );
});

const OUTSIDE = {
  "a zero amount": { amount: { value: 0, currency: "EUR" } },
  "a fractional amount": { amount: { value: 10.5, currency: "EUR" } },
  "a lowercase currency": { amount: { value: 1900, currency: "eur" } },
  "an interval outside the vocabulary": { interval: "fortnight" },
  "an interval count of zero": { intervalCount: 0 },
  "a fractional interval count": { intervalCount: 1.5 },
  "a trial already over": { trialEnd: NOW - DAY_MS },
  "a billing anchor in the past": { billingAnchor: NOW },
  "a trial and an anchor together": {
    trialEnd: NOW + DAY_MS,
    billingAnchor: NOW + 2 * DAY_MS,
  },
  "no reference": { reference: "" },
  "no customer": { customer: "" },
  "no payment method": { paymentMethod: "" },
};

for (const [label, overrides] of Object.entries(OUTSIDE)) {
  it(`refuses ${label} as an invalid request`, () => {
    assert.throws(
      () =>
        subscriptions.ValidateSubscriptionRequest(
          { ...VALID, ...overrides },
          NOW,
        ),
      subscriptions.InvalidSubscriptionRequestError,
    );
  });
}

it("can defer relative date validation to an idempotent provider", () => {
  for (const field of ["trialEnd", "billingAnchor"]) {
    const request = { ...VALID, [field]: NOW - DAY_MS };
    assert.doesNotThrow(() =>
      subscriptions.ValidateSubscriptionRequest(request),
    );
    assert.throws(
      () => subscriptions.ValidateSubscriptionRequest(request, NOW),
      subscriptions.InvalidSubscriptionRequestError,
    );
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.throws(
        () =>
          subscriptions.ValidateSubscriptionRequest({
            ...VALID,
            [field]: value,
          }),
        subscriptions.InvalidSubscriptionRequestError,
      );
    }
  }
});

it("still enforces the portable shape when the provider owns relative dates", () => {
  assert.throws(
    () =>
      subscriptions.ValidateSubscriptionRequest({
        ...VALID,
        amount: { value: 0, currency: "EUR" },
      }),
    subscriptions.InvalidSubscriptionRequestError,
  );
  assert.throws(
    () =>
      subscriptions.ValidateSubscriptionRequest({
        ...VALID,
        trialEnd: NOW,
        billingAnchor: NOW,
      }),
    subscriptions.InvalidSubscriptionRequestError,
  );
});
