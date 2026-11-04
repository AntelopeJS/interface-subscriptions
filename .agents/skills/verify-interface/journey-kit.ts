import { equal, interrupted } from "@antelopejs/tooling-configs/verify";
import type { CallRequest, Journey, JourneyContext } from "@antelopejs/tooling-configs/verify";

/** Printed by a packed-interface script: a JSON value the journey compares with the docs. */
export type Printed = string | number | boolean | null | Printed[] | { [key: string]: Printed };

/** The request every validation scenario starts from: the README quick start's monthly EUR 19 plan. */
export const BASE = `{ reference: "acct_1", customer: "cus_1", paymentMethod: "pm_1", amount: { value: 1900, currency: "EUR" }, interval: "month" }`;

/** A fixed clock, so a date is in the future or the past whatever day the journey runs. */
export const NOW = 1_800_000_000_000;

export const PRELUDE = `
const c = require(process.argv[1]);
const base = ${BASE};
const NOW = ${NOW};
const verdict = (request, now) => {
  try {
    c.ValidateSubscriptionRequest(request, now);
    return "accepted";
  } catch (error) {
    return [error.name, error.message, error instanceof c.InvalidSubscriptionRequestError, error instanceof c.SubscriptionError, error instanceof Error];
  }
};
const refused = (request, now) => {
  const result = verdict(request, now);
  return Array.isArray(result) ? result[1] : result;
};
`;

/** Runs a script against the packed `dist/index.js` and checks the JSON it prints against what the docs state. */
export function packed(title: string, script: string, expected: Printed, label: string): Journey {
  return {
    title,
    entryPoint: "the packed interface required from a consumer",
    async run(context: JourneyContext) {
      const loaded = await context.command(label, "node", ["-e", `${PRELUDE}\n${script}`, `${context.repo}/dist/index.js`], {
        cwd: context.repo,
      });
      context.expect(loaded.folder, [
        { name: `${label} ran`, pass: loaded.exitCode === 0, detail: loaded.stderr.slice(-300) },
        equal(`${label} answers as docs/ states`, loaded.stdout.trim(), JSON.stringify(expected)),
      ]);
    },
  };
}

/** The header of a type probe: `Assert<Same<A, B>>` fails to compile when A and B are not assignable both ways. */
export const PROBE_HEADER = `
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Accepts<Target, Value> = [Value] extends [Target] ? true : false;
type Not<T extends boolean> = T extends true ? false : true;
type Assert<T extends true> = T;
`;

/** Compiles a probe against the packed declarations in a consumer's strict mode. */
export function declared(title: string, probe: string, label: string): Journey {
  return {
    title,
    entryPoint: "a TypeScript consumer compiling against the packed declarations",
    async run(context) {
      const file = `${context.work}/probe.ts`;
      context.edit("write the type probe", file, `import type * as Api from "${context.repo}/dist/index";\n${PROBE_HEADER}\n${probe}`);
      const compiled = await context.command("compile the type probe", "node", [
        `${context.repo}/node_modules/typescript/bin/tsc`,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--typeRoots",
        `${context.repo}/node_modules/@types`,
        "--types",
        "node",
        file,
      ]);
      context.expect(compiled.folder, [{ name: label, pass: compiled.exitCode === 0, detail: compiled.stdout.slice(0, 600) }]);
    },
  };
}

/** One consumer call through core: the member to call, its arguments, and the proxy path the stub provider must log. */
export interface Call {
  name: string;
  args: NonNullable<CallRequest["args"]>;
}

export const REQUEST = { reference: "acct_1", customer: "cus_1", paymentMethod: "pm_1", amount: { value: 1900, currency: "EUR" }, interval: "month" };

/** Calls each member of the loaded interface through core with the arguments a backend passes, and checks the stub provider received them in order. */
export function throughCore(title: string, calls: Call[]): Journey {
  return {
    title,
    entryPoint: "a consumer module calling the packed interface in `ajs project dev`",
    async run(context) {
      const app = await context.dev("ajs project dev", context.fixture());
      for (const { name, args } of calls) {
        const result = await context.call(`call ${name}`, app, { path: [name], args });
        context.expect(result.folder, [
          { name: `${name} resolved through core`, pass: result.ok, detail: JSON.stringify(result.value) },
          equal(`${name} reached the provider with its arguments in order`, result.value, { stub: `.:${name}`, args }),
        ]);
      }
      const stopped = await context.stop("SIGINT", app);
      context.expect(stopped.folder, [interrupted(stopped)]);
    },
  };
}

export function suite(title: string, script: string, expected: Printed, label: string, env: { [name: string]: string } = {}): Journey {
  return {
    title,
    entryPoint: "the conformance suite a provider author imports from the packed interface",
    async run(context: JourneyContext) {
      const loaded = await context.command(label, "node", ["-e", script], { cwd: context.repo, env });
      context.expect(loaded.folder, [
        { name: `${label} ran`, pass: loaded.exitCode === 0, detail: loaded.stderr.slice(-300) },
        equal(`${label} answers as README.md states`, loaded.stdout.trim(), JSON.stringify(expected)),
      ]);
    },
  };
}
