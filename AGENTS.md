# AGENTS.md

## Repo structure

- `main.ts` — minimal module wrapper, re-exports `lib/cli`
- `lib/cli.ts` — main `Cli` class: entrypoint for all commands
- `lib/config.ts` — thin `configstore` wrapper keyed to package name (`@codehivetx/mourt`)
- `lib/plugin-taskw.ts` — spawns `task` and returns its exported JSON
- `bin/mourt` — CLI binary (plain JS, not TS); uses `minimist` with `Cli.opts`
- `package.json` declares `"bin": { "mourt": "bin/mourt" }`

TypeScript compiles to `dist/`, mirroring the source tree (`dist/main.js`,
`dist/lib/*.js`). Source stays in `lib/`, compiled JS in `dist/lib/`.

## Commands

```
npm run build     # tsc — compiles to dist/
npm test          # placeholder only: exits 1 because no tests exist yet
```

To run the CLI directly from the repo (requires a prior `npm run build`):

```
node bin/mourt -D dir=/path/to/data -m 'message'
node bin/mourt -l
node bin/mourt -D 'plugin.taskw.command=dock-warrior'
node bin/mourt -P dir                    # get current dir
node bin/mourt -P path                   # which config file is in effect
```

### Choosing a config file

By default the config lives at `configstore/@codehivetx/mourt.json` under the XDG
config dir (`~/$XDG_CONFIG_HOME`, else `~/.config`). To point somewhere else —
**strongly preferred for experiments and tests, so the real config is never
written**:

```
mourt -c /tmp/scratch.json -D dir=/tmp/scratch-data -m 'message'
MOURT_CONFIG=/tmp/scratch.json mourt -l
mourt -c /tmp/scratch.json -P path        # confirm where it resolved
```

Precedence: `-c/--config` > `$MOURT_CONFIG` > configstore default. Note that
`-c` on its own (with no other command) prints the resolved path.

## Gotchas

