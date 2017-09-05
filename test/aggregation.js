import chai, { expect } from 'chai';
import chaiPromised from 'chai-as-promised';

chai.use(chaiPromised);

import { EventStream } from '../src/eventstream';
import { Aggregation } from '../src/aggregation';

describe('Aggregation', () => {
    describe('constructor', () => {
        it('empty', () => {
            const ag = new Aggregation();
            expect(ag.scope).to.be.undefined;
            expect(ag.events).to.be.empty;
            expect(ag.commands).to.be.empty;
        });

        it('scope', () => {
            const ag = new Aggregation('domain1');
            expect(ag.scope).to.be.equals('domain1');
            expect(ag.events).to.be.empty;
            expect(ag.commands).to.be.empty;
        });

        it('events', () => {
            const ag = new Aggregation('domain1', {
                    handler1() { },
                    handler2() { }
                });
            expect(ag.scope).to.be.equals('domain1');
            expect(ag.events).to.be.deep.equals(['domain1.handler1', 'domain1.handler2']);
            expect(ag.commands).to.be.empty;
        });

        it('events with duplicates', () => {
            const ag = new Aggregation('domain1', {
                handler1() { },
                handler1() { }
            });
            expect(ag.scope).to.be.equals('domain1');
            expect(ag.events).to.be.deep.equals(['domain1.handler1']);
            expect(ag.commands).to.be.empty;
        });

        it('commands', () => {
            const ag = new Aggregation('domain1', { }, {
                command1() { },
                command2() { }
            });
            expect(ag.scope).to.be.equals('domain1');
            expect(ag.events).to.be.empty;
            expect(ag.commands).to.be.deep.equals(['domain1.command1', 'domain1.command2']);
        });

        it('commands with duplicates', () => {
            const ag = new Aggregation('domain1', { }, {
                command1() { },
                command1() { }
            });
            expect(ag.scope).to.be.equals('domain1');
            expect(ag.events).to.be.empty;
            expect(ag.commands).to.be.deep.equals(['domain1.command1']);
        });
    });

    describe('aggregate', () => {
        const aggregation = new Aggregation('ag', {
            created(state, { id, title }) {
                state.id = id;
                state.title = title;
            },
            updated(state, { title }) {
                state.title = title;
            },
            failed() {
                throw new Error('failed');
            }
        });

        it('no events', () => {
            const stream = new EventStream();
            const promise = aggregation.aggregate(stream);
            stream.end();
            return expect(promise).to.eventually.deep.equals({ state: { }, version: 0});
        });

        it('single event', () => {
            const stream = new EventStream();
            const promise = aggregation.aggregate(stream);
            stream.write({ name: 'ag.created', payload: { id: 'id1', title: 'title1' } });
            stream.end();
            return expect(promise).to.eventually.deep.equals({ state: { id: 'id1', title: 'title1' }, version: 1 });
        });

        it('two order events', () => {
            const stream = new EventStream();
            const promise = aggregation.aggregate(stream);
            stream.write({ name: 'ag.created', payload: { id: 'id1', title: 'title1' } });
            stream.write({ name: 'ag.updated', payload: { id: 'id2', title: 'title2' } });
            stream.end();
            return expect(promise).to.eventually.deep.equals({ state: { id: 'id1', title: 'title2' }, version: 2 });
        });

        it('version with unhandled events', () => {
            const stream = new EventStream();
            const promise = aggregation.aggregate(stream);
            stream.write({ name: 'ag.created', payload: { id: 'id1', title: 'title1' } });
            stream.write({ name: 'ag.destroyed', payload: { } });
            stream.end();
            return expect(promise).to.eventually.deep.equals({ state: { id: 'id1', title: 'title1' }, version: 2 });
        });

        it('throw error event', () => {
            const stream = new EventStream();
            const promise = aggregation.aggregate(stream);
            stream.write({ name: 'ag.failed', payload: { } });
            stream.end();
            return expect(promise).to.eventually.rejected;
        })
    });

    describe('command', () => {
        const aggregation = new Aggregation('ag', { }, {
            create(state, { id }, emit) {
                if (!id)
                    return emit('created', { id: 'idi' });
                if (state.id == id)
                    emit('stated', { stateId: state.id });
                return emit('existed', { id });
            }
        });

        it('emit on payload and return first', () => {
            expect(aggregation.command('ag.create', {}, {})).to.deep.equals([{ name: 'ag.created', payload: { id: 'idi' } }]);
        });

        it('emit on payload and return last', () => {
            expect(aggregation.command('ag.create', { id: 'idi'}, {})).to.deep.equals([{ name: 'ag.existed', payload: { id: 'idi' } }]);
        });

        it('emit double on payload and state', () => {
            expect(aggregation.command('ag.create', { id: 'idi' }, { id: 'idi' })).to.deep.equals([
                { name: 'ag.stated', payload: { stateId: 'idi' } },
                { name: 'ag.existed', payload: { id: 'idi' } }
            ]);
        });
    });
});
