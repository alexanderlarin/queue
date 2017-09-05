import chai, { expect } from 'chai';

import { scopeName, nameScope, scopeHandlers } from '../src/scope';


describe('Scope', () => {
    describe('scopeName', () => {
        it('with two strings', () => {
            expect(scopeName('scope', 'name')).to.be.equals('scope.name');
        });

        it('with empty scope', () => {
            expect(scopeName('', 'name')).to.be.equals('name');
        });

        it('with empty name', () => {
            expect(scopeName('scope', '')).to.be.equals('scope.');
        });

        it('with empty scope and name', () => {
            expect(scopeName('', '')).to.be.equals('');
        });
    });

    describe('nameScope', () => {
        it('with correct name', () => {
            expect(nameScope('scope.name')).to.be.equals('scope');
        });

        it('with empty scope', () => {
            expect(nameScope('name')).to.be.equals('');
        });

        it('with empty name', () => {
            expect(nameScope('scope.')).to.be.equals('scope');
        });

        it('with empty', () => {
            expect(nameScope('')).to.be.equals('');
        })
    });

    describe('scopeHandlers', () => {
        it('with empty handlers', () => {
            expect(scopeHandlers('scope')).to.deep.equals({ });
        });

        it('with strings as handlers', () => {
            expect(scopeHandlers('scope', { a: '1', b: '2', c: '3' }))
                .to.deep.equals({ 'scope.a': '1', 'scope.b': '2', 'scope.c': '3' });
        });

        it('with functions as handlers', () => {
            const handler1 = () => { };
            const handler2 = () => { };
            const handler3 = () => { };
            expect(scopeHandlers('scope', { handler1, handler2, handler3 }))
                .to.deep.equals({ 'scope.handler1': handler1, 'scope.handler2': handler2, 'scope.handler3': handler3 });
        });
    });
});