var consulKVitem = { Value: { __LSID: 'fake-lcid' } };

function Consul() {
    console.info('Mock consul instance created.');
}

const keyPrefix = 'sessions/connect.sid/';
Consul.KeyNotExists = 'not-exists';
Consul.KeyExists = 'exists';

// INFO: C:\dev\github\wad-jet\connect-consul\node_modules\consul\lib\kv.js

Consul.prototype.kv = {
    get: function(opts, callback) {
        var err = null;  
        var key = ((opts instanceof Object) ? opts.key : opts);
        var resultItem = null;
        switch(key){
            case (keyPrefix + Consul.KeyNotExists):
                {
                    resultItem = null;
                    break;
                }
            case (keyPrefix + Consul.KeyExists):
                {
                    resultItem = consulKVitem;
                    break;
                }
            default:
                throw new Error('Unknown test key: ' + key)
        }              
        var result = resultItem !== null ? JSON.stringify(resultItem) : null;
        callback(err, result);
    },
    set: function(key, value, opts, callback) {
        var success = true;
        callback(err, success);
    },
}

Consul.prototype.session = {
    create: function (opts, callback) {
        var err = null;   
        callback(err, { ID: 'fake-lock-session-ID' })
    },
    destroy: function (ID, callback) {
        var err = null;        
        callback(err);
    },
    renew: function (ID, callback) {
        var err = null;        
        callback(err, [
            { ID: 'fake-lock-session-ID' }
        ]);
    }
}

module.exports = Consul;