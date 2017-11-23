import chai, { expect } from 'chai';
import chaiPromised from 'chai-as-promised';
import spies from 'chai-spies-next';

chai.use(chaiPromised);
chai.use(spies);

import Promise from 'bluebird';
import { EventStream } from '../src/eventstream';
import { Projection } from '../src/projection';


describe('Projection', () => {
    describe('constructor', () => {
        it('empty', () => {
            const pr = new Projection();
            expect(pr.scope).to.be.undefined;
            expect(pr.events).to.be.empty;
            expect(pr.queries).to.be.empty;
            expect(pr.stamp).to.be.equals(0);
        });

        it('scope', () => {
            const pr = new Projection('pr');
            expect(pr.scope).to.be.equals('pr');
            expect(pr.events).to.be.empty;
            expect(pr.queries).to.be.empty;
            expect(pr.stamp).to.be.equals(0);
        });

        it('events', () => {
            const pr = new Projection('pr', {
                'domain1.handler1'() { },
                domain2: {
                    handler1() { },
                    handler2() { }
                },
                domain3: {
                    handler1() { }
                }
            });
            expect(pr.scope).to.be.equals('pr');
            expect(pr.events).to.be.deep.equals(['domain1.handler1', 'domain2.handler1', 'domain2.handler2', 'domain3.handler1']);
            expect(pr.queries).to.be.empty;
            expect(pr.stamp).to.be.equals(0);
        });

        it('events with duplicates', () => {
            const pr = new Projection('pr', {
                domain1: {
                    handler1() { },
                    handler1() { }
                }
            });
            expect(pr.scope).to.be.equals('pr');
            expect(pr.events).to.be.deep.equals(['domain1.handler1']);
            expect(pr.queries).to.be.empty;
            expect(pr.stamp).to.be.equals(0);
        });

        it('queries', () => {
            const pr = new Projection('pr', { }, {
                query1() { },
                query2() { }
            });
            expect(pr.scope).to.be.equals('pr');
            expect(pr.events).to.be.empty;
            expect(pr.queries).to.be.deep.equals(['pr.query1', 'pr.query2']);
            expect(pr.stamp).to.be.equals(0);
        });

        it('queries with duplicates', () => {
            const pr = new Projection('pr', { }, {
                query1() { },
                query1() { }
            });
            expect(pr.scope).to.be.equals('pr');
            expect(pr.events).to.be.empty;
            expect(pr.queries).to.be.deep.equals(['pr.query1']);
            expect(pr.stamp).to.be.equals(0);
        });

        it('initial stamp', () => {
            const pr1 = new Projection('pr', {}, {}, { get stamp() { return 0; } });
            expect(pr1.stamp).to.be.equals(0);
            const pr2 = new Projection('pr', { }, { }, { get stamp() { return 10; } });
            expect(pr2.stamp).to.be.equals(10);
        })
    });

    describe('project', () => {
        let projection;
        let store;

        const handle = (store, id) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (id < 0)
                        return reject(new Error());
                    else {
                        store.push(id);
                        return resolve();
                    }
                }, 0);
            });
        };

        beforeEach(() => {
            store = {
                stamp: 0,
                collection: {
                    data: [],
                    push(id) {
                        this.data.push(id);
                    }
                },

                project(handler, stamp) {
                    return handler(this.collection)
                        .then(() => this.stamp = stamp);
                }
            };

            projection = new Projection('pr', {
                domain1: {
                    handler1: (store, aggregate, { id }) => handle(store, id),
                    handler2: (store, aggregate, { id }) => handle(store, id),
                },
                domain2: {
                    handler1: (store, aggregate, { id }) => handle(store, id),
                },
                domain3: {
                    handler1: (store, aggregate, { id }, date) => handle(store, { id, date})
                }
            }, { }, store);
        });

        it('single event', () => {
            const stream = new EventStream();
            const wait = projection.project(stream);
            stream.write({ name: 'domain1.handler1', payload: { id: 1 }, stamp: 1 });
            stream.end();
            return Promise.all([
                    expect(wait).to.eventually.fulfilled
                ])
                .then(() => {
                    expect(projection.stamp).to.be.equals(1);
                    expect(store.stamp).to.be.equals(1);
                    expect(store.collection.data).to.be.deep.equals([1])
                });
        });

        it('multiple events', () => {
            const stream = new EventStream();
            const wait = projection.project(stream);
            stream.write({ name: 'domain1.handler1', payload: { id: 1 }, stamp: 1 });
            stream.write({ name: 'domain1.handler2', payload: { id: 2 }, stamp: 2 });
            stream.write({ name: 'domain2.handler1', payload: { id: 3 }, stamp: 3 });
            stream.end();
            return Promise.all([
                    expect(wait).to.eventually.fulfilled
                ])
                .then(() => {
                    expect(projection.stamp).to.be.equals(3);
                    expect(store.stamp).to.be.equals(3);
                    expect(store.collection.data).to.be.deep.equals([1, 2, 3])
                });
        });


        it('date after payload field', () => {
            const stream = new EventStream();
            const wait = projection.project(stream);
            stream.write({ name: 'domain3.handler1', payload: { id: 1 }, stamp: 1, date: 11 });
            stream.write({ name: 'domain3.handler1', payload: { id: 2 }, stamp: 2, date: 12 });
            stream.end();
            return Promise.all([
                    expect(wait).to.eventually.fulfilled
                ])
                .then(() => {
                    expect(projection.stamp).to.be.equals(2);
                    expect(store.stamp).to.be.equals(2);
                    expect(store.collection.data).to.be.deep.equals([{ id: 1, date: 11 }, { id: 2, date: 12 }])
                });
        });

        it('skip events with less stamp', () => {
            const stream = new EventStream();
            const wait = projection.project(stream);
            stream.write({ name: 'domain1.handler1', payload: { id: 1 }, stamp: 1 });
            stream.write({ name: 'domain1.handler2', payload: { id: 2 }, stamp: 1 });
            stream.write({ name: 'domain2.handler1', payload: { id: 3 }, stamp: 2 });
            stream.end();
            return Promise.all([
                    expect(wait).to.eventually.fulfilled
                ])
                .then(() => {
                    expect(projection.stamp).to.be.equals(2);
                    expect(store.stamp).to.be.equals(2);
                    expect(store.collection.data).to.be.deep.equals([1, 3])
                });
        });

        it('stream write after handle fail', () => {
            const stream = new EventStream();
            const project = projection.project(stream)
                .then(({ wait }) => wait());
            stream.write({ name: 'domain1.handler1', payload: { id: 1 }, stamp: 1 });
            stream.write({ name: 'domain1.handler2', payload: { id: -1 }, stamp: 2 });
            return expect(project).to.eventually.rejected
                .then(() => {
                    stream.write({ name: 'domain2.handler1', payload: { id: 3 }, stamp: 3 });
                    stream.end();
                    return expect(project).to.eventually.rejected;
                })
                .then(() => {
                    expect(projection.stamp).to.be.equals(1);
                    expect(store.stamp).to.be.equals(1);
                    expect(store.collection.data).to.be.deep.equals([1])
                });
        });

        it('skip events after handle fail', () => {
            const stream = new EventStream();
            const project = projection.project(stream)
                .then(({ wait }) => wait());
            stream.write({ name: 'domain1.handler1', payload: { id: 1 }, stamp: 1 });
            stream.write({ name: 'domain1.handler2', payload: { id: -1 }, stamp: 2 });
            stream.write({ name: 'domain2.handler1', payload: { id: 3 }, stamp: 3 });
            stream.end();
            return Promise.all([
                    expect(project).to.eventually.rejected,
                    // expect(projection.wait()).to.eventually.rejected
                ])
                .then(() => {
                    expect(projection.stamp).to.be.equals(1);
                    expect(store.stamp).to.be.equals(1);
                    expect(store.collection.data).to.be.deep.equals([1])
                });
        });
    });

    describe('query', () => {
        let projection;
        let getSpy;
        let takeSpy;

        beforeEach(() => {
            getSpy = chai.spy();
            takeSpy = chai.spy();

            const store = {
                query(handler) {
                    return handler({ get: getSpy, take: takeSpy })
                }
            };

            projection = new Projection('pr', { }, {
                ok() {
                    return Promise.resolve('ok');
                },
                get(store, payload) {
                    return new Promise((resolve) => {
                        store.get(payload);
                        return resolve(payload);
                    });
                },
                take(store, payload) {
                    return new Promise((resolve) => {
                        store.take(payload);
                        return resolve(payload);
                    });
                },
                fail() {
                    return Promise.reject(new Error('fail'));
                }
            }, store);
        });

        it('single without store', () => {
            return expect(projection.query('pr.ok')).to.eventually.fulfilled.with.an('String').equals('ok');
        });

        it('spy to store', () => {
            const query = projection.query('pr.get', { id: 'id1' });
            expect(getSpy).to.have.been.called.once.with({ id: 'id1' });
            return expect(query).to.eventually.fulfilled.with.an('Object').that.deep.equals({ id: 'id1' });
        });

        it('spy to store multiple', () => {
            const queries = Promise.all([
                projection.query('pr.get', { id: 'id1' }),
                projection.query('pr.take', { ok: true }),
                projection.query('pr.get', { id: 'id3' })
            ]);
            expect(getSpy).to.have.been.called(2).with({ id: 'id1' }).with({ id: 'id3' });
            expect(takeSpy).to.have.been.called.once.with({ ok: true });
            return expect(queries).to.eventually.fulfilled.with.an('Array').that.deep.equals([
                { id: 'id1' },  { ok: true },  { id: 'id3' } ]);
        });

        it('name doesn\'t exist', () => {
            return expect(projection.query('pr.what', {})).to.eventually.rejected.with.an('Error');
        });

        it('handler throws error', () => {
            return expect(projection.query('pr.fail', {})).to.eventually.rejected.with.an('Error')
                .that.have.property('message').that.equals('fail');
        });
    });
});

