export const CONFORMANCE_SCRIPT = `
globalThis.after = () => undefined;
const own = (name) => require(require.resolve(name, { paths: [process.cwd()] }));
const support = own("@antelopejs/interface-subscriptions/tests/support");
const seconds = (() => { try { support.assertEpochMillis(Math.floor(Date.now() / 1000), "when"); return "accepted"; } catch (error) { return error.name; } })();
const millis = (() => { try { support.assertEpochMillis(Date.now(), "when"); return "accepted"; } catch (error) { return error.name; } })();
const whole = support.inWholeSeconds(60_000) % 1000;
console.log(JSON.stringify({
  method: support.TEST_METHOD ?? null,
  declines: support.TEST_METHOD_DECLINES_LATER ?? null,
  events: support.EVENTS_OBSERVABLE,
  currency: support.amount(5).currency,
  value: support.amount(5).value,
  absent: support.ABSENT_ID.startsWith("antelope-absent-"),
  seconds,
  millis,
  whole,
  day: support.DAY_MS,
  trialDays: support.TRIAL_DAYS,
  keyDiffers: support.key() !== support.key(),
  referenceDiffers: support.reference() !== support.reference(),
}));
`;

export const CONFORMANCE_FILES = `
const fs = require("node:fs");
const path = require("node:path");
const dist = path.join(process.cwd(), "dist", "tests");
const files = fs.readdirSync(dist).filter((name) => name.endsWith(".js")).sort();
const manifest = require(path.join(process.cwd(), "package.json"));
console.log(JSON.stringify({ files, exported: manifest.exports["./tests/*"], shipped: manifest.files }));
`;

