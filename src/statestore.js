export class StateStore {
    static connect(db) {
        return new StateStore(db);
    }

    constructor(db) {
        this._db = db;
    }

    store(scope) {
        const stamps = this._db.collection('stamps');

        return stamps.findOne({ 'name': scope }, {
                fields: { stamp: 1, _id: 0 }
            })
            .then((data) => {
                const stamp = (data && data.stamp) || 0;

                const store = {
                    collection: this._db.collection(scope),
                    set: (field, value) => {
                        const set = {};
                        set[field] = value;
                        return stamps.findOneAndUpdate({ name: scope }, { $set: set }, { upsert: true })
                    }
                };

                return { store, stamp };
            });
    }
}
