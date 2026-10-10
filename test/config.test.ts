/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { tempDir, cleanup, writeConfigFile, withEnvConfig } from './helpers';

const { resolveConfigPath, createConfig } = require('../lib/config');

test('config', async (t) => {
    const dir = tempDir();
    t.after(() => cleanup(dir));

    await t.test('returns undefined when nothing is specified', async () => {
        await withEnvConfig(undefined, async () => {
            assert.equal(resolveConfigPath({}), undefined);
            assert.equal(resolveConfigPath(), undefined);
        });
    });

    await t.test('prefers --config over $MOURT_CONFIG', async () => {
        const fromArg = writeConfigFile(dir, { a: 1 }, 'from-arg.json');
        const fromEnv = writeConfigFile(dir, { a: 2 }, 'from-env.json');
        await withEnvConfig(fromEnv, async () => {
            assert.equal(resolveConfigPath({ config: fromArg }), fromArg);
        });
    });

    await t.test('falls back to $MOURT_CONFIG', async () => {
        const fromEnv = writeConfigFile(dir, { a: 2 }, 'from-env.json');
        await withEnvConfig(fromEnv, async () => {
            assert.equal(resolveConfigPath({}), fromEnv);
        });
    });

    await t.test('resolves a relative path to absolute', async () => {
        await withEnvConfig(undefined, async () => {
            const got = resolveConfigPath({ config: 'rel.json' });
            assert.equal(path.isAbsolute(got), true);
            assert.equal(got, path.resolve('rel.json'));
        });
    });

    await t.test('accepts a path that does not exist yet', async () => {
        const missing = path.join(dir, 'nope', 'not-there.json');
        await withEnvConfig(undefined, async () => {
            assert.equal(resolveConfigPath({ config: missing }), missing);
        });
    });

    await t.test('rejects unparseable JSON rather than letting configstore empty it', async () => {
        const bad = path.join(dir, 'bad.json');
        fs.writeFileSync(bad, 'not json{', 'utf8');
        const before = fs.readFileSync(bad, 'utf8');
        await withEnvConfig(undefined, async () => {
            assert.throws(() => resolveConfigPath({ config: bad }), /not valid JSON/);
        });
        // The whole point: configstore would have silently truncated this.
        assert.equal(fs.readFileSync(bad, 'utf8'), before);
    });

    await t.test('rejects JSON that is not an object', async () => {
        for (const [name, body] of [['num.json', '5'], ['str.json', '"hi"'], ['null.json', 'null']] as const) {
            const p = path.join(dir, name);
            fs.writeFileSync(p, body, 'utf8');
            await withEnvConfig(undefined, async () => {
                assert.throws(() => resolveConfigPath({ config: p }), /must contain a JSON object/);
            });
        }
    });

    await t.test('createConfig opens the requested file', async () => {
        const cfg = writeConfigFile(dir, { dir: '/somewhere', plugin: { taskw: { command: 'x' } } });
        const store = createConfig({ config: cfg });
        assert.equal(store.path, cfg);
        // dotted lookup, which is how dir / plugin.taskw.command are read
        assert.equal(store.get('dir'), '/somewhere');
        assert.equal(store.get('plugin.taskw.command'), 'x');
    });

    await t.test('createConfig does not rewrite the file it opens', async () => {
        // configstore's constructor writes whenever `defaults` is truthy
        // (configstore/index.js:24-29), so passing none must not rewrite.
        const cfg = writeConfigFile(dir, { dir: '/keepme' });
        const before = fs.readFileSync(cfg, 'utf8');
        const mtimeBefore = fs.statSync(cfg).mtimeMs;
        createConfig({ config: cfg }).get('dir');
        assert.equal(fs.readFileSync(cfg, 'utf8'), before);
        assert.equal(fs.statSync(cfg).mtimeMs, mtimeBefore);
    });

    await t.test('a missing config file reads as empty and is created on write', async () => {
        const cfg = path.join(dir, 'fresh.json');
        const store = createConfig({ config: cfg });
        assert.equal(store.get('dir'), undefined);
        store.set('dir', '/written');
        assert.equal(fs.existsSync(cfg), true);
        assert.equal(createConfig({ config: cfg }).get('dir'), '/written');
    });
});
