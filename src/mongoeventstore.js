import { EventStream } from './eventstream';
import { Queue } from './queue';


export class MongoEventStore {
    constructor(db) {
        this._db = db;

        this._queue = new Queue({ persist: true });
        this._stream = new EventStream();
    }

    get collection() {
        return this._db.collection('events');
    }

    aggregate(aggregate) {
        return this.collection.find({ aggregate }, { _id: 0 }).sort({ version: 1 }).stream();
    }

    project(events, stamp) {
        return this.collection.find({ name: { $in: events }, stamp: { $gt: stamp } }, { _id: 0 }).sort({ stamp: 1 }).stream();
    }

    version(aggregate) {
        return this.collection.find({ aggregate }, { _id: 0, version: 1 }).sort({ version: -1 }).next()
            .then((event) => (event && event.version) || 0);
    }

    stamp() {
        return this.collection.find({}, { _id: 0, stamp: 1 }).sort({ stamp: -1 }).limit(1).next()
            .then((event) => (event && event.stamp) || 0);
    }

    store(batch) {
        return this.collection.insertMany(batch);
    }

    push(aggregate, version, events) {
        return this.stamp()
            .then((stamp) => events.map(({ name, payload }, index) => ({
                name,
                aggregate,
                payload,
                version: version + index + 1,
                stamp: stamp + index + 1,
                date: new Date()
            })))
            .then((batch) => this._queue.push(() =>
                this.version(aggregate)
                    .then((version) => {
                        if ((version || 0) > version)
                            return Promise.reject(new Error(`Conflict events for aggregate [${aggregate}] with version [${version}]`));
                        return this.store(batch);
                    })
                    .then(() => this.stream(batch))
            ));
    }

    stream(batch) {
        batch.forEach((event) => this._stream.write(event));
        return Promise.resolve(batch);
    }

    pipe(events) {
        const stream = new EventStream(events);
        this._stream.pipe(stream);
        return stream;
    }
}
