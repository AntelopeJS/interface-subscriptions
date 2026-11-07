const assert = require("node:assert/strict");
const { setTimeout: sleep } = require("node:timers/promises");

const { ImplementInterface } = require("@antelopejs/interface-core");
const { GetPayment } = require("@antelopejs/interface-payment");

const { settledPayment } = require("#built/tests/support");

/** @param {number} value */
const amount = (value) => ({ value, currency: "EUR" });

const provider = {
  reads: 0,
  start: 0,
  settlesAfter: 0,
  latency: 0,
  stallRead: 0,
  stall: 0,
  /** @type {{ start: number; end: number }[]} */
  log: [],
};

ImplementInterface(
  { GetPayment },
  {
    GetPayment: async (id) => {
      const start = Date.now();
      provider.start ||= start;
      provider.reads += 1;
      const settled = start - provider.start >= provider.settlesAfter;
      const stalled = provider.reads === provider.stallRead;
      await sleep(stalled ? provider.stall : provider.latency);
      provider.log.push({ start, end: Date.now() });
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
 * the first read starts, each read taking `latency` ms except read number
 * `stallRead`, which takes `stall` ms. The read log is reset.
 *
 * @param {number} ms
 * @param {{ latency?: number; stallRead?: number; stall?: number }} [timing]
 */
function settlesAfter(ms, timing = {}) {
  Object.assign(provider, {
    reads: 0,
    start: 0,
    settlesAfter: ms,
    latency: 0,
    stallRead: 0,
    stall: 0,
    log: [],
    ...timing,
  });
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

it("sees a payment no later than a 500 ms poll would when every read takes 10 ms", async function () {
  this.timeout(10_000);
  settlesAfter(501, { latency: 10 });
  const { value, ms } = await timed(() => settledPayment("pay_latent"));
  assert.equal(value.status, "succeeded");
  assert.ok(ms < 700, `settled after ${ms} ms`);
});

it("does not read back to back more than once after a read stalls", async function () {
  this.timeout(10_000);
  settlesAfter(3_000, { stallRead: 2, stall: 1_500 });
  const { value } = await timed(() => settledPayment("pay_stalled"));
  assert.equal(value.status, "succeeded");
  const pauses = provider.log
    .slice(1)
    .map((read, index) => read.start - provider.log[index].end);
  const backToBack = pauses.filter((pause) => pause < 40).length;
  assert.ok(backToBack <= 1, `pauses ${pauses.join(", ")} ms`);
});

it("skips an extra read that a 300 ms read would carry past the next 500 ms read", async function () {
  this.timeout(10_000);
  settlesAfter(790, { latency: 300 });
  const { value, ms } = await timed(() => settledPayment("pay_slow_reads"));
  assert.equal(value.status, "succeeded");
  assert.ok(ms < 1_250, `settled after ${ms} ms`);
});
