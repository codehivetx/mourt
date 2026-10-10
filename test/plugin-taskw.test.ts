/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Uses real child processes (a fake `task` script on disk) rather than an
 * injected function, so the spawn path, stderr chunking and exit handling are
 * covered end to end.
 *
 * All task data below is synthetic. Nothing here mirrors real journal content.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tempDir, cleanup, tempStore, storeWith, fakeTask, fakeTaskFailing, captureConsole } from './helpers';

const { fetchTask } = require('../lib/plugin-taskw');

test('plugin-taskw fetchTask', async (t) => {
    await t.test('returns parsed tasks', async () => {
        const dir = tempDir();
        try {
            const store = tempStore(dir);
            store.set('plugin.taskw.command', fakeTask(dir, JSON.stringify([
                { id: 1, project: 'MOURT', description: 'synthetic task' }
            ])));
            const got = await fetchTask(store);
            assert.equal(got.length, 1);
            assert.equal(got[0].project, 'MOURT');
            assert.equal(got[0].description, 'synthetic task');
        } finally {
            cleanup(dir);
        }
    });

    await t.test('drops the oversized fields from the first task', async () => {
        const dir = tempDir();
        try {
            const store = tempStore(dir);
            store.set('plugin.taskw.command', fakeTask(dir, JSON.stringify([
                { id: 1, jiraid: 'MOURT-1', githubbody: 'oversized', annotations: ['oversized'] },
                { id: 2, githubbody: 'untouched' }
            ])));
            const got = await fetchTask(store);
            assert.equal('githubbody' in got[0], false);
            assert.equal('annotations' in got[0], false);
            assert.equal(got[0].jiraid, 'MOURT-1');
            // only j[0] is truncated; that is the existing behaviour
            assert.equal(got[1].githubbody, 'untouched');
        } finally {
            cleanup(dir);
        }
    });

    await t.test('survives an empty task array', async () => {
        const dir = tempDir();
        try {
            const store = tempStore(dir);
            store.set('plugin.taskw.command', fakeTask(dir, '[]'));
            assert.deepEqual(await fetchTask(store), []);
        } finally {
            cleanup(dir);
        }
    });

    await t.test('survives exported JSON that is not an array', async () => {
        const dir = tempDir();
        try {
            // the j[0] guard has to hold for objects, null elements and scalars
            for (const [name, json] of [
                ['case-object.json', '{}'],
                ['case-null-element.json', '[null]'],
                ['case-string.json', '"synthetic"']
            ] as const) {
                const store = storeWith(dir, {
                    plugin: { taskw: { command: fakeTask(dir, json, name + '.sh') } }
                });
                await assert.doesNotReject(
                    () => fetchTask(store),
                    `expected no rejection for ${json}`
                );
            }
        } finally {
            cleanup(dir);
        }
    });

    await t.test('rejects with the taskwarrior stderr text', async () => {
        const dir = tempDir();
        try {
            const store = tempStore(dir);
            store.set('plugin.taskw.command', fakeTaskFailing(dir, 'synthetic failure detail', 4));
            await captureConsole(async () => {
                await assert.rejects(
                    () => fetchTask(store),
                    /synthetic failure detail/,
                    'stderr must reach the rejection message, not "non zero exit"'
                );
            });
        } finally {
            cleanup(dir);
        }
    });

    await t.test('rejects with a generic message when stderr is empty', async () => {
        const dir = tempDir();
        try {
            const store = tempStore(dir);
            store.set('plugin.taskw.command', fakeTaskFailing(dir, '', 9, 'silent-fail.sh'));
            await captureConsole(async () => {
                await assert.rejects(() => fetchTask(store), /non zero exit/);
            });
        } finally {
            cleanup(dir);
        }
    });
});
