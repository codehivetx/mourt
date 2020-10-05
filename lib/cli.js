const config = require('./config')();

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
            return doMessage(message, argv);
        } else if(argv.set) {
            const [k,v] = argv.set.split('=');
            console.log(k, '=', v);
            config.set(k, v);
        } else if(argv.get) {
            console.log(config.get(argv.get));
        } else if(argv.list) {
            return DOMRectList(argv);
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
    }

    async doList(argv) {

    }
};

module.exports = Cli;
