import _ from 'lodash';
import Promise from 'bluebird'

import { Queue } from './queue';
import { scopeHandlers } from './scope';


export class Projection {
    constructor(scope, handlers, queries, store, stamp = 0) {
        this._scope = scope;
        this._handlers = _.reduce(handlers, (handlers, events, scope) =>
            _.defaults(handlers, scopeHandlers(scope, events)), {});
        this._queries = scopeHandlers(scope, queries);

        this._queue = new Queue();

        this._store = store;
        this._stamp = stamp;
    }

    get stamp() { return this._stamp; }
    get scope() { return this._scope; }
    get events() { return _.keys(this._handlers); }
    get queries() { return _.keys(this._queries); }

    project(stream) {
        const wait = () => new Promise((resolve, reject) => {
            if (this._queue.empty)
                return resolve();
            this._queue.once('end', resolve);
            this._queue.once('error', reject);
        });

        return new Promise((resolve, reject) => {
            stream
                .on('data', (event) => {
                    this._queue.push(() => this.handle(event))
                        .catch((err) => reject(err));
                })
                .on('end', () => resolve({ wait }))
                .on('error', (err) => reject(err));
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
