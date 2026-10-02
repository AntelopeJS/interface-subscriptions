import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import {
  ABSENT_ID,
  CHARGEABLE,
  DAY_MS,
  EVENTS_OBSERVABLE,
  OBSERVABLE,
  SUITE_TIMEOUT,
  TEST_METHOD,
  TRIAL_DAYS,
  inWholeSeconds,
  amount,
  key,
  monthly,
  newPayer,
  rejectsWith,
  saveMethod,
  subscribe,
} from "./support";
import {
  CancelSubscription,
  CreateSubscription,
  GetSubscription,
  InvalidSubscriptionRequestError,
  InvalidSubscriptionStateError,
  type SubscriptionEvent,
  SubscriptionEvents,
  type SubscriptionRequest,
  SubscriptionNotFoundError,
  UpdateSubscriptionPaymentMethod,
} from "../index";

const EVENT_TIMEOUT = 20_000;
const ABSENT_CUSTOMER = `cus_antelope_absent_${"0".repeat(16)}`;
const ABSENT_METHOD = `pm_antelope_absent_${"0".repeat(16)}`;
const EVENT_POLL = 100;

describe(`cancelling (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("ends a subscription now", async () => {
    const subscription = await subscribe(await newPayer());

    const canceled = await CancelSubscription(subscription.id, key(), "now");

    assert.equal(canceled.status, "canceled");
    assert.equal(canceled.endReason, "requested");
    assert.ok(canceled.endedAt! >= subscription.createdAt);
    assert.equal((await GetSubscription(subscription.id)).status, "canceled");
  });

  it("lets a period run out instead of renewing it", async () => {
    const subscription = await subscribe(await newPayer());

    const scheduled = await CancelSubscription(
      subscription.id,
      key(),
      "period_end",
    );

    assert.equal(scheduled.status, "active", "the paid period keeps running");
    assert.equal(scheduled.cancelAtPeriodEnd, true);
    assert.equal(scheduled.endedAt, undefined);
    assert.equal(scheduled.currentPeriodEnd, subscription.currentPeriodEnd);
    assert.equal(
      (await GetSubscription(subscription.id)).cancelAtPeriodEnd,
      true,
    );
  });

  it("accepts a second request to end at period end", async () => {
    const subscription = await subscribe(await newPayer());
    await CancelSubscription(subscription.id, key(), "period_end");

    const again = await CancelSubscription(
      subscription.id,
      key(),
      "period_end",
    );
    assert.equal(again.cancelAtPeriodEnd, true);
    assert.equal(again.status, "active");
  });

  it("ends now a subscription already set to end at period end", async () => {
    const subscription = await subscribe(await newPayer());
    await CancelSubscription(subscription.id, key(), "period_end");

    const canceled = await CancelSubscription(subscription.id, key(), "now");
    assert.equal(canceled.status, "canceled");
  });

  it("ends a trial now without charging", async () => {
    const subscription = await subscribe(await newPayer(), {
      trialEnd: inWholeSeconds(TRIAL_DAYS * DAY_MS),
    });

    const canceled = await CancelSubscription(subscription.id, key(), "now");
    assert.equal(canceled.status, "canceled");
    assert.equal(canceled.latestPayment, undefined);
  });

  it("refuses to cancel what has already ended", async () => {
    const subscription = await subscribe(await newPayer());
    await CancelSubscription(subscription.id, key(), "now");

    for (const timing of ["now", "period_end"] as const) {
      const error = await rejectsWith(
        CancelSubscription(subscription.id, key(), timing),
        InvalidSubscriptionStateError,
        `cancel ${timing} after the end`,
      );
      assert.equal((error as InvalidSubscriptionStateError).status, "canceled");
    }
  });

  it("replays a cancellation for a repeated idempotency key", async () => {
    const subscription = await subscribe(await newPayer());
    const idempotencyKey = key();

    const first = await CancelSubscription(
      subscription.id,
      idempotencyKey,
      "now",
    );
    const replay = await CancelSubscription(
      subscription.id,
      idempotencyKey,
      "now",
    );

    assert.equal(replay.status, "canceled");
    assert.equal(replay.endedAt, first.endedAt);
  });
});

describe(`changing the payment method (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("charges a newly saved method from now on", async () => {
    const payer = await newPayer();
    const subscription = await subscribe(payer);
    const replacement = await saveMethod(payer.customer);

    const updated = await UpdateSubscriptionPaymentMethod(
      subscription.id,
      replacement,
      key(),
    );

    assert.equal(updated.paymentMethod, replacement);
    assert.equal(
      updated.latestPayment,
      subscription.latestPayment,
      "switching charges nothing",
    );
    assert.equal(
      (await GetSubscription(subscription.id)).paymentMethod,
      replacement,
    );
  });

  it("refuses to change the method of a subscription that has ended", async () => {
    const payer = await newPayer();
    const subscription = await subscribe(payer);
    await CancelSubscription(subscription.id, key(), "now");

    await rejectsWith(
      UpdateSubscriptionPaymentMethod(
        subscription.id,
        payer.paymentMethod,
        key(),
      ),
      InvalidSubscriptionStateError,
      "update after the end",
    );
  });
});

