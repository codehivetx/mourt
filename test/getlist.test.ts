/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fixtures are synthetic. No real journal content is used.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { tempDir, cleanup, storeWith } from './helpers';

const Cli = require('../lib/cli');

/**
 * Build a data dir with one blob per case and return its path.
 * Blobs are laid out in YYYY/MM/DD so getAllJsonFiles has to recurse.
 */
function seedDataDir(dir: string): string {
    const day = path.join(dir, '2022', '03', '04');
    fs.mkdirSync(day, { recursive: true });
    const blob = (name: string, b: unknown) =>
        fs.writeFileSync(path.join(day, name), JSON.stringify(b), 'utf8');

    blob('a-match.json', {
        date: '2022-03-04T10:00:00.000Z', message: 'msg-match',
        taskwarrior: [{ project: 'MOURT', jiraid: 'MOURT-1' }]
    });
    blob('b-other.json', {
        date: '2022-03-04T11:00:00.000Z', message: 'msg-other',
        taskwarrior: [{ project: 'OTHER', description: 'synthetic' }]
    });
    blob('c-no-taskwarrior.json', {
        date: '2022-03-04T12:00:00.000Z', message: 'msg-no-tw'
    });
    return dir;
}

test('Cli.getList', async (t) => {
    await t.test('without a project filter it returns every entry', async () => {
        const dir = seedDataDir(tempDir());
        try {
            const cli = new Cli({ config: storeWith(path.dirname(dir), { dir }).path });
            const list = await cli.getList({});
            assert.deepEqual(list.map((d: any) => d.message).sort(),
                ['msg-match', 'msg-no-tw', 'msg-other']);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('with a project filter it returns only matching entries', async () => {
        const dir = seedDataDir(tempDir());
        try {
            const cli = new Cli({ config: storeWith(path.dirname(dir), { dir }).path });
            const list = await cli.getList({ project: 'MOURT' });
            assert.deepEqual(list.map((d: any) => d.message), ['msg-match']);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('a project filter excludes entries with no taskwarrior field', async () => {
        // documented behaviour: without taskwarrior data the project cannot
        // be matched, so the entry is dropped
        const dir = seedDataDir(tempDir());
        try {
            const cli = new Cli({ config: storeWith(path.dirname(dir), { dir }).path });
            const list = await cli.getList({ project: 'MOURT' });
            assert.equal(list.some((d: any) => d.message === 'msg-no-tw'), false);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('a non-matching project filter returns nothing', async () => {
        const dir = seedDataDir(tempDir());
        try {
            const cli = new Cli({ config: storeWith(path.dirname(dir), { dir }).path });
            assert.deepEqual(await cli.getList({ project: 'NO-SUCH-PROJECT' }), []);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('entries come back in ascending order', async () => {
        const dir = seedDataDir(tempDir());
        try {
            const cli = new Cli({ config: storeWith(path.dirname(dir), { dir }).path });
            const list = await cli.getList({});
            const times = list.map((d: any) => new Date(d.date).getTime());
            assert.deepEqual(times, [...times].sort((x, y) => x - y));
        } finally {
            cleanup(dir);
        }
    });

    await t.test('requireBaseDir throws a helpful error when dir is unset', async () => {
        const dir = tempDir();
        try {
            const cli = new Cli({ config: storeWith(dir, {}).path });
            assert.throws(() => cli.requireBaseDir(), /no data dir configured/);
            await assert.rejects(() => cli.getList({}), /no data dir configured/);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('baseDir reads the dir key from the store', async () => {
        const dir = tempDir();
        try {
            const cli = new Cli({ config: storeWith(dir, { dir: '/synthetic/base' }).path });
            assert.equal(cli.baseDir, '/synthetic/base');
            assert.equal(cli.requireBaseDir(), '/synthetic/base');
        } finally {
            cleanup(dir);
        }
    });
});
