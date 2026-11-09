const assert = require("node:assert/strict");

const { listsAsNewerFrom } = require("#built/tests/support");

const RETURNED_AT = 1_790_000_000_500;

/** @param {number} createdAt */
const waitAfter = (createdAt) =>
  listsAsNewerFrom({ createdAt }, RETURNED_AT) - RETURNED_AT;

/**
 * Creates subscriptions one after another against a provider whose clock runs
 * `offset` ms from this one and keeps creation times to `tick` ms, each call
 * taking `latency` ms, waiting for `listsAsNewerFrom` in between. Returns
 * whether every creation time is later than the one before it.
 *
 * @param {{ tick: number; offset: number; latency: number }} provider
 */
function createsInOrder({ tick, offset, latency }) {
  let now = 1_790_000_000_000;
  let previous = -Infinity;
  for (let step = 0; step < 2000; step += 1) {
    now += latency / 2;
    const createdAt = Math.floor((now + offset) / tick) * tick;
    now += latency / 2;
    if (createdAt <= previous) return false;
    previous = createdAt;
    now = Math.max(now, listsAsNewerFrom({ createdAt }, now));
    now += (step * 7) % 13;
  }
  return true;
}

describe("listsAsNewerFrom", () => {
  it("waits past the second for a provider that keeps whole seconds", () => {
    assert.ok(waitAfter(1_790_000_001_000) > 1000);
  });

  it("waits only milliseconds for a provider that keeps milliseconds", () => {
    assert.ok(waitAfter(1_790_000_001_234) < 10);
  });

  it("waits past the tick that the trailing zeros show", () => {
    const tenths = waitAfter(1_790_000_001_200);
    assert.ok(tenths > 100 && tenths < 1000);
  });

  it("orders creations at every tick, clock offset and latency", () => {
    for (const tick of [1, 10, 100, 1000]) {
      for (const offset of [-1500, -999, -1, 0, 1, 437, 999, 1500]) {
        for (const latency of [0, 1, 3, 250, 999]) {
          assert.ok(
            createsInOrder({ tick, offset, latency }),
            `tick ${tick}, offset ${offset}, latency ${latency}`,
          );
        }
      }
    }
  });
});
