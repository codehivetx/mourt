/**
 * Copyright (c) 2022 Code Hive Tx, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// These files are CommonJS scripts with no import/export, so TypeScript
// treats them as sharing one global scope. Locals here are prefixed to avoid
// colliding with the same names in cli.ts.
const Configstore = require('configstore');
const nodefs = require('fs');
const nodepath = require('path');
// Compiled output lives in dist/lib/, so the package.json sits two levels up.
const { name } = require('../../package.json');

/**
 * Which config file to use, in precedence order:
 *   1. --config <path> / -c <path>
 *   2. $MOURT_CONFIG
 *   3. configstore's default (under the XDG config dir)
 *
 * Returns undefined for "use the default", which configstore treats as
 * "ignore configPath". This lets experiments and tests run against a
 * throwaway config file instead of the real one.
 */
function resolveConfigPath(argv: any = {}): string | undefined {
    const given = (argv && argv.config) || process.env.MOURT_CONFIG;
    if (!given) {
        return undefined;
    }
    const resolved = nodepath.resolve(given);
    // configstore empties any file it cannot JSON.parse, silently
    // (configstore/index.js:47-49). Validate first so a typo or a
    // wrong-path mistake cannot blank someone's config.
    if (nodefs.existsSync(resolved)) {
        let parsed;
        try {
            parsed = JSON.parse(nodefs.readFileSync(resolved, 'utf8'));
        } catch (e) {
            throw Error('config file is not valid JSON: ' + resolved +
                ' (' + (e as Error).message + ')');
        }
        if (parsed === null || typeof parsed !== 'object') {
            throw Error('config file must contain a JSON object: ' + resolved);
        }
    }
    return resolved;
}

/**
 * Open the config store.
 *
 * `defaults` is deliberately omitted: configstore's constructor writes the
 * file whenever it is given a truthy defaults argument, so passing one would
 * rewrite the config on every read (configstore/index.js:24-29).
 */
function openConfig(argv: any = {}): any {
    return new Configstore(name, undefined, { configPath: resolveConfigPath(argv) });
}

module.exports = { createConfig: openConfig, resolveConfigPath, name };