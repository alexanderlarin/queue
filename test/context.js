import chai, { expect } from 'chai';
import spies from 'chai-spies-next';
import promised from 'chai-as-promised';

chai.use(spies);
chai.use(promised);

import Promise from 'bluebird';

import { EventStream } from '../src/eventstream';
import { Context } from '../src/context';


describe('Context', () => {
    describe('constructor', () => {
        it('ok', () => {
            expect(() => new Context()).to.be.ok;
        });
    });

    describe('aggregate', () => {
        let context = null;

        beforeEach(() => {
            context = new Context();
        });

        it('without scope', () => {
            return Promise.all([
                expect(context.aggregate({ })).to.eventually.rejected.with.an('Error'),
                expect(context.aggregate({ scope: '' })).to.eventually.rejected.with.an('Error'),
            ]);
        });

        it('with scope only', () => {
            return expect(context.aggregate({ scope: 'test' })).to.eventually.fulfilled.with.an('Object')
                .that.deep.equals({ scope: 'test', events: [], commands: [] });
        });

        it('with the same scopes', () => {
            let promise = context.aggregate({ scope: 'test' })
                .then(() => context.aggregate({ scope: 'test' }));

            return expect(promise).to.eventually.rejected.with.an('Error')
        });

        it('with scope/handlers/commands', () => {
            return expect(context.aggregate({ scope: 'test',
                handlers: { created() {} }, commands: { create() {} } })).to.eventually.fulfilled.with.an('Object')
                .that.deep.equals({ scope: 'test', events: [ 'test.created' ], commands: [ 'test.create' ] });
        });
    });

    describe('command', () => {
        let context = null;
        let store = null;

        beforeEach(() => {
            store = {
                stream: new EventStream(),

                aggregate() { return this.stream; },
                push: chai.spy()
            };

            context = new Context(store);

            return context.aggregate({
                scope: 'domain',
                handlers: {
                    created(state) {
                        state.created = true;
                    }
                },
                commands: {
                    create(state, payload, emit) {
                        if (!state.created)
                            emit('created', payload);
                    }
                }
            });
        });

        it('ok', () => {
            const promise = context.command('domain.create', '1', { });
            store.stream.end();
            return expect(promise).to.eventually.fulfilled;
        });

        it('domain doesn\'t exist', () => {
            const promise = context.command('subdomain.create', '1', { });
            return expect(promise).to.eventually.rejected.with.an('Error');
        });

        it('name doesn\'t exist', () => {
            const promise = context.command('domain.destroy', '1', { });
            return expect(promise).to.eventually.rejected.with.an('Error');
        });

        it('id doesn\'t exist', () => {
            const promise = context.command('domain.create', '', { });
            return expect(promise).to.eventually.rejected.with.an('Error');
        });

        it('store push emitted', () => {
            const promise = context.command('domain.create', '1', {});
            store.stream.end();
            return expect(promise).to.eventually.fulfilled
                .then(() => expect(store.push).to.have.been.called.once.with('1', 0,
                    [ { name: 'domain.created', payload: {} } ]));
        });

        it('store push emitted with state', () => {
            const promise = context.command('domain.create', '1', {});
            store.stream.write({ name: 'domain.created', payload: {} });
            store.stream.end();
            return expect(promise).to.eventually.fulfilled
                .then(() => expect(store.push).to.not.have.been.called.once);
        });
    });

    describe('project', () => {
        let context = null;

        beforeEach(() => {
            context = new Context(null, {
                store() {
                    return new Promise.resolve({
                        store: null,
                        stamp: 5
                    })
                }
            });
        });

        it('without scope', () => {
            return Promise.all([
                expect(context.project({ })).to.eventually.rejected.with.an('Error'),
                expect(context.project({ scope: '' })).to.eventually.rejected.with.an('Error'),
            ]);
        });

        it('with scope only', () => {
            return expect(context.project({ scope: 'test' })).to.eventually.fulfilled.with.an('Object')
                .that.deep.equals({ scope: 'test', stamp: 5, events: [], queries: [] });
        });

        it('with the same scopes', () => {
            let promise = context.project({ scope: 'test' })
                .then(() => context.project({ scope: 'test' }));

            return expect(promise).to.eventually.rejected.with.an('Error')
        });

        it('with scope/handlers/queries', () => {
            return expect(context.project({
                    scope: 'test',
                    handlers: {
                        test1: { created() {} },
                        test2: { created() {} }
                    },
                    queries: {
                        create() {}
                    }
                })).to.eventually.fulfilled.with.an('Object')
                .that.deep.equals({ scope: 'test', stamp: 5, events: ['test1.created', 'test2.created'], queries: ['test.create'] });
        });
    });

    describe('query', () => {
        let context;
        let spy;

        beforeEach(() => {
            spy = chai.spy();
            context = new Context(null, {
                store() {
                    return new Promise.resolve({
                        store: {
                            collection: { get: spy }
                        },
                        stamp: 0
                    })
                }
            });
            return context.project({
                scope: 'domain',
                handlers: { },
                queries: {
                    get(store, { id }) {
                        return new Promise((resolve, reject) => {
                            setTimeout(() => {
                                store.get(id);
                                return id < 0 ? reject(id) : resolve(id);
                            }, 0);
                        });
                    }
                }
            });
        });

        it('ok', () => {
            const promise = context.query('domain.get', { });
            return expect(promise).to.eventually.fulfilled;
        });

        it('domain doesn\'t exist', () => {
            const promise = context.query('subdomain.create', { });
            return expect(promise).to.eventually.rejected.with.an('Error');
        });

        it('name doesn\'t exist', () => {
            const promise = context.query('domain.getById', { });
            return expect(promise).to.eventually.rejected.with.an('Error');
        });

        it('store called', () => {
            const promise = context.query('domain.get', { id: 1 });
            return expect(promise).to.eventually.fulfilled.with.an('Number').that.equals(1)
                .then(() => expect(spy).to.have.been.called.once.with(1));
        });

        it('store called with error', () => {
            const promise = context.query('domain.get', { id: -1});
            return expect(promise).to.eventually.rejected.with.an('Number').that.equals(-1)
                .then(() => expect(spy).to.have.been.called.once.with(-1));
        });
    });

    describe('awake', () => {
        let context;
        let stream;
        let projectSpy;
        let collection1;
        let collection2;

        beforeEach(() => {
            stream = new EventStream();
            projectSpy = chai.spy();
            collection1 = [];
            collection2 = [];
            const eventStore = {
                project(events, stamp) {
                    projectSpy(events, stamp);
                    return stream;
                }
            };
            const stateStore = {
                store(scope) {
                    if (scope == 'scope1')
                        return Promise.resolve({
                            store: {
                                collection: collection1,
                                set() { return Promise.resolve(); }
                            },
                            stamp: 1
                        });
                    if (scope == 'scope2')
                        return Promise.resolve({
                            store: {
                                collection: collection2,
                                set() { return Promise.resolve(); }
                            },
                            stamp: 2
                        });
                    return Promise.reject();
                }
            };
            context = new Context(eventStore, stateStore);
        });

        it('empty projections', () => {
            return expect(context.awake()).to.eventually.fulfilled
                .then(() => expect(projectSpy).to.not.have.been.called.once);
        });

        it('not empty projections', () => {
            const promise = Promise.all([
                    context.project({
                        scope: 'scope1',
                        handlers: {
                            scope3: {
                                created(store, aggregate, { id }) {
                                    store.push(id);
                                    return Promise.resolve();
                                }
                            }
                        }
                    }),
                    context.project({
                        scope: 'scope2',
                        handlers: {
                            scope4: {
                                created(store, aggregate, { id }) {
                                    store.push(id);
                                    return Promise.resolve();
                                }
                            }
                        }
                    })
                ])
                .then(() => context.awake());
            stream.write({ name: 'scope3.created', stamp: 1, payload: { id: 1 } });
            stream.write({ name: 'scope3.created', stamp: 2, payload: { id: 2 } });
            stream.write({ name: 'scope4.created', stamp: 3, payload: { id: 3 } });
            stream.end();
            return expect(promise).to.eventually.fulfilled
                .then(() => {
                    expect(projectSpy).to.have.been.called.twice.with(['scope3.created'], 1).and.with(['scope4.created'], 2);
                    expect(collection1).to.be.deep.equals([2]);
                    expect(collection2).to.be.deep.equals([3]);
                });
        });
    });

    describe('live', () => {
        let context;
        let awakeStream;
        let liveStream;
        let streamSpy;
        let collection1;
        let collection2;

        beforeEach(() => {
            awakeStream = new EventStream();
            liveStream = new EventStream();
            streamSpy = chai.spy();
            collection1 = [];
            collection2 = [];
            const eventStore = {
                project() {
                    return awakeStream;
                },
                stream(events) {
                    streamSpy(events);
                    return liveStream;
                }
            };
            const stateStore = {
                store(scope) {
                    if (scope == 'scope1')
                        return Promise.resolve({
                            store: {
                                collection: collection1,
                                set() { return Promise.resolve(); }
                            },
                            stamp: 1
                        });
                    if (scope == 'scope2')
                        return Promise.resolve({
                            store: {
                                collection: collection2,
                                set() { return Promise.resolve(); }
                            },
                            stamp: 2
                        });
                    return Promise.reject();
                }
            };
            context = new Context(eventStore, stateStore);
        });

        it('empty projections', () => {
            const promise = context.awake()
                .then(() => context.live());
            return expect(promise).to.eventually.fulfilled;
        });

        it('not empty projections', () => {
            const promise = Promise.all([
                    context.project({
                        scope: 'scope1',
                        handlers: {
                            scope3: {
                                created(store, aggregate, { id }) {
                                    store.push(id);
                                    return Promise.resolve();
                                }
                            }
                        }
                    }),
                    context.project({
                        scope: 'scope2',
                        handlers: {
                            scope4: {
                                created(store, aggregate, { id }) {
                                    store.push(id);
                                    return Promise.resolve();
                                }
                            }
                        }
                    })
                ])
                .then(() => {
                    const awake = context.awake();
                    awakeStream.end();
                    return awake;
                })
                .then(() => context.live());
            liveStream.write({ name: 'scope3.created', stamp: 1, payload: { id: 1 } });
            liveStream.write({ name: 'scope3.created', stamp: 2, payload: { id: 2 } });
            liveStream.write({ name: 'scope4.created', stamp: 3, payload: { id: 3 } });
            liveStream.end();
            return expect(promise).to.eventually.fulfilled
                .then(() => {
                    expect(streamSpy).to.have.been.called.twice.with(['scope3.created']).and.with(['scope4.created']);
                    expect(collection1).to.be.deep.equals([2]);
                    expect(collection2).to.be.deep.equals([3]);
                });
        });
    });
});