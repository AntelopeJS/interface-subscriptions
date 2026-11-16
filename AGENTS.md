# interface-subscriptions

The AntelopeJS interface for recurring billing of a saved payment method, published as `@antelopejs/interface-subscriptions`. It is a contract: `src/functions.ts` declares the calls as `InterfaceFunction`s with no body; `src/types.ts`, `src/errors.ts` and `src/validation.ts` hold the types, error classes and the request validation every implementation applies. Implementations live in their own repositories.

## Versioning

`@antelopejs/interface-core` and `@antelopejs/interface-payment` are peer dependencies, and the devDependency on each uses the same range. When you raise a minimum, raise the peer range, the devDependency, and the compatibility table in `README.md` together; the docs check compares that table with `peerDependencies`. `@antelopejs/core` is the test runner, a devDependency, not a peer. Every `@antelopejs/*` range stops below the next minor of its floor: `>=0.5.0 <0.6.0` on a 0.x package, `~1.23.3` on a 1.x one. The `dependency:ranges` step of `pnpm run checks` enforces it in every tracked `package.json`.

## Tests

- `pnpm test` builds `dist`, then runs `ajs module test .`. `src/antelope.test.ts` (`antelopeJs.test` in `package.json`) points it at `test/`, so it runs `test/contract.test.js` against the compiled `dist/index.js`. It needs no credentials.
- `tests/json-object.types.ts` is a compile-time test of what `JsonObject` accepts and rejects. `tsconfig.json` (typecheck) includes `tests`; `tsconfig.build.json` (the `build` script) emits only `src`.
- `src/tests/` is the provider conformance suite. It ships as `dist/tests` and `ajs module test` runs it in a module that lists this interface in `antelopeJs.implements`. `pnpm run checks` does not run it here; run it from an implementing module with the `ANTELOPE_PAYMENT_TEST_*` and `ANTELOPE_SUBSCRIPTIONS_TEST_*` variables listed in `README.md`. When the contract changes, update the suite, `docs/4.implementing.md` and `skills/managing-subscriptions/SKILL.md`.
- `pnpm run checks` does not run the documentation check. CI runs it through the `docs-files` inputs in `.github/workflows/ci.yml`. To run it locally, clone `AntelopeJS/tooling-configs` at `v0.0.9` (the ref ci-node pins), run `npm ci --prefix actions/docs --omit=dev`, then run `node <clone>/actions/docs/check.mjs --files "$(printf 'README.md\ndocs')" --typescript-project docs/tsconfig.json` from this repository.

## Shipped files

`docs/` and `skills/` ship in the npm package with `dist`. `skills/` reaches users through `antelopeJs.skills`.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

CI runs `pnpm run checks` in full on every pull request and reports what failed. The commit hook formats and lints the staged files. Locally, run only the fast check for what you touched:

- `pnpm run typecheck` after you change types or signatures.
- `pnpm exec oxlint <files>` and `pnpm exec oxfmt <files>` on the files you changed.
- One test file, not the suite. In a module that tests with `ajs module test`: `pnpm run build`, then `pnpm exec ajs module test . -f dist/<path>.test.js`.

### Comments

Say it in code: a constraint in a type, a lint rule or a test, a public item's contract in TSDoc. Other comments are lint directives naming their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, and license or tool directives. A reason states what the code does now.

### Tests

Each test names the wrong implementation it fails on, or is deleted. Drive behaviour through the public interface. An invariant over many files is a lint rule.

### Review

No tool checks these:

- A type guard checks the nested elements and values it claims.
- A no-upward import rule rejects same-tier peers; probe it with an import.
- A finding only an evasion or a patched internal can trigger goes under Attention and never blocks.

### Suppressions

`guardrails.suppressions.json` caps lint directives, `@ts-expect-error`, `SAFETY:` comments and rules a lint config turns off. Over a cap, fix the code or remove another suppression of that kind; only the operator raises a number. After removing suppressions, run `pnpm run suppressions:update` and commit the file.

<!-- antelopejs-guardrails:end -->
