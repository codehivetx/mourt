/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Spawns the real bin/mourt as a child process, which is what caught the
 * dist/ layout break that tsc alone did not. Every run is pointed at a
 * throwaway config and data dir via -c, so the user's real configstore file
 * is never read or written.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';

import { tempDir, cleanup, writeConfigFile, fakeTask } from './helpers';

// dist-test/test -> dist-test -> repo root
const REPO = path.join(__dirname, '..', '..');
const BIN = path.join(REPO, 'bin', 'mourt');

interface Run { code: number, stdout: string, stderr: string }

function mourt(args: string[], env: NodeJS.ProcessEnv = {}): Promise<Run> {
    return new Promise(resolve => {
        execFile(process.execPath, [BIN, ...args],
            { cwd: REPO, env: { ...process.env, ...env } },
            (err, stdout, stderr) => {
                const code = err && typeof (err as any).code === 'number' ? (err as any).code : 0;
                resolve({ code, stdout, stderr });
            });
    });
}

/** A throwaway config + data dir, with a fake `task`. */
function scenario(): { config: string, dataDir: string, cfgDir: string } {
    const cfgDir = tempDir('mourt-e2e-');
    const dataDir = tempDir('mourt-e2e-data-');
    const config = writeConfigFile(cfgDir, {
        dir: dataDir,
        plugin: { taskw: { command: fakeTask(cfgDir, '[]') } }
    });
    return { config, dataDir, cfgDir };
}

test('e2e: bin/mourt', { skip: !fs.existsSync(path.join(REPO, 'dist', 'lib', 'cli.js')) ? 'run npm run build first' : false },
    async (t) => {
        await t.test('records and lists a message through a redirected config', async () => {
            const s = scenario();
            try {
                const write = await mourt(['-c', s.config, '-m', 'synthetic e2e message']);
                assert.equal(write.code, 0, `write failed: ${write.stderr}`);

                const listed = await mourt(['-c', s.config, '-l']);
                assert.equal(listed.code, 0, `list failed: ${listed.stderr}`);
                assert.match(listed.stdout, /synthetic e2e message/);

                // it really did write into the throwaway data dir
                const files = fs.readdirSync(s.dataDir, { recursive: true } as any) as string[];
                assert.equal(files.filter(f => String(f).endsWith('.json')).length, 1);
            } finally {
                cleanup(s.cfgDir, s.dataDir);
            }
        });

        await t.test('-P path confirms which config is in effect', async () => {
            const s = scenario();
            try {
                const r = await mourt(['-c', s.config, '-P', 'path']);
                assert.equal(r.code, 0);
                assert.equal(fs.realpathSync(r.stdout.trim()), fs.realpathSync(s.config));
            } finally {
                cleanup(s.cfgDir, s.dataDir);
            }
        });

        await t.test('MOURT_CONFIG works without -c', async () => {
            const s = scenario();
            try {
                const r = await mourt(['-P', 'path'], { MOURT_CONFIG: s.config });
                assert.equal(r.code, 0);
                assert.equal(fs.realpathSync(r.stdout.trim()), fs.realpathSync(s.config));
            } finally {
                cleanup(s.cfgDir, s.dataDir);
            }
        });

        await t.test('-c beats $MOURT_CONFIG', async () => {
            const a = scenario();
            const b = scenario();
            try {
                const r = await mourt(['-c', a.config, '-P', 'path'], { MOURT_CONFIG: b.config });
                assert.equal(fs.realpathSync(r.stdout.trim()), fs.realpathSync(a.config));
            } finally {
                cleanup(a.cfgDir, a.dataDir, b.cfgDir, b.dataDir);
            }
        });

        await t.test('a corrupt --config exits 1 with a clean message', async () => {
            const dir = tempDir('mourt-e2e-');
            try {
                const bad = path.join(dir, 'bad.json');
                fs.writeFileSync(bad, 'not json{', 'utf8');
                const before = fs.readFileSync(bad, 'utf8');

                const r = await mourt(['-c', bad, '-P', 'dir']);
                assert.equal(r.code, 1);
                assert.match(r.stderr, /not valid JSON/);
                // no raw stack trace
                assert.doesNotMatch(r.stderr, /at .*\(.*:\d+:\d+\)/);
                // and, critically, configstore did not blank it
                assert.equal(fs.readFileSync(bad, 'utf8'), before);
            } finally {
                cleanup(dir);
            }
        });

        await t.test('listing with no data dir configured exits 1 cleanly', async () => {
            const dir = tempDir('mourt-e2e-');
            try {
                const config = writeConfigFile(dir, {});
                const r = await mourt(['-c', config, '-l']);
                assert.equal(r.code, 1);
                assert.match(r.stderr, /no data dir configured/);
            } finally {
                cleanup(dir);
            }
        });

        await t.test('wrong usage exits 1', async () => {
            const s = scenario();
            try {
                const r = await mourt(['-c', s.config, 'stray-positional']);
                assert.equal(r.code, 1);
                assert.match(r.stderr, /wrong usage/);
            } finally {
                cleanup(s.cfgDir, s.dataDir);
            }
        });
    });