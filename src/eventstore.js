import { Queue } from './queue';
import { EventStream } from './eventstream';

export class EventStore {
    static connect(db) {
        const events = db.collection('events');
        return events.find({}, { _id: 0, stamp: 1 }).sort({ stamp: -1 }).limit(1).next()
            .then((event) => {
                const stamp = event.stamp || 0;
                return new EventStore(events, stamp);
            });
    }


    constructor(store, stamp) {
        this._store = store;
        this._stamp = stamp;

        this._queue = new Queue({ persist: true });
        this._stream = new EventStream();
    }

    get stamp() { return this._stamp; }

    aggregate(id) {
        return this._store.find({ aggregate: id }, { _id: 0 }).sort({ version: 1 }).stream();
    }

    project(events, stamp) {
        return this._store.find({ name: { $in: events }, stamp: { $gt: stamp } }, { _id: 0 }).sort({ stamp: 1 }).stream();
    }

    push(aggregate, version, events) {
        const stamp = this._stamp;
        const batch = events.map((event, index) => {
            return {
                name: event.name,
                aggregate: aggregate,
                payload: event.payload,
                version: version + index + 1,
                stamp: stamp + index + 1,
                date: new Date()
            }
        });
        this._stamp = stamp + events.length;

        return this._queue.push(() => {
                return this._store.find({ aggregate: aggregate }, { _id: 0, version: 1 }).sort({ version: -1 }).next()
                    .then((event) => {
                        if ((event.version || 0) > version)
                            return Promise.reject(new Error(`Conflict events for aggregate [${aggregate}] with version [${version}]`));
                        return this._store.insertMany(batch);
                    });
            })
            .then(() => batch.forEach((event) => this._stream.write(event)));
    }

    stream(events) {
        const stream = new EventStream(events);
        this._stream.pipe(stream);
        return stream;
    }
}
