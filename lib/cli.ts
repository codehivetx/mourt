const config : any = require('./config')();
const fs = require('fs').promises;
const { readFile } = require('fs');
const path = require('path');
const { fetchTask } = require('./plugin-taskw');
const chalk = require('chalk');

interface MourtBlob {
    /**
     * Full date
     */
    date: string,
    /**
     * Short date such as 2022-03-04
     */
    shortDate: string,
    /**
     * TW blob
     */
    taskwarrior: any,
    /**
     * String message
     */
    message: string,
};
class Cli {

    constructor() {
    }

    static get opts() {
        return {
            alias: {
                m: 'message', // -m 'what i did'
                D: 'set',  // -P dir=/some/path
                P: 'get',  // -P dir
                p: 'project', // -p project  ( filter on taskwarrior.project)
                l: 'list'
            }
        };
    }
    async run(argv: any) {
        const { message } = argv;
        if (message) {
            return this.doMessage(argv);
        } else if (argv.set) {
            const [k, v] = argv.set.split('=');
            console.log(k, '=', v);
            config.set(k, v);
        } else if (argv.get) {
            console.log(config.get(argv.get));
        } else if (argv.list) {
            return this.doList(argv);
        } else if (argv._.length != 0) {
            throw Error('wrong usage');
        }
    }

    /**
     * @param {*} argv
     * @param {String} argv.message the message
     */
    async doMessage(argv: any) {
        const { message } = argv;
        // TODO: override
        const date = new Date();
        const dir = await this.getDir(date);
        const fn = date.toISOString() + '.json';
        const filep = path.join(dir, fn);
        const taskwarrior = await fetchTask(config);
        const o = {
            date,
            localDate: date.toString(),
            taskwarrior,
            message
        };
        // if no active tasks, delete
        if (o.taskwarrior && o.taskwarrior.length === 0) {
            delete o.taskwarrior;
        }
        console.dir(o, { colors: true, depth: Infinity });
        console.log('Writing', filep);
        await fs.writeFile(filep, JSON.stringify(o, null, ' '), 'utf-8');
    }

    /**
     * Fetch list but don't display it
     * @param {Object} argv
     * @returns array of { date, taskwarrior, message}
     */
    async getList(argv: any): Promise<MourtBlob[]> {
        // TODO: filter by date for speed
        const proj = argv.project || null;
        const allFiles = (await Cli.getAllJsonFiles(this.baseDir))
            .sort(); // sorted will give us ascending time
        // .filter … 
        const out: MourtBlob[] = [];
        for (const f of allFiles) {
            const d: MourtBlob = await Cli.readMourtFile(f);
            const { taskwarrior } = d;
            if (proj && taskwarrior) {
                if (taskwarrior[0].project !== proj) {
                    // skip non matched
                    continue;
                }
            } else {
                if (proj) continue; // not shown.
            }
            out.push(d);
        }
        return out;
    }

    /**
     * Display list
     * @param {Object} argv
     */
    async doList(argv: any) {
        let lastDate = null;

        const df = new Intl.DateTimeFormat([], {
            weekday: 'short', month: 'short',
            day: 'numeric'
        });

        const list = await this.getList(argv);
        for (const d of list) {
            const { date, taskwarrior, message } = d;
            // console.dir(d);
            const { blue, red, yellow, underline, green } = chalk;
            const { log } = console;

            let dateStr = df.format(new Date(date));
            if (dateStr != lastDate) {
                log(underline.yellowBright(dateStr));
                lastDate = dateStr;
            }
            if (taskwarrior) {
                log('\t' + underline.yellow(new Date(date).toLocaleTimeString()) +
                    '\t' + red(taskwarrior[0].project) + '|' + blue(taskwarrior[0].jiraid || taskwarrior[0].description) +
                    '\t' + green(message)
                );
            } else {
                log('\t' + underline.yellow(new Date(date).toLocaleTimeString()) + '\t' + blue(message));
            }
        }
    }

    /**
     *
     * @param ddd
     * @returns string such as '2022-01-02'
     */
    static asShortDate(ddd: string | Date): string {
        if (typeof ddd === 'string') {
            ddd = new Date(ddd);
        }
        return ddd.toLocaleDateString(["en-US"]);
    }

    static async readMourtFile(f: string): Promise<MourtBlob> {
        let d;
        try {
            d = JSON.parse(await fs.readFile(f, 'utf8'));
        } catch (e) {
            console.error('Could not read ' + f);
            throw e;
        }
        // If the date is present, preparse it here.
        if (d.date) {
            d.shortDate = Cli.asShortDate(d.date);
        }
        return d; // TODO: preprocessing here?
    }

    /**
     * Recursively get all json files
     * @param {String} dir path to directory
     */
    static async getAllJsonFiles(dir: string): Promise<string[]> {
        let files: any[] = [];
        for await (const e of await fs.opendir(dir)) {
            const fullPath = path.join(dir, e.name);
            // console.log(fullPath);
            if (e.isDirectory()) {
                // recurse
                files = files.concat(await Cli.getAllJsonFiles(fullPath));
            } else if (e.isFile()) {
                if (e.name.endsWith('.json')) {
                    files.push(fullPath);
                }
            } // else ignored
        }
        return files;
    }

    async getDir(date: Date): Promise<string> {
        const datePath = Cli.dateToDir(date);
        const p = path.join(this.baseDir, datePath);
        await fs.mkdir(p, { recursive: true });
        return p;
    }

    get baseDir() {
        return config.get('dir');
    }

    static dateToDir(date: Date): string {
        function pad(n: number) {
            return String(n).padStart(2, '0');
        }
        return [
            date.getFullYear(),
            pad((date.getMonth() + 1)),
            pad((date.getDate()))
        ].join('/');
    }
};

module.exports = Cli;
