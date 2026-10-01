/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const {spawn} = require('child_process');

/**
 * Run taskwarrior and return its exported tasks.
 * Rejects if taskwarrior exits non-zero.
 */
module.exports.fetchTask = function fetchTask(config: any): Promise<any[]> {

    function getTaskCommand(): string {
        return config.get('plugin.taskw.command') || 'task';
    }


    function getTaskArgs(): string[] {
        return (config.get('plugin.taskw.args') || '+ACTIVE export').split(' ');
    }

    return new Promise((resolve, reject) => {
        const taskw = spawn(getTaskCommand(), getTaskArgs());
        let msg = '';
        let err = '';
        taskw.stdout.on('data', (data : any) => (msg = msg + data.toString('utf-8')));
        taskw.stderr.on('data', (data : any) => {
            const str = data.toString('utf-8');
            err += str;
            console.error(str);
        });
        taskw.on('close', (code : number) => {
            if((code !== 0)) {
                return reject(Error('Taskw: ' + (err || 'non zero exit')));
            }
            const j: any[] = JSON.parse(msg);
            // this one is too big
            if (j && Array.isArray(j) && j.length > 0 && j[0]) {
                delete j[0].githubbody;
                delete j[0].annotations;
            }

            return resolve(j);
        });
    });
};
