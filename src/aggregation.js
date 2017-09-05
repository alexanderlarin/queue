import _ from 'lodash';

import { scopeName, scopeHandlers } from './scope';

export class Aggregation {
    constructor(scope, handlers, commands) {
        this._scope = scope;
        this._handlers = scopeHandlers(scope, handlers);
        this._commands = scopeHandlers(scope, commands);
    }

    get scope() { return this._scope; }
    get events() { return _.keys(this._handlers); }
    get commands() { return _.keys(this._commands); }

    aggregate(stream) {
        return new Promise((resolve, reject) => {
            let state = { };
            let version = 0;
            return stream
                .on('data', (event) => {
                    const handler = this._handlers[event.name];
                    if (handler) {
                        try {
                            handler(state, event.payload);
                        }
                        catch (err) {
                            return reject(err);
                        }
                    }
                    version++;
                })
                .on('end', () => resolve({ state, version }))
                .on('error', (err) => reject(err));
        });
    }

    command(name, payload, state) {
        let events = [];
        const handler = this._commands[name];
        if (handler) {
            const emit = (name, payload) => {
                events.push({ name: scopeName(this._scope, name), payload});
            };
            handler(state, payload, emit);
        }
        return events;
    }
}