- **No tests exist yet.** `npm test` exits 1 by design (`echo "Error: no test specified" && exit 1`); nothing is broken.
- `bin/mourt` requires `../dist/lib/cli` — the *compiled* output, not `lib/cli.ts`. Build before running.
- `lib/config.ts` requires `../../package.json` because the compiled file lives at `dist/lib/`. Moving between source and compiled dirs means different relative depths.
- `lib/config.ts` returns `createConfig(argv)` — calling code must invoke it: `require('./config').createConfig(argv)`. The store is opened **per `Cli` instance** in the constructor, not at module load, so that `-c`/`$MOURT_CONFIG` can redirect it and tests can inject a throwaway store.
- `lib/config.ts` must not pass a `defaults` argument to `Configstore`: the constructor *writes* the file whenever `defaults` is truthy (configstore/index.js:24-29), which would rewrite the config on every read.
- `lib/config.ts` validates the target is a JSON object before handing it to configstore, because configstore silently **empties** a file it can't parse (configstore/index.js:47-49).
- `bin/mourt` must parse argv *before* `new Cli(argv)`, and construction is wrapped in try/catch — a bad `--config` throws during construction, outside the `run()` promise chain.
- `lib/*.ts` are CommonJS scripts with no `import`/`export`, so TypeScript treats them as sharing **one global scope**. Top-level `const` names must be unique across files (hence `nodefs`/`nodepath` in `config.ts`). Do not "fix" this with `export {}` — that emits an `__esModule` marker into the CJS and can confuse bundler interop.
- `require('../package.json')` resolves fine because `tsconfig` uses CommonJS. Don't "fix" it to an ESM import.
- `config.get('dir')` returns `undefined` until `-D dir=...` is set. `Cli.requireBaseDir()` throws a helpful error rather than letting `fs.opendir(undefined)` fail opaquely.
- Data is stored under the config dir set by `-D dir=...`, with date-subdirectories (`YYYY/MM/DD/`)
- `date` on disk is an **ISO string** (`date.toISOString()`), not a `Date` object — `JSON.stringify` would have coerced it anyway, so this is explicit. Read it back with `new Date(blob.date)`.
- `taskwarrior` is **optional** on disk — `doMessage` deletes the key when there are no active tasks.
- When listing (`-l`) with `-p project`, entries **without** a `taskwarrior` field are excluded (they can't be matched). Without `-p`, all entries are listed.
- Build output (`dist/`) is git-ignored and shipped via `package.json` `files`, which ships `dist/**/*.js` + `dist/**/*.d.ts` and deliberately excludes `.ts` sources and `.map` files. There is no `.npmignore` — the `files` field supersedes it.
- `main.ts` uses `module.exports`/`require` deliberately (CommonJS), matching the rest of the codebase and the `exports` map.
- `@types/node` is v26 but the tsconfig base is `@tsconfig/node16`. The type surface now describes a much newer Node than the compile target, so "node16 support" is **advisory, not enforced** — don't assume a newer Node API is safe for consumers. The base is kept only so the emitted JS shape is unchanged.
- Known pre-existing advisory: `semver@6.3.0` (ReDoS, GHSA-c2qf-rxjj-qqgw) via `configstore → make-dir`. Not reachable from user input here; left alone deliberately rather than papering over with `npm audit fix`.

## Todo / Planned Fixes

### Critical
- [x] **`lib/plugin-taskw.ts`** crash risk — guard the `githubbody`/`annotations` deletes with `Array.isArray(j) && j.length > 0 && j[0]`
- [x] **`lib/plugin-taskw.ts`** — accumulate stderr into `err` so it reaches the rejection message (previously only printed, so `err` was always empty)
- [x] **`lib/cli.ts`** — `baseDir` was `undefined` when `dir` was never set, crashing `fs.opendir(undefined)` / `path.join`. Added `Cli.requireBaseDir()` used by `getList()` and `getDir()`
- [x] **`tsconfig.json`** — added `rootDir: "."` / `outDir: "dist"` (plus `declaration: true` for the `types` entries)

### Medium
- [x] **`package.json`** — added `exports`, `types`, and `files`; moved compiled entry to `dist/main.js`
- [x] **`bin/mourt`** — updated to require `../dist/lib/cli`; comment now states compiled-vs-source explicitly
- [x] **`lib/cli.ts`** — flattened the nested `if (proj && taskwarrior)` / `else` filter into two guard clauses (behavior unchanged)
- [x] **`lib/cli.ts`** — removed the unused `readFile` import
- [x] **`lib/cli.ts`** — `date` now explicitly stored as an ISO string; `MourtBlob` marks `taskwarrior`/`shortDate`/`localDate` optional to match what's actually on disk
- [x] **`lib/plugin-taskw.ts`** — removed the no-op `fetchTask` → `fetchData` wrapper; the exported function is now the implementation

### Low
- [x] **`AGENTS.md`** — clarified that `npm test` means "no tests yet", not "tests are broken"
- [x] **`tsconfig.json`** — dropped redundant `"module": "commonjs"` (already set by `@tsconfig/node16`)
- [x] **`.npmignore`** — deleted; superseded by the `files` field in `package.json`

### Remaining / Not Done
- [ ] **No test suite.** `npm test` still exits 1. Everything above was verified manually (CLI smoke tests + `npm pack` install test), but there is no regression coverage. Adding a runner (e.g. `node:test`) is the natural next step.
- [ ] **`main.ts` / codebase stays CommonJS.** Works fine and matches the `exports` map; converting to ESM would be a larger, riskier change with no current benefit.
- [ ] **`getList()` reads every JSON file** to filter by project — `// TODO: filter by date for speed` remains unaddressed.
- [ ] **`doMessage` has a `// TODO: override`** — unclear if the intent is to allow date/time override for backfilling entries.