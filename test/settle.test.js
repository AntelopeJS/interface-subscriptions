const assert = require("node:assert/strict");

const { ImplementInterface } = require("@antelopejs/interface-core");
const { GetPayment } = require("@antelopejs/interface-payment");

const { settledPayment } = require("#built/tests/support");

/** @param {number} value */
const amount = (value) => ({ value, currency: "EUR" });

const provider = { reads: 0, start: 0, settlesAfter: 0 };

ImplementInterface(
  { GetPayment },
  {
    GetPayment: async (id) => {
      provider.start ||= Date.now();
      provider.reads += 1;
      const settled = Date.now() - provider.start >= provider.settlesAfter;
      return {
        id,
        amount: amount(1900),
        amountCaptured: amount(settled ? 1900 : 0),
        amountRefunded: amount(0),
        status: settled ? "succeeded" : "pending",
        reference: "acct_1",
        createdAt: 1_790_000_000_000,
      };
    },
  },
);

/**
 * Makes `GetPayment` answer like a provider whose payment settles `ms` after
 * the first read, with the read count reset.
 *
 * @param {number} ms
 */
function settlesAfter(ms) {
  Object.assign(provider, { reads: 0, start: 0, settlesAfter: ms });
}

/**
 * Runs `run` and how long it took.
 *
 * @template T
 * @param {() => Promise<T>} run
 * @returns {Promise<{ value: T; ms: number }>}
 */
async function timed(run) {
  const start = Date.now();
  const value = await run();
  return { value, ms: Date.now() - start };
}

it("returns a payment that settles within milliseconds without waiting a full poll interval", async () => {
  settlesAfter(1);
  const { value, ms } = await timed(() => settledPayment("pay_fast"));
  assert.equal(value.status, "succeeded");
  assert.ok(ms < 250, `settled after ${ms} ms`);
});

it("waits for a payment that settles after almost two seconds no longer than a 500 ms poll would, without polling it in a tight loop", async function () {
  this.timeout(10_000);
  settlesAfter(1_900);
  const { value, ms } = await timed(() => settledPayment("pay_slow"));
  assert.equal(value.status, "succeeded");
  assert.ok(ms >= 1_900 && ms < 2_300, `settled after ${ms} ms`);
  assert.ok(provider.reads <= 10, `${provider.reads} reads`);
});
