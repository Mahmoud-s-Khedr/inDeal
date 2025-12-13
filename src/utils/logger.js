const util = require('util');
const { log: logConfig } = require('../config/env');

const levelPriority = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const currentLevel = levelPriority[logConfig.level] ?? levelPriority.info;

const formatMeta = (meta) => {
    if (!meta) return '';
    if (meta instanceof Error) {
        return meta.stack || meta.message;
    }
    return util.inspect(meta, { depth: null, colors: false });
};

const write = (level, message, meta) => {
    const priority = levelPriority[level];
    if (priority === undefined) {
        throw new Error(`Unknown log level: ${level}`);
    }
    if (priority > currentLevel) return;

    const timestamp = new Date().toISOString();
    const formattedMeta = meta ? ` | ${formatMeta(meta)}` : '';
    const output = `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedMeta}`;

    if (level === 'error') {
        console.error(output);
    } else if (level === 'warn') {
        console.warn(output);
    } else {
        console.log(output);
    }
};

module.exports = {
    log: write,
    error: (message, meta) => write('error', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    info: (message, meta) => write('info', message, meta),
    debug: (message, meta) => write('debug', message, meta),
};
