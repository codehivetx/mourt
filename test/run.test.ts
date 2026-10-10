/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Synthetic content only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { tempDir, cleanup, storeWith, writeConfigFile, fakeTask, captureConsole } from './helpers';

const Cli = require('../lib/cli');

/** A Cli on a throwaway config, with the given extra config keys. */
function setup(extra: Record<string, unknown> = {}): { cli: any, dir: string, dataDir: string } {
    const dir = tempDir();
    const dataDir = tempDir();
    const store = storeWith(dir, {
        dir: dataDir,
        plugin: { taskw: { command: fakeTask(dir, '[]') } },
        ...extra
    });
    return { cli: new Cli({ config: store.path }), dir, dataDir };
}

test('Cli.run dispatch', async (t) => {
    await t.test('rejects stray positional arguments', async () => {
        const { cli, dir, dataDir } = setup();
        try {
            await assert.rejects(() => cli.run({ _: ['oops'] }), /wrong usage/);
        } finally {
            cleanup(dir, dataDir);
        }
    });

    await t.test('-D writes to the store in effect and -P reads it back', async () => {
        const { cli, dir, dataDir } = setup();
        try {
            await captureConsole(() => cli.run({ set: 'dir=/synthetic/set-by-flag', _: [] }));
            assert.equal(cli.config.get('dir'), '/synthetic/set-by-flag');

            const { out } = await captureConsole(() => cli.run({ get: 'dir', _: [] }));
            assert.deepEqual(out, ['/synthetic/set-by-flag']);
        } finally {
            cleanup(dir, dataDir);
        }
    });

    await t.test('-P path reports the store in effect', async () => {
        const { cli, dir, dataDir } = setup();
        try {
            const { out } = await captureConsole(() => cli.run({ get: 'path', _: [] }));
            assert.deepEqual(out, [cli.config.path]);
            assert.ok(path.isAbsolute(out[0]), 'expected an absolute path');
            // and it must be the throwaway file, not the real configstore
            assert.ok(out[0].includes(dir), `expected the temp config, got ${out[0]}`);
        } finally {
            cleanup(dir, dataDir);
        }
    });

    await t.test('-D and -P only touch the store this instance opened', async () => {
        const cfgDir = tempDir();
        const otherDir = tempDir();
        try {
            const store = storeWith(cfgDir, { dir: '/synthetic/before', marker: 'original' });
            const a = new Cli({ config: store.path });
            const b = new Cli({ config: storeWith(otherDir, { marker: 'untouched' }).path });

            await captureConsole(() => a.run({ set: 'dir=/synthetic/after', _: [] }));
            assert.equal(a.config.get('dir'), '/synthetic/after');
            assert.equal(b.config.get('marker'), 'untouched', 'second instance must be unaffected');
            assert.equal(store.get('marker'), 'original', 'unrelated keys must survive');
        } finally {
            cleanup(cfgDir, otherDir);
        }
    });

    await t.test('-P on an unset key prints undefined', async () => {
        const { cli, dir, dataDir } = setup();
        try {
            const { out } = await captureConsole(() => cli.run({ get: 'no.such.key', _: [] }));
            assert.deepEqual(out, ['undefined']);
        } finally {
            cleanup(dir, dataDir);
        }
    });

    await t.test('-c on its own prints the resolved config path', async () => {
        const dir = tempDir();
        try {
            const cfg = writeConfigFile(dir, {});
            const cli = new Cli({ config: cfg });
            const { out } = await captureConsole(() => cli.run({ config: cfg, _: [] }));
            assert.deepEqual(out, [cfg]);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('-l lists written entries', async () => {
        const { cli, dir, dataDir } = setup();
        try {
            await captureConsole(() => cli.run({ message: 'synthetic listing', _: [] }));
            const { out } = await captureConsole(() => cli.run({ list: true, _: [] }));
            assert.ok(out.some(line => line.includes('synthetic listing')), `got ${JSON.stringify(out)}`);
        } finally {
            cleanup(dir, dataDir);
        }
    });

    await t.test('-l with no data dir configured fails cleanly', async () => {
        const cfgDir = tempDir();
        try {
            const cli = new Cli({ config: storeWith(cfgDir, {}).path });
            await assert.rejects(() => cli.run({ list: true, _: [] }), /no data dir configured/);
        } finally {
            cleanup(cfgDir);
        }
    });

    await t.test('opts expose the documented aliases', () => {
        const { alias } = Cli.opts;
        assert.equal(alias.m, 'message');
        assert.equal(alias.D, 'set');
        assert.equal(alias.P, 'get');
        assert.equal(alias.p, 'project');
        assert.equal(alias.l, 'list');
        assert.equal(alias.c, 'config');
    });

    await t.test('a config file can be seeded directly, without -D', async () => {
        const dataDir = tempDir();
        const cfgDir = tempDir();
        try {
            fs.writeFileSync(path.join(dataDir, 'seed.json'), JSON.stringify({
                date: '2022-03-04T10:00:00.000Z', message: 'seeded by config'
            }));
            const cfg = writeConfigFile(cfgDir, { dir: dataDir });
            const cli = new Cli({ config: cfg });
            const { out } = await captureConsole(() => cli.run({ list: true, _: [] }));
            assert.ok(out.some(line => line.includes('seeded by config')));
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });
});
