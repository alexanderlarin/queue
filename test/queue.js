import chai, { expect } from 'chai';
import chaiPromised from 'chai-as-promised';

chai.use(chaiPromised);

import Promise from 'bluebird';

import { Queue } from '../src/queue';

describe('Queue', () => {
    describe('constructor', () => {
        it('ok', () => {
            expect(new Queue()).to.be.ok;
        });
    });

    describe('push', () => {
        it('resolve', () => {
            let queue = new Queue();
            return expect(queue.push(() => Promise.resolve('value')))
                .to.eventually.fulfilled.with.an('string').that.equals('value');
        });

        it('reject', () => {
            let queue = new Queue();
            return expect(queue.push(() => { throw new Error('test'); }))
                .to.eventually.rejected.with.an('error').that.have.property('message').that.equals('test');
        });

        it('two ordered', () => {
            let queue = new Queue();
            let order = [];
            return Promise.all([
                    queue.push(() => order.push(1)),
                    queue.push(() => order.push(2))
                ])
                .then(() =>
                    expect(order).to.be.deep.equals([1, 2])
                );
        });

        it('two back ordered', () => {
            let queue = new Queue();
            let order = [];
            return Promise.all([
                    queue.push(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                order.push(1);
                                return resolve();
                            }, 10);
                        });
                    }),
                    queue.push(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                order.push(2);
                                return resolve();
                            }, 0);
                        });
                    })
                ])
                .then(() =>
                    expect(order).to.be.deep.equals([1, 2])
                );
        });

        it('after then', () => {
            let queue = new Queue();
            let order = [];
            return queue.push(() => order.push(1))
                .then(() => {
                    return queue.push(() => order.push(2));
                })
                .then(() =>
                    expect(order).to.be.deep.equals([1, 2])
                );
        });

        it('after catch persist', () => {
            let queue = new Queue({ persist: true });
            let order = [];
            return queue.push(() => { throw new Error('test'); })
                .catch(() => {
                    return queue.push(() => order.push(2));
                })
                .catch(() => expect(order).to.be.deep.equals([2]));
        });

        it('catch in middle persist', () => {
            let queue = new Queue({ persist: true });
            let order = [];

            return Promise.all([
                    expect(queue.push(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                order.push(1);
                                return resolve();
                            }, 0);
                        });
                    })).to.eventually.fulfilled,
                    expect(queue.push(() => {
                        return new Promise((resolve, reject) => {
                            return reject(new Error());
                        });
                    })).to.eventually.rejected.with.an('Error'),
                    expect(queue.push(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                order.push(2);
                                return resolve();
                            }, 0);
                        });
                    })).to.eventually.fulfilled
                ])
                .then(() => expect(order).to.be.deep.equals([1, 2]));
        });

        it('catch in middle', () => {
            let queue = new Queue();
            let order = [];

            return Promise.all([
                    expect(queue.push(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                order.push(1);
                                return resolve();
                            }, 0);
                        });
                    })).to.eventually.fulfilled,
                    expect(queue.push(() => {
                        return new Promise((resolve, reject) => {
                            return reject(new Error());
                        });
                    })).to.eventually.rejected.with.an('Error'),
                    expect(queue.push(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                order.push(2);
                                return resolve();
                            }, 0);
                        });
                    })).to.eventually.rejected.with.an('Error')
                ])
                .then(() => expect(order).to.be.deep.equals([1]));
        });

        it('after catch', () => {
            let queue = new Queue();
            let order = [];
            const promise = queue.push(() => { throw new Error('test'); })
                .catch(() => queue.push(() => order.push(2)));
            return expect(promise).to.eventually.rejected.with.an('Error')
                .then(() => expect(order).to.be.deep.equals([]));
        });
    });
});