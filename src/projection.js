import Promise from 'bluebird'
import Stream from 'stream';

import { scopeHandlers } from './scope';


export class Projection {
    constructor(scope, handlers, queries, store) {
        this._scope = scope;
        this._handlers = !handlers ? {} : Object.keys(handlers).reduce((obj, value) => {
            if (typeof handlers[value] === 'function')
                obj[value] = handlers[value];
            if (typeof handlers[value] === 'object')
                obj = Object.assign(obj, scopeHandlers(value, handlers[value]));
            return obj;
        }, { });
        this._queries = scopeHandlers(scope, queries);
        this._store = store;
    }

    get stamp() { return (this._store && this._store.stamp) || 0; }
    get scope() { return this._scope; }
    get events() { return Object.keys(this._handlers); }
    get queries() { return Object.keys(this._queries); }

    project(stream) {
        return new Promise((resolve, reject) => {
            const projection = new Stream.Writable({
                objectMode: true,
                write: (event, encoding, done) =>
                    this.handle(event)
                        .then(() => done())
                        .catch((err) => done(err))
            });
            projection
                .once('error', reject)
                .once('finish', resolve);
            stream.pipe(projection);
        });
    }

    handle({ name, aggregate, stamp, date, payload }) {
        if (stamp <= this._store.stamp)
            return Promise.resolve();
        const handler = this._handlers[name];
        if (!handler)
            return Promise.resolve();
        return this._store.project((collection) =>
            handler(collection, aggregate, payload, date),
            stamp
        );
    }

    query(name, payload) {
        return new Promise((resolve, reject) => {
            const handler = this._queries[name];
            if  (!handler)
                return reject(new Error(`there is no handler with name [${name}] to process the query`));
            return resolve(this._store.query((collection) => handler(collection, payload)));
        });
    }
}
