import chai, { expect } from 'chai';
import chaiPromised from 'chai-as-promised';

chai.use(chaiPromised);

import Promise from 'bluebird';

import { EventStream } from '../src/eventstream';

describe('EventStream', () => {
    describe('constructor', () => {
        it('ok', () => {
            expect(new EventStream()).to.be.ok;
            expect(new EventStream(['event1', 'event2'])).to.be.ok;
        });
    });

    describe('read/write', () => {
        it('without filter', () => {
            const stream = new EventStream();

            const events = [];
            stream.on('data', (event) => {
                events.push(event);
            });

            const wait = new Promise((resolve) => {
                stream.once('end', resolve);
            });

            stream.write({ name: 'event1' });
            stream.write({ name: 'event2' });
            stream.end();

            return expect(wait).to.eventually.fulfilled
                .then(() => expect(events).to.be.deep.equals([{ name: 'event1' }, { name: 'event2' }]));
        });

        it('with filter', () => {
            const stream = new EventStream(['event1', 'event2']);

            const events = [];
            stream.on('data', (event) => {
                events.push(event);
            });

            const wait = new Promise((resolve) => {
                stream.once('end', resolve);
            });

            stream.write({ name: 'event1' });
            stream.write({ name: 'event2' });
            stream.write({ name: 'event3' });
            stream.end();

            return expect(wait).to.eventually.fulfilled
                .then(() => expect(events).to.be.deep.equals([{ name: 'event1' }, { name: 'event2' }]));
        });
    });

    describe('pipe', () => {
        it('single', () => {
            const readableStream = new EventStream();
            const writableStream = new EventStream();
            const events = [];

            writableStream.on('data', (event) => {
                events.push(event);
            });

            readableStream.pipe(writableStream);

            const wait = new Promise((resolve) => {
                readableStream.once('end', resolve);
            });

            readableStream.write({ name: 'event1' });
            readableStream.write({ name: 'event2' });
            readableStream.end();

            return expect(wait).to.eventually.fulfilled
                  .then(() => expect(events).to.be.deep.equals([{ name: 'event1' }, { name: 'event2' }]));
        });

        it('with two filters', () => {
            const stream1 = new EventStream();
            const stream2 = new EventStream(['event1', 'event2']);
            const stream3 = new EventStream(['event3', 'event4']);
            const events2 = [];
            const events3 = [];

            stream2.on('data', (event) => {
                events2.push(event);
            });

            stream3.on('data', (event) => {
                events3.push(event);
            });

            stream1.pipe(stream2);
            stream1.pipe(stream3);

            const wait2 = new Promise((resolve) => {
                stream2.once('end', resolve);
            });

            const wait3 = new Promise((resolve) => {
                stream3.once('end', resolve);
            });

            stream1.write({ name: 'event1' });
            stream1.write({ name: 'event2' });
            stream1.write({ name: 'event3' });
            stream1.write({ name: 'event4' });
            stream1.end();

            return Promise.all([
                expect(wait2).to.eventually.fulfilled
                      .then(() => expect(events2).to.be.deep.equals([{ name: 'event1' }, { name: 'event2' }])),
                expect(wait3).to.eventually.fulfilled
                      .then(() => expect(events3).to.be.deep.equals([{ name: 'event3' }, { name: 'event4' }]))
            ]);
        });

        it('multiple', () => {
            const stream1 = new EventStream();
            const stream2 = new EventStream();
            const stream3 = new EventStream();
            const events2 = [];
            const events3 = [];

            stream2.on('data', (event) => {
                events2.push(event);
            });

            stream3.on('data', (event) => {
                events3.push(event);
            });

            stream1.pipe(stream2);
            stream1.pipe(stream3);

            const wait2 = new Promise((resolve) => {
                stream2.once('end', resolve);
            });

            const wait3 = new Promise((resolve) => {
                stream3.once('end', resolve);
            });

            stream1.write({ name: 'event1' });
            stream1.write({ name: 'event2' });
            stream1.end();

            return Promise.all([
                expect(wait2).to.eventually.fulfilled
                    .then(() => expect(events2).to.be.deep.equals([{ name: 'event1' }, { name: 'event2' }])),
                expect(wait3).to.eventually.fulfilled
                    .then(() => expect(events3).to.be.deep.equals([{ name: 'event1' }, { name: 'event2' }]))
            ]);
        });
    });
});
