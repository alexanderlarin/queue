import _ from 'lodash';
import Promise from 'bluebird'
import Stream from 'stream';

import { scopeHandlers } from './scope';


export class Projection extends Stream.Writable {
    constructor(scope, handlers, queries, store, stamp = 0) {
        super({ objectMode: true });

        this._scope = scope;
        this._handlers = _.reduce(handlers, (handlers, events, scope) =>
            _.defaults(handlers, scopeHandlers(scope, events)), {});
        this._queries = scopeHandlers(scope, queries);

        this._store = store;
        this._stamp = stamp;
    }

    get stamp() { return this._stamp; }
    get scope() { return this._scope; }
    get events() { return _.keys(this._handlers); }
    get queries() { return _.keys(this._queries); }

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

    handle(event) {
        if (event.stamp <= this._stamp)
            return Promise.resolve();
        const handler = this._handlers[event.name];
        if (!handler)
            return Promise.resolve();
        return handler(this._store.collection, event.aggregate, event.payload, event.date)
            .then(() => this._store.set('stamp', event.stamp))
            .then(() => this._stamp = event.stamp);
    }

    query(name, payload) {
        return new Promise((resolve, reject) => {
            const handler = this._queries[name];
            if  (!handler)
                return reject(new Error(`there is no handler with name [${name}] to process the query`));
            return resolve(handler(this._store.collection, payload));
        });
    }
}
