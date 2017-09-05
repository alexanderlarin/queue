import _ from 'lodash';
import Promise from 'bluebird';

import { nameScope } from './scope';
import { Aggregation } from './aggregation';
import { Projection } from './projection';


export class Context {
    constructor(eventStore, stateStore) {
        this._eventStore = eventStore;
        this._stateStore = stateStore;

        this._aggregations = { };
        this._projections = { };
    }

    aggregate({ scope, handlers, commands }) {
        if (!scope)
            return Promise.reject(new Error(`Aggregate should have valid non-empty [scope] property`));
        if (scope in this._aggregations)
            return Promise.reject(new Error(`Context already has aggregate with scope [${scope}]`));
        return new Promise((resolve) => {
            const aggregation = new Aggregation(scope, handlers, commands);
            this._aggregations[scope] = aggregation;
            return resolve({
                scope: aggregation.scope,
                events: aggregation.events,
                commands: aggregation.commands
            });
        });
    }

    command(name, aggregate, payload) {
        if (!aggregate)
            return Promise.reject(new Error(`Aggregate should have valid unique ID`));

        const scope = nameScope(name);
        const aggregation = this._aggregations[scope];
        if (!aggregation)
            return Promise.reject(new Error(`Scope [${scope}] is not supported by context`));
        if (!_.includes(aggregation.commands, name))
            return Promise.reject(new Error(`Command [${name}] is not supported by context scope [${scope}]`));
        const stream = this._eventStore.aggregate(aggregate);

        return aggregation.aggregate(stream)
            .then(({ state, version }) => {
                const events = aggregation.command(name, payload, state);
                return { events, version };
            })
            .then(({ events, version }) => {
                if (_.isEmpty(events))
                    return [];
                return this._eventStore.push(aggregate, version, events);
            });
    }

    project({ scope, handlers, queries }) {
        if (!scope)
            return Promise.reject(new Error(`Projection should have valid non-empty [scope] property`));
        if (scope in this._projections)
            return Promise.reject(new Error(`Context already has projection with scope [${scope}]`));
        return this._stateStore.store(scope)
            .then(({ store, stamp }) => {
                const projection = new Projection(scope, handlers, queries, store, stamp);
                this._projections[scope] = projection;
                return {
                    scope: projection.scope,
                    stamp: projection.stamp,
                    events: projection.events,
                    queries: projection.queries
                };
            });
    }

    query(name, payload) {
        const scope = nameScope(name);
        const projection = this._projections[scope];
        if (!projection)
            return Promise.reject(new Error(`Scope [${scope}] is not supported by context`));
        if (!_.includes(projection.queries, name))
            return Promise.reject(new Error(`Query [${name}] is not supported by context scope [${scope}]`));
        return projection.query(name, payload);
    }

    awake() {
        return Promise.all(_.map(this._projections, (projection) => {
                const stream = this._eventStore.project(projection.events, projection.stamp);
                return projection.project(stream)
                    .then(({ wait }) => wait());
            }));
    }

    live() {
        const waits = Promise.all(_.map(this._projections, (projection) => {
            const stream = this._eventStore.stream(projection.events);
            return projection.project(stream)
                .then(({ wait }) => wait());
        }));
        return Promise.resolve({ wait: () => waits });
    }
}
