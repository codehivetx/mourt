const config = require('./config')();
const fs = require('fs').promises;
const path = require('path');
const {fetchTask} = require('./plugin-taskw');

class Cli {

    constructor() {
    }

    static get opts() {
        return {
            alias: {
                m: 'message', // -m 'what i did'
                D: 'set',  // -P dir=/some/path
                P: 'get',  // -P dir
                l: 'list'
            }
        };
    }
    async run(argv) {
        const {message} = argv;
        if(message) {
            return this.doMessage(argv);
        } else if(argv.set) {
            const [k,v] = argv.set.split('=');
            console.log(k, '=', v);
            config.set(k, v);
        } else if(argv.get) {
            console.log(config.get(argv.get));
        } else if(argv.list) {
            return this.doList(argv);
        } else if(argv._.length != 0) {
            throw Error('wrong usage');
        }
    }


    /**
     * @param {*} argv 
     * @param {String} argv.message the message
     */
    async doMessage(argv) {
        const {message} = argv;
        // TODO: override
        const date = new Date();
        const dir = await this.getDir(date);
        const fn = date.toISOString() + '.json';
        const filep = path.join(dir, fn);
        const taskwarrior = await fetchTask();
        const o = { 
            date,
            localDate: date.toString(),
            taskwarrior,
            message
        };
        // if no active tasks, delete
        if(o.taskwarrior && o.taskwarrior.length === 0) {
            delete o.taskwarrior;
        }
        console.dir(o, {color: true, depth: Infinity});
        console.log('Writing', filep);
        await fs.writeFile(filep, JSON.stringify(o, null, ' '), 'utf-8');
    }

    async doList(argv) {

    }

    async getDir(date) {
        const baseDir = config.get('dir');
        const datePath = Cli.dateToDir(date);
        const p = path.join(baseDir, datePath);
        await fs.mkdir(p, {recursive: true});
        return p;
    }

    static dateToDir(date) {
        function pad(n) {
            return String(n).padStart(2, '0');
        }
        return [
                date.getFullYear(),
                pad((date.getMonth()+1)),
                pad((date.getDate()))
        ].join('/');
    }
};

module.exports = Cli;
