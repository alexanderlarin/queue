import stream from 'stream';


export class EventStream extends stream.Transform {
    constructor(filter) {
        super({ objectMode: true });

        this._filter = filter;
    }

    _transform(event, encoding, callback) {
        if (!this._filter || this._filter.find((name) => name === event.name))
            this.push(event);
        callback();
    }
}
