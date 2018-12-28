// var consulKVitem = { Value: { __LSID: 'fake-lcid' } };

function Consul(opts = undefined) {
    this.kv.separator = (opts !== undefined && !!opts.separator) ? opts.separator : '/';    
    console.info(`Mock consul instance created. (opts, separator: '${this.kv.separator}')`);
}

const keyPrefix = 'sessions/connect.sid/';

// '{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"counter":0}'

Consul.LockSessionKeyByDefault = 'lock-session-default-key';
Consul.SessAsDefault = {
    cookie: {
        originalMaxAge: null,
        expires: null,
        httpOnly: true,
        path: "/",
    }
}

Consul.KeyNotExists = 'not-exists';
Consul.KeyExists = 'exists';
Consul.KeyError = 'error';
Consul.KeyCritical = 'critical-error';
Consul.TestErrorMessage = 'error for tests';

var getPrefix = function(separator) {
    if (separator === null || separator === undefined) {
        return keyPrefix;
    } else if (separator !== '/') {
        var res = keyPrefix.replace(/\//g, separator);
        return res;
    } else {
        return keyPrefix;
    }
}

var getKvItem = function(lockSessionKey, sess) {
    return {
        // TODO: другие поля ??
        Session: !!sess ? lockSessionKey : null,
        Value: JSON.stringify(sess),
    }
}

// INFO: C:\dev\github\wad-jet\connect-consul\node_modules\consul\lib\kv.js
Consul.prototype.kv = {
    res: { },
    separator: '/',
    get: function(opts, callback) {
        //console.log(`MOCK GET> ${JSON.stringify(opts)}, separator: ${this.separator}`);
        var err = null;  
        var key = ((opts instanceof Object) ? opts.key : opts);
        var result = null;

        var keyPrefixVal = getPrefix(this.separator);

        switch(key){
            case (keyPrefixVal + Consul.KeyNotExists):
                {
                    result = null; //getKvItem(Consul.LockSessionKeyByDefault, null);
                    break;
                }
            case (keyPrefixVal + Consul.KeyExists):
                {
                    result = getKvItem(Consul.LockSessionKeyByDefault, Consul.SessAsDefault);
                    break;
                }
            case (keyPrefixVal + Consul.KeyError):
                {
                    err = Consul.TestErrorMessage;
                    break;
                }
            case (keyPrefixVal + Consul.KeyCritical):
                {
                    throw new Error(Consul.TestErrorMessage);
                }
            default:
                throw new Error('Unknown test key: ' + key + ', keyPrefixVal: ' + keyPrefixVal)
        }              
        callback(err, result);
    },
    set: function(key, value, opts, callback) {
       
        var err = null;  
        var success = true;

        var keyPrefixVal = getPrefix(this.separator);

        //console.log(`MOCK SET> ${key} ${value} ${JSON.stringify(opts)} keyPrefixVal ${keyPrefixVal}`);
        switch(key){
            case (keyPrefixVal + Consul.KeyNotExists):
                {                    
                    success = true;
                    this.res[Consul.KeyNotExists] = value;
                    break;
                }
            case (keyPrefixVal + Consul.KeyExists):
                {                    
                    success = true;
                    this.res[Consul.KeyExists] = value;
                    break;
                }            
            default:
                throw new Error('Unknown test key: ' + key)
        }        
        callback(err, success);
    },
}

Consul.prototype.session = {
    res: { },
    create: function (opts, callback) {
        var err = null;
        //console.log(`CREATE SESS> ${JSON.stringify(opts)}`);
        this.res[opts.name] = opts;
        callback(err, { ID: Consul.LockSessionKeyByDefault })
    },
    destroy: function (ID, callback) {
        var err = null;
        callback(err);
    },
    renew: function (ID, callback) {
        var err = null;        
        callback(err, [
            { ID: Consul.LockSessionKeyByDefault }
        ]);
    }
}

module.exports = Consul;
