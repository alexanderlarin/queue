import Promise from 'bluebird';


export class Queue {
    constructor(options) {
        this._persist = options && options.persist;

        this._jobs = [];
        this._busy = false;
        this._cancel = false;
    }

    get empty() { return !this._jobs.length && (!this._busy || this._cancel); }

    push(callback) {
        if (this._cancel)
            return Promise.reject(new Error());
        return new Promise((resolve, reject) => {
            this._jobs.push(this.job(callback, resolve, reject));
            this.consume();
        });
    }

    job(callback, resolve, reject) {
        return () => new Promise((resolve, reject) => {
                if (this._cancel)
                    return reject(new Error());
                this._busy = true;
                return resolve(callback());
            })
            .then(resolve)
            .catch((err) => {
                if (!this._persist)
                    this._cancel = true;
                return reject(err);
            })
            .finally(() => {
                this._busy = false;
                this.consume();
            });
    }

    consume() {
        if (this._busy)
            return false;
        const job = this._jobs.shift();
        if (job) {
            job();
            return true;
        }
        return false;
    }
}
