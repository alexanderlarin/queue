import _ from 'lodash';


export function scopeName(scope, name) {
    return scope ? `${scope}.${name}` : name;
}

export function nameScope(name) {
    const tokens = name.split('.');
    return _.size(tokens) > 1 ? tokens[0] : '';
}

export function scopeHandlers(scope, handlers) {
    return _.mapKeys(handlers, (handler, name) => scopeName(scope, name));
}
