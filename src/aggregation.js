import Stream from 'stream';

import { scopeName, scopeHandlers } from './scope';


export class Aggregation {
    constructor(scope, handlers, commands) {
        this._scope = scope;
        this._handlers = scopeHandlers(scope, handlers);
        this._commands = scopeHandlers(scope, commands);
    }

    get scope() { return this._scope; }
    get events() { return Object.keys(this._handlers); }
    get commands() { return Object.keys(this._commands); }

    aggregate(stream) {
        return new Promise((resolve, reject) => {
            const state = { };
            let version = 0;
            const aggregation = new Stream.Writable({
                objectMode: true,
                write: (event, encoding, done) => {
                    const handler = this._handlers[event.name];
                    if (handler) {
                        try {
                            handler(state, event.payload);
                        }
                        catch (err) {
                            return done(err);
                        }
                    }
                    version++;
                    return done();
                }
            });
            aggregation
                .once('error', reject)
                .once('finish', () => resolve({ state, version }));
            stream.pipe(aggregation);
        });
    }

    command(name, payload, state) {
        const events = [];
        const handler = this._commands[name];
        if (handler) {
            const emit = (name, payload) => {
                events.push({ name: scopeName(this._scope, name), payload });
            };
            handler(state, payload, emit);
        }
        return events;
    }
}