/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { tempDir, cleanup, captureConsole } from './helpers';

const Cli = require('../lib/cli');

test('Cli statics', async (t) => {
    await t.test('dateToDir zero-pads month and day', () => {
        assert.equal(Cli.dateToDir(new Date(2022, 0, 5)), '2022/01/05');
        assert.equal(Cli.dateToDir(new Date(2022, 8, 9)), '2022/09/09');
        assert.equal(Cli.dateToDir(new Date(2022, 11, 31)), '2022/12/31');
        // built from local components, so this is a local-date directory
        assert.equal(Cli.dateToDir(new Date(2020, 5, 15)), '2020/06/15');
    });

    await t.test('asShortDate accepts a string or a Date', () => {
        const d = new Date(2022, 2, 4);
        const fromDate = Cli.asShortDate(d);
        const fromString = Cli.asShortDate(d.toISOString());
        assert.equal(typeof fromDate, 'string');
        assert.ok(fromDate.length > 0);
        // a locale-stable comparison: both input forms must agree
        assert.equal(fromString, fromDate);
    });

    await t.test('getAllJsonFiles recurses and skips non-JSON', async () => {
        const dir = tempDir();
        try {
            fs.mkdirSync(path.join(dir, 'nested', 'deep'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'a.json'), '{}');
            fs.writeFileSync(path.join(dir, 'b.txt'), 'nope');
            fs.writeFileSync(path.join(dir, 'c.JSON'), 'wrong case');
            fs.writeFileSync(path.join(dir, 'nested', 'd.json'), '{}');
            fs.writeFileSync(path.join(dir, 'nested', 'deep', 'e.json'), '{}');

            const got = (await Cli.getAllJsonFiles(dir)).sort();
            assert.deepEqual(got, [
                path.join(dir, 'a.json'),
                path.join(dir, 'nested', 'd.json'),
                path.join(dir, 'nested', 'deep', 'e.json')
            ].sort());
        } finally {
            cleanup(dir);
        }
    });

    await t.test('getAllJsonFiles on a missing dir rejects', async () => {
        await assert.rejects(() => Cli.getAllJsonFiles(path.join(tempDir(), 'nope')));
    });

    await t.test('readMourtFile parses and derives shortDate', async () => {
        const dir = tempDir();
        try {
            const good = path.join(dir, 'good.json');
            fs.writeFileSync(good, JSON.stringify({
                date: new Date(2022, 2, 4).toISOString(),
                message: 'hi'
            }));
            const blob = await Cli.readMourtFile(good);
            assert.equal(blob.message, 'hi');
            assert.equal(typeof blob.shortDate, 'string');

            // no date -> no shortDate, must not throw
            const nodate = path.join(dir, 'nodate.json');
            fs.writeFileSync(nodate, JSON.stringify({ message: 'x' }));
            const b2 = await Cli.readMourtFile(nodate);
            assert.equal(b2.shortDate, undefined);

            const bad = path.join(dir, 'bad.json');
            fs.writeFileSync(bad, '{oops');
            await captureConsole(async () => {
                await assert.rejects(() => Cli.readMourtFile(bad), SyntaxError);
            });
        } finally {
            cleanup(dir);
        }
    });
});
