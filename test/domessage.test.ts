/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * All content is synthetic. doMessage() reads the wall clock, so these
 * assertions check internal consistency (ISO filename, YYYY/MM/DD directory)
 * rather than a fixed timestamp.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { tempDir, cleanup, storeWith, fakeTask, captureConsole } from './helpers';

const Cli = require('../lib/cli');

/** A Cli writing into `dataDir`, with a fake `task` that yields `json`. */
function setup(dataDir: string, json = '[{"id":1,"project":"MOURT","jiraid":"MOURT-1"}]'): any {
    const cfgDir = tempDir();
    const store = storeWith(cfgDir, {
        dir: dataDir,
        plugin: { taskw: { command: fakeTask(cfgDir, json) } }
    });
    return { cli: new Cli({ config: store.path }), cfgDir };
}

/** Every blob file under dir, as {file, blob} pairs. */
function blobsUnder(dir: string): { file: string, blob: any }[] {
    const out: { file: string, blob: any }[] = [];
    const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.json')) out.push({ file: p, blob: JSON.parse(fs.readFileSync(p, 'utf8')) });
        }
    };
    walk(dir);
    return out;
}

test('Cli.doMessage', async (t) => {
    await t.test('writes one blob and reports the path', async () => {
        const dataDir = tempDir();
        const { cli, cfgDir } = setup(dataDir);
        try {
            await captureConsole(() => cli.doMessage({ message: 'synthetic message' }));

            const found = blobsUnder(dataDir);
            assert.equal(found.length, 1);
            assert.equal(found[0].blob.message, 'synthetic message');
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });

    await t.test('stores date as an ISO string consistent with its filename and directory', async () => {
        const dataDir = tempDir();
        const { cli, cfgDir } = setup(dataDir);
        try {
            await captureConsole(() => cli.doMessage({ message: 'date consistency' }));
            const { file, blob } = blobsUnder(dataDir)[0];

            assert.equal(typeof blob.date, 'string');
            assert.equal(new Date(blob.date).toISOString(), blob.date, 'must be a round-trippable ISO string');

            // filename is exactly <ISO>.json
            assert.equal(path.basename(file), blob.date + '.json');
            // and the containing directory is the *local* date, not the UTC one.
            // Compare against the path relative to the data dir root, since the
            // date lives at the end of YYYY/MM/DD.
            const rel = path.relative(dataDir, path.dirname(file));
            assert.equal(rel, Cli.dateToDir(new Date(blob.date)));
            assert.equal(typeof blob.localDate, 'string');
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });

    await t.test('keeps the taskwarrior field when there are active tasks', async () => {
        const dataDir = tempDir();
        const { cli, cfgDir } = setup(dataDir);
        try {
            await captureConsole(() => cli.doMessage({ message: 'with task' }));
            const { blob } = blobsUnder(dataDir)[0];
            assert.ok(blob.taskwarrior, 'expected taskwarrior to be retained');
            assert.equal(blob.taskwarrior[0].project, 'MOURT');
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });

    await t.test('drops the taskwarrior field when there are no active tasks', async () => {
        const dataDir = tempDir();
        const { cli, cfgDir } = setup(dataDir, '[]');
        try {
            await captureConsole(() => cli.doMessage({ message: 'no task' }));
            const { blob } = blobsUnder(dataDir)[0];
            assert.equal('taskwarrior' in blob, false);
            assert.deepEqual(Object.keys(blob).sort(), ['date', 'localDate', 'message']);
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });

    await t.test('consecutive messages accumulate rather than overwrite', async () => {
        const dataDir = tempDir();
        const { cli, cfgDir } = setup(dataDir);
        try {
            await captureConsole(() => cli.doMessage({ message: 'first' }));
            await captureConsole(() => cli.doMessage({ message: 'second' }));
            const found = blobsUnder(dataDir);
            assert.equal(found.length, 2);
            assert.deepEqual(found.map(f => f.blob.message).sort(), ['first', 'second']);
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });

    await t.test('round-trips through getList', async () => {
        const dataDir = tempDir();
        const { cli, cfgDir } = setup(dataDir);
        try {
            await captureConsole(() => cli.doMessage({ message: 'round trip' }));
            const list = await cli.getList({});
            assert.equal(list.length, 1);
            assert.equal(list[0].message, 'round trip');
            assert.ok(list[0].shortDate, 'readMourtFile derives shortDate on read');
            assert.equal(await cli.getList({ project: 'MOURT' }).then((l: any[]) => l.length), 1);
        } finally {
            cleanup(dataDir, cfgDir);
        }
    });

    await t.test('refuses to write when no data dir is configured', async () => {
        const cfgDir = tempDir();
        try {
            const cli = new Cli({ config: storeWith(cfgDir, {}).path });
            await assert.rejects(() => cli.doMessage({ message: 'nope' }), /no data dir configured/);
        } finally {
            cleanup(cfgDir);
        }
    });
});
