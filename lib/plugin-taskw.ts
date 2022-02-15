const {spawn} = require('child_process');

function fetchData() {
    return new Promise((resolve, reject) => {
        const taskw = spawn('task', ['+ACTIVE', 'export']);
        let msg = '';
        let err = '';
        taskw.stdout.on('data', (data : any) => (msg = data.toString('utf-8')));
        taskw.stderr.on('data', (data : any) => console.error(data.toString('utf-8')));
        taskw.on('close', (code : number) => {
            if((code !== 0)) {
                return reject(Error('Taskw: ' + (err || 'non zero exit')));
            }
            return resolve(JSON.parse(msg));
        });
    });
}

module.exports.fetchTask = async function fetchTask() {
    const data = await fetchData();
    // console.dir(data);
    return data;
};
