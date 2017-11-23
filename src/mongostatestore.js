export class MongoStateStore {
    constructor(db) {
        this._db = db;
    }

    projection(name) {
        const stamps = this._db.collection('stamps');

        return stamps.findOne({ name }, { fields: { stamp: 1, _id: 0 } })
            .then((value) => {
                return {
                    stamp: (value && value.stamp) || 0,
                    project: (handler, stamp) => handler(this._db.collection(name))
                        .then(() => stamps.findOneAndUpdate({ name }, { $set: { stamp } }, { upsert: true }))
                        .then(() => this.stamp = stamp),
                    query: (handler) => handler(this._db.collection(name))
                };
            });
    }
}
