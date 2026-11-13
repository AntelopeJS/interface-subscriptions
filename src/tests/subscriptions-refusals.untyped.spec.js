const assert = require("node:assert/strict");

const {
  CHARGEABLE,
  SUITE_TIMEOUT,
  TEST_METHOD,
  key,
  monthly,
  newPayer,
} = require("./support");
const {
  CreateSubscription,
  InvalidSubscriptionRequestError,
} = require("../index");

/**
 * Requests the `SubscriptionRequest` type forbids, sent the way an untyped
 * caller sends them. Plain JavaScript, so no type check stands between the
 * value and the provider's own validation.
 */
describe(`requests outside the contract (${CHARGEABLE})`, function () {
  this.timeout(SUITE_TIMEOUT);

  before(function () {
    if (!TEST_METHOD) this.skip();
  });

  it("refuses an interval outside the vocabulary", async () => {
    const payer = await newPayer();
    await assert.rejects(
      CreateSubscription(monthly(payer, { interval: "fortnight" }), key()),
      InvalidSubscriptionRequestError,
      "an interval outside the vocabulary",
    );
  });
});
