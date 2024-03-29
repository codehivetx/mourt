/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const {spawn} = require('child_process');

function fetchData(config: any) {

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
        taskw.stderr.on('data', (data : any) => console.error(data.toString('utf-8')));
        taskw.on('close', (code : number) => {
            if((code !== 0)) {
                return reject(Error('Taskw: ' + (err || 'non zero exit')));
            }
            const j = JSON.parse(msg);
            // this one is too big
            delete (j || [])[0].githubbody;
            delete (j || [])[0].annotations;

            return resolve(j);
        });
    });
}

module.exports.fetchTask = async function fetchTask(config: any) {
    const data = await fetchData(config);
    // console.dir(data);
    return data;
};
