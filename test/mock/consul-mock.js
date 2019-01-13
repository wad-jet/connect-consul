// var consulKVitem = { Value: { __LSID: 'fake-lcid' } };

function Consul(opts = undefined) {
    this.kv.separator = (opts !== undefined && !!opts.separator) ? opts.separator : '/';    
    console.info(`Mock consul instance created. (opts, separator: '${this.kv.separator}')`);
}

const keyPrefix = 'sessions/connect.sid/';

// '{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"counter":0}'

Consul.LockSessionKeyByDefault = 'lock-session-default-key';
Consul.LockSessionKeyUnknown = 'lock-session-unknown-key';
Consul.LockSessionKeyOfTouchRenewFailed = 'lock-session-key-touch-renew-failed';

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
Consul.KeyLockSessionIsNull = 'lock-session-is-null';
Consul.KeyCritical = 'critical-error';
Consul.KeyTouchRenewFailed = 'touch-renew-failed';
Consul.KeyTouchRenewLockSessionIncorrect = 'touch-renew-lock-session-incorrect';

Consul.TestErrorMessage = 'error for tests';
Consul.TestErrorMessageOfTouchRenew = 'error touch renew for tests';

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
        Session: !!sess ? lockSessionKey : null,
        Value: JSON.stringify(sess),
    }
}

// INFO: C:\dev\github\wad-jet\connect-consul\node_modules\consul\lib\kv.js
Consul.prototype.kv = {
    res: { },
    separator: '/',
    get: function(opts, callback) {
        var err = null;  
        var key = ((opts instanceof Object) ? opts.key : opts);
        var result = null;

        var keyPrefixVal = getPrefix(this.separator);

        switch(key){
            case (keyPrefixVal + Consul.KeyNotExists): {
                result = null; //getKvItem(Consul.LockSessionKeyByDefault, null);
                break;
            }
            case (keyPrefixVal + Consul.KeyExists): {
                result = getKvItem(Consul.LockSessionKeyByDefault, Consul.SessAsDefault);
                break;
            }
            case (keyPrefixVal + Consul.KeyTouchRenewFailed): {
                result = getKvItem(Consul.LockSessionKeyOfTouchRenewFailed, Consul.SessAsDefault);
                break;
            }
            case (keyPrefixVal + Consul.KeyLockSessionIsNull): {
                result = getKvItem(null, Consul.SessAsDefault);
                break;
            }
            case (keyPrefixVal + Consul.KeyError): {
                err = Consul.TestErrorMessage;
                break;
            }
            case (keyPrefixVal + Consul.KeyCritical): {
                throw new Error(Consul.TestErrorMessage);
            }            
            case (keyPrefixVal + Consul.KeyCritical): {
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
        this.res[opts.name] = opts;
        callback(err, { ID: Consul.LockSessionKeyByDefault })
    },
    destroy: function (ID, callback) {
        var err = null;
        callback(err);
    },
    renew: function (ID, callback) {
        var err = null;  
        var result = null;
        switch(ID){            
            case Consul.LockSessionKeyOfTouchRenewFailed: {
                err = new Error(Consul.TestErrorMessageOfTouchRenew);
                result = [
                    { ID: Consul.LockSessionKeyUnknown }
                ];
                break;
            }
            case Consul.LockSessionKeyByDefault: {
                result = [
                    { ID: Consul.LockSessionKeyByDefault }
                ];
                break;
            }
            default:
                throw new Error('Unknown test ID: ' + ID);
        }              
        callback(err, result);
    }
}

module.exports = Consul;
