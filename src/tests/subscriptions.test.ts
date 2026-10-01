import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { GetPayment } from "@antelopejs/interface-payment";

import {
  CreateSubscription,
  GetSubscription,
  ListSubscriptions,
  SUBSCRIPTION_METADATA_KEY,
  SubscriptionPaymentError,
} from "../index";
import {
  CHARGEABLE,
  DAY_MS,
  DECLINES_LATER,
  PROVIDER_CLOCK_RESOLUTION_MS,
  LONGEST_MONTH_MS,
  PERIOD_VALUE,
  SHORTEST_MONTH_MS,
  SUITE_TIMEOUT,
  TEST_METHOD,
  TEST_METHOD_DECLINES_LATER,
  TRIAL_DAYS,
  inWholeSeconds,
  assertSubscriptionShape,
  key,
  monthly,
  newPayer,
  rejectsWith,
  settledPayment,
  subscribe,
} from "./support";

describe(`creating a subscription (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("charges the first period at once and reports it active", async () => {
    const payer = await newPayer();
    const before = Date.now();
    const subscription = await subscribe(payer);

    assert.equal(subscription.status, "active");
    assert.equal(subscription.cancelAtPeriodEnd, false);
    assert.equal(subscription.paymentMethod, payer.paymentMethod);
    assert.ok(subscription.latestPayment, "the first charge must be recorded");
    assert.ok(subscription.currentPeriodStart <= Date.now());
    assert.ok(subscription.currentPeriodStart >= before - DAY_MS);
    const length =
      subscription.currentPeriodEnd - subscription.currentPeriodStart;
    assert.ok(
      length >= SHORTEST_MONTH_MS && length <= LONGEST_MONTH_MS,
      `a one-month period lasted ${length / DAY_MS} days`,
    );
  });

  it("charges the first period as an off-session payment it can be told by", async () => {
    const payer = await newPayer();
    const subscription = await subscribe(payer);

    const payment = await settledPayment(subscription.latestPayment!);
    assert.equal(payment.status, "succeeded");
    assert.deepEqual(payment.amount, subscription.amount);
    assert.equal(payment.customer, payer.customer);
    assert.equal(
      payment.metadata?.[SUBSCRIPTION_METADATA_KEY],
      subscription.id,
      "a subscription charge must be distinguishable from a one-off payment",
    );
  });

  it("starts a trial without charging anything", async () => {
    const payer = await newPayer();
    const trialEnd = inWholeSeconds(TRIAL_DAYS * DAY_MS);
    const subscription = await subscribe(payer, { trialEnd });

    assert.equal(subscription.status, "trialing");
    assert.equal(subscription.trialEnd, trialEnd);
    assert.equal(subscription.currentPeriodEnd, trialEnd);
    assert.equal(
      subscription.latestPayment,
      undefined,
      "a trial charges nothing",
    );
  });

  it("defers the first charge to a billing anchor", async () => {
    const payer = await newPayer();
    const billingAnchor = inWholeSeconds(3 * DAY_MS);
    const subscription = await subscribe(payer, { billingAnchor });

    assert.equal(subscription.status, "active");
    assert.equal(subscription.trialEnd, undefined);
    assert.equal(subscription.currentPeriodEnd, billingAnchor);
    assert.equal(subscription.latestPayment, undefined);
  });

  it("keeps the request's interval count and metadata", async () => {
    const payer = await newPayer();
    const metadata = { plan: "conformance-quarterly" };
    const subscription = await subscribe(payer, { intervalCount: 3, metadata });

    assert.equal(subscription.intervalCount, 3);
    assert.deepEqual(subscription.metadata, metadata);
    const length =
      subscription.currentPeriodEnd - subscription.currentPeriodStart;
    assert.ok(
      length >= 3 * SHORTEST_MONTH_MS && length <= 3 * LONGEST_MONTH_MS,
      `a three-month period lasted ${length / DAY_MS} days`,
    );
  });

  it("replays the original subscription for a repeated idempotency key", async () => {
    const payer = await newPayer();
    const request = monthly(payer);
    const idempotencyKey = key();

    const first = await CreateSubscription(request, idempotencyKey);
    const replay = await CreateSubscription(request, idempotencyKey);

    assert.equal(replay.id, first.id);
    assert.equal(
      replay.latestPayment,
      first.latestPayment,
      "replaying must not charge again",
    );
    assert.equal((await ListSubscriptions(payer.customer)).length, 1);
  });
});

describe(`reading subscriptions back (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("reads a subscription back by its identifier", async () => {
    const payer = await newPayer();
    const created = await subscribe(payer);

    const read = await GetSubscription(created.id);
    assert.equal(read.id, created.id);
    assert.equal(read.status, created.status);
    assert.equal(read.currentPeriodStart, created.currentPeriodStart);
    assert.equal(read.currentPeriodEnd, created.currentPeriodEnd);
    assert.equal(read.latestPayment, created.latestPayment);
    assertSubscriptionShape(
      read,
      monthly(payer, { reference: created.reference }),
    );
  });

  it("lists a customer's subscriptions newest first, and no one else's", async () => {
    const payer = await newPayer();
    const stranger = await newPayer();
    const older = await subscribe(payer);
    await delay(PROVIDER_CLOCK_RESOLUTION_MS);
    const newer = await subscribe(payer, {
      trialEnd: inWholeSeconds(TRIAL_DAYS * DAY_MS),
    });
    await subscribe(stranger);

    const listed = await ListSubscriptions(payer.customer);
    assert.deepEqual(
      listed.map((subscription) => subscription.id),
      [newer.id, older.id],
    );
  });

  it("lists nothing for a customer without subscriptions", async () => {
    const payer = await newPayer();
    assert.deepEqual(await ListSubscriptions(payer.customer), []);
  });
});

describe(`a declined first period (${DECLINES_LATER})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD_DECLINES_LATER) this.skip();
  });

  it("refuses the subscription and says which payment was declined", async () => {
    const payer = await newPayer(TEST_METHOD_DECLINES_LATER);

    const error = await rejectsWith(
      CreateSubscription(monthly(payer), key()),
      SubscriptionPaymentError,
      "a declined first period",
    );

    const payment = (error as SubscriptionPaymentError).payment;
    assert.equal(payment.status, "failed");
    assert.ok(payment.failure, "the declined payment must say why");
    assert.equal((await GetPayment(payment.id)).status, "failed");
    assert.deepEqual(
      await ListSubscriptions(payer.customer),
      [],
      "a refused subscription must not exist",
    );
  });

  it("refuses the same way when the idempotency key is replayed", async () => {
    const payer = await newPayer(TEST_METHOD_DECLINES_LATER);
    const request = monthly(payer);
    const idempotencyKey = key();

    const first = await rejectsWith(
      CreateSubscription(request, idempotencyKey),
      SubscriptionPaymentError,
      "first attempt",
    );
    const replay = await rejectsWith(
      CreateSubscription(request, idempotencyKey),
      SubscriptionPaymentError,
      "replay",
    );

    assert.equal(
      (replay as SubscriptionPaymentError).payment.id,
      (first as SubscriptionPaymentError).payment.id,
      "a replay must not charge again",
    );
  });

  it("still starts a trial, since a trial charges nothing", async () => {
    const payer = await newPayer(TEST_METHOD_DECLINES_LATER);
    const subscription = await subscribe(payer, {
      trialEnd: inWholeSeconds(TRIAL_DAYS * DAY_MS),
    });
    assert.equal(subscription.status, "trialing");
    assert.equal(subscription.amount.value, PERIOD_VALUE);
  });
});