describe("unknown subscriptions", function () {
  this.timeout(SUITE_TIMEOUT);

  it("raises SubscriptionNotFoundError for every call on an unknown id", async () => {
    await rejectsWith(
      GetSubscription(ABSENT_ID),
      SubscriptionNotFoundError,
      "get",
    );
    await rejectsWith(
      CancelSubscription(ABSENT_ID, key(), "now"),
      SubscriptionNotFoundError,
      "cancel",
    );
    await rejectsWith(
      UpdateSubscriptionPaymentMethod(ABSENT_ID, "pm_absent", key()),
      SubscriptionNotFoundError,
      "update",
    );
  });
});

describe(`requests outside the contract (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  const INVALID: Record<string, (now: number) => Partial<SubscriptionRequest>> =
    {
      "a zero amount": () => ({ amount: amount(0) }),
      "a fractional amount": () => ({ amount: amount(10.5) }),
      "an interval count of zero": () => ({ intervalCount: 0 }),
      "a fractional interval count": () => ({ intervalCount: 1.5 }),
      "an interval outside the vocabulary": () => ({
        interval: "fortnight" as SubscriptionRequest["interval"],
      }),
      "a trial that has already ended": (now) => ({ trialEnd: now - DAY_MS }),
      "a billing anchor in the past": (now) => ({
        billingAnchor: now - DAY_MS,
      }),
      "both a trial and a billing anchor": (now) => ({
        trialEnd: now + DAY_MS,
        billingAnchor: now + 2 * DAY_MS,
      }),
    };

  for (const [label, overrides] of Object.entries(INVALID)) {
    it(`refuses ${label}`, async () => {
      const payer = await newPayer();
      await rejectsWith(
        CreateSubscription(monthly(payer, overrides(Date.now())), key()),
        InvalidSubscriptionRequestError,
        label,
      );
    });
  }

  it("refuses a customer that does not exist, as a request, not a missing subscription", async () => {
    const payer = await newPayer();
    await rejectsWith(
      CreateSubscription(monthly(payer, { customer: ABSENT_CUSTOMER }), key()),
      InvalidSubscriptionRequestError,
      "unknown customer",
    );
  });

  it("refuses a payment method that does not exist", async () => {
    const payer = await newPayer();
    await rejectsWith(
      CreateSubscription(
        monthly(payer, { paymentMethod: ABSENT_METHOD }),
        key(),
      ),
      InvalidSubscriptionRequestError,
      "unknown method",
    );
  });

  it("refuses to switch to a method that does not exist, and the subscription stays", async () => {
    const subscription = await subscribe(await newPayer());

    await rejectsWith(
      UpdateSubscriptionPaymentMethod(subscription.id, ABSENT_METHOD, key()),
      InvalidSubscriptionRequestError,
      "switch to an unknown method",
    );
    assert.equal(
      (await GetSubscription(subscription.id)).paymentMethod,
      subscription.paymentMethod,
    );
  });
});

describe(`events (${OBSERVABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  const received: SubscriptionEvent[] = [];
  const HANDLER_ID = "conformance-suite";

  before(function () {
    if (!EVENTS_OBSERVABLE || !TEST_METHOD) this.skip();
    SubscriptionEvents.register(HANDLER_ID, (event) => {
      received.push(event);
    });
  });

  after(() => {
    if (EVENTS_OBSERVABLE) SubscriptionEvents.unregister(HANDLER_ID);
  });

  async function eventsFor(
    id: string,
    count: number,
  ): Promise<SubscriptionEvent[]> {
    const deadline = Date.now() + EVENT_TIMEOUT;
    const matching = () =>
      received.filter((event) => event.subscription.id === id);
    while (matching().length < count && Date.now() < deadline) {
      await delay(EVENT_POLL);
    }
    return matching();
  }

  it("reports a new paid subscription as created, then paid", async () => {
    const subscription = await subscribe(await newPayer());

    const events = await eventsFor(subscription.id, 2);
    assert.deepEqual(events.map((event) => event.type).sort(), [
      "subscription.created",
      "subscription.payment_succeeded",
    ]);
    const paid = events.find(
      (event) => event.type === "subscription.payment_succeeded",
    );
    assert.equal(paid?.payment, subscription.latestPayment);
    assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  });

  it("reports a cancellation", async () => {
    const subscription = await subscribe(await newPayer(), {
      trialEnd: inWholeSeconds(TRIAL_DAYS * DAY_MS),
    });
    await CancelSubscription(subscription.id, key(), "now");

    const events = await eventsFor(subscription.id, 2);
    const canceled = events.find(
      (event) => event.type === "subscription.canceled",
    );
    assert.ok(canceled, "a cancellation must be reported");
    assert.equal(canceled.subscription.status, "canceled");
    assert.equal(canceled.payment, undefined);
  });
});
