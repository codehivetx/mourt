# AGENTS.md

## Repo structure

- `main.ts` — minimal module wrapper, re-exports `lib/cli`
- `lib/cli.ts` — main `Cli` class: entrypoint for all commands
- `lib/config.ts` — thin `configstore` wrapper keyed to package name (`@codehivetx/mourt`)
- `bin/mourt` — CLI binary (plain JS, not TS); uses `minimist` with `Cli.opts`
- `package.json` declares `"bin": "bin/mourt"`

## Commands

```
npm run build     # tsc — compiles main.ts and lib/*.ts
npm test          # BROKEN: no tests configured; fails with exit 1
npm start         # none (not set up)
```

To run the CLI directly from the repo:

```
node bin/mourt -D dir=/path/to/data -m 'message'
node bin/mourt -l
node bin/mourt -D 'plugin.taskw.command=dock-warrior'
node bin/mourt -P dir                    # get current dir
```

## Gotchas

- `npm test` exits 1 even though nothing is broken — tests are not yet configured
- `lib/config.ts` returns a lazy `new Configstore(name)` — calling code must invoke the function: `require('./config')()`
- Data is stored under the config dir set by `-D dir=...`, with date-subdirectories (`YYYY/MM/DD/`)
- `bin/mourt` is intentionally plain JS (see comment in file)
- Build artifacts (`main.js`, `lib/*.js`, `*.js.map`) are git-ignored and excluded from npm
- When listing (`-l`) with `-p project`, entries **without** a `taskwarrior` field are excluded (not just non-matching ones)
