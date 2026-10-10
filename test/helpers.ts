/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test helpers. Everything here is scoped to a throwaway temp dir so the real
 * configstore file is never read or written by the suite.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { createConfig } = require('../lib/config');

/** Scratch dir for a test. Always removed via cleanup(). */
export function tempDir(prefix = 'mourt-test-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanup(...dirs: string[]): void {
    for (const d of dirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            // best effort
        }
    }
}

/**
 * Write a config file and return its path. This is the -c / $MOURT_CONFIG
 * equivalent, used to point a Cli at a throwaway store.
 */
export function writeConfigFile(dir: string, obj: unknown, name = 'config.json'): string {
    const p = path.join(dir, name);
    fs.writeFileSync(p, JSON.stringify(obj, null, '\t'), 'utf8');
    return p;
}

/**
 * A config store pointed at a throwaway file (never the real one).
 * Routed through the real createConfig so the store id matches package.json
 * and cannot drift out of sync with lib/config.ts.
 */
export function tempStore(dir: string, name = 'config.json'): any {
    return createConfig({ config: path.join(dir, name) });
}

/** Seed `obj` as a config file and return an open store on it. */
export function storeWith(dir: string, obj: unknown, name = 'config.json'): any {
    return createConfig({ config: writeConfigFile(dir, obj, name) });
}

/** Create an executable /bin/sh script and return its path. */
export function writeScript(dir: string, name: string, body: string): string {
    const p = path.join(dir, name);
    fs.writeFileSync(p, body, 'utf8');
    fs.chmodSync(p, 0o755);
    return p;
}

/** A fake `task` that prints `json` on stdout and exits 0. */
export function fakeTask(dir: string, json: string, name = 'fake-task.sh'): string {
    return writeScript(dir, name, `#!/bin/sh\ncat <<'MOURT_JSON_EOF'\n${json}\nMOURT_JSON_EOF\n`);
}

/** A fake `task` that writes `msg` to stderr and exits `code`. */
export function fakeTaskFailing(dir: string, msg: string, code = 4, name = 'fake-task-fail.sh'): string {
    return writeScript(dir, name,
        `#!/bin/sh\nprintf '%s' '${msg.replace(/'/g, "'\\''")}' >&2\nexit ${code}\n`);
}

/** Set MOURT_CONFIG for the duration of `fn`, then restore. */
export async function withEnvConfig<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
    const prior = process.env.MOURT_CONFIG;
    if (value === undefined) {
        delete process.env.MOURT_CONFIG;
    } else {
        process.env.MOURT_CONFIG = value;
    }
    try {
        return await fn();
    } finally {
        if (prior === undefined) {
            delete process.env.MOURT_CONFIG;
        } else {
            process.env.MOURT_CONFIG = prior;
        }
    }
}

export interface Captured {
    /** everything written to console.log / console.dir */
    out: string[];
    /** everything written to console.error */
    err: string[];
    /** the resolved value of fn */
    result: unknown;
}

/** Capture console output while fn runs. */
export async function captureConsole(fn: () => Promise<unknown>): Promise<Captured> {
    const out: string[] = [];
    const err: string[] = [];
    const orig = { log: console.log, dir: console.dir, error: console.error };
    const fmt = (args: unknown[]) => args.map(a => String(a)).join(' ');
    console.log = (...a: unknown[]) => { out.push(fmt(a)); };
    console.dir = (...a: unknown[]) => { out.push(fmt(a)); };
    console.error = (...a: unknown[]) => { err.push(fmt(a)); };
    try {
        const result = await fn();
        return { out, err, result };
    } finally {
        console.log = orig.log;
        console.dir = orig.dir;
        console.error = orig.error;
    }
}

/** Collect console output synchronously. */
export function captureConsoleSync(fn: () => unknown): string[] {
    const out: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => { out.push(a.map(x => String(x)).join(' ')); };
    try {
        fn();
        return out;
    } finally {
        console.log = orig;
    }
}
