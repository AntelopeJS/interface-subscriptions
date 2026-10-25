# interface-subscriptions

The AntelopeJS interface for recurring billing of a saved payment method, published as `@antelopejs/interface-subscriptions`. It is a contract: `src/functions.ts` declares the calls as `InterfaceFunction`s with no body; `src/types.ts`, `src/errors.ts` and `src/validation.ts` hold the types, error classes and the request validation every implementation applies. Implementations live in their own repositories.

## Versioning

`@antelopejs/interface-core` and `@antelopejs/interface-payment` are peer dependencies with a `>=minimum <1.0.0` range, and the devDependency on each uses the same range. When you raise a minimum, raise the peer range, the devDependency, and the compatibility table in `README.md` together; the docs check compares that table with `peerDependencies`. `@antelopejs/core` is pinned exactly as the test runner, not a peer.

## Tests

- `pnpm test` builds `dist`, then runs `ajs module test .`. `src/antelope.test.ts` (`antelopeJs.test` in `package.json`) points it at `test/`, so it runs `test/contract.test.js` against the compiled `dist/index.js`. It needs no credentials.
- `src/tests/` is the provider conformance suite. It ships as `dist/tests` and `ajs module test` runs it in a module that lists this interface in `antelopeJs.implements`. `pnpm run checks` does not run it here; run it from an implementing module with the `ANTELOPE_PAYMENT_TEST_*` and `ANTELOPE_SUBSCRIPTIONS_TEST_*` variables listed in `README.md`. When the contract changes, update the suite, `docs/4.implementing.md` and `skills/managing-subscriptions/SKILL.md`.
- `pnpm run checks` does not run the documentation check. CI runs it through the `docs-files` inputs in `.github/workflows/ci.yml`. To run it locally, clone `AntelopeJS/tooling-configs` at `v0.0.9` (the ref ci-node pins), run `npm ci --prefix actions/docs --omit=dev`, then run `node <clone>/actions/docs/check.mjs --files "$(printf 'README.md\ndocs')" --typescript-project docs/tsconfig.json` from this repository.

## Shipped files

`docs/` and `skills/` ship in the npm package with `dist`. `skills/` reaches users through `antelopeJs.skills`.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

Finish every change with `pnpm run checks`. It runs typecheck, lint, format, knip, tests, size, ratchet, and sync, and prints only what failed. The change is done when it prints no failure.

The tools enforce most rules, listed in the table at the end. The sections below hold the rules no tool checks.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### Debt

`guardrails.ratchet.json` records the lint findings and oversize files this repository already had. Its numbers only go down. After you remove debt, run `pnpm run ratchet:update` and commit the lowered file. A rule listed there is off for `oxlint`. The ratchet counts it instead, and the pre-commit hook rejects it on every line you add.

### What enforces what

| Rule                                                                           | Enforced by                               |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| Formatting                                                                     | oxfmt                                     |
| Lint findings are errors; no rule warns                                        | oxlint preset                             |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                  |
| Every test asserts                                                             | `antelopejs/require-assertion`            |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`          |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`  |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test` |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`       |
| Files ≤ 20,000 bytes, tests included                                           | `antelopejs-check-size` (pre-commit)      |
| Existing debt only shrinks                                                     | `antelopejs-ratchet`                      |
| Types check                                                                    | `tsc` (pre-push)                          |
| No dead files, exports, or dependencies                                        | knip                                      |
| Managed files match the pack                                                   | `antelopejs-sync --check`                 |
| A test names the wrong implementation it catches                               | review; no tool                           |

<!-- antelopejs-guardrails:end -->
