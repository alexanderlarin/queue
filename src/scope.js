export function scopeName(scope, name) {
    return scope ? `${scope}.${name}` : name;
}

export function nameScope(name) {
    const tokens = name.split('.');
    return tokens.length > 1 ? tokens[0] : '';
}

export function scopeHandlers(scope, handlers) {
    return !handlers ? { } : Object.keys(handlers).reduce((res, name) => {
        res[scopeName(scope, name)] = handlers[name];
        return res;
    }, { });
}
