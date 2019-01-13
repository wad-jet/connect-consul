'use strict';

/*!
 * Connect - Consul
 * Copyright(c) 2018 wad-jet <in@wad-jet.ru>
 * MIT Licensed
 */

// DOC: https://learn.hashicorp.com/consul/getting-started/agent
// npm consul : https://www.npmjs.com/package/consul
var debug = require('debug')('connect-consul');
var Consul = require('consul');
// var Txn = require('./consul/txn').Txn;
var util = require('util');

module.exports = function (session) {
    const store = session.Store;
    /**
     * One day in seconds.
     */
    // const oneDay = 86400;

    const _throwIfSessDataNotValid = function(sess) {
        if (sess === null) {
            throw new Error('The session data is null.');
        } else
        if (sess === undefined) {
            throw new Error('The session data is undefined.');
        } else
        if (sess.cookie === undefined) {
            var strData = (sess instanceof Object) ? JSON.stringify(sess) : (sess + '');
            throw new Error('The sesssion data.cookie is undefined. Sess data has value: ' + strData);
        }
    }

    const _getTTL = function(sess) {
        const maxAge = sess.cookie.maxAge;
        return (typeof maxAge === 'number'
            ? Math.floor(maxAge / 1000)
            : null);
    }

    const _nil = function(err, args) { };

    const _loggerTest = function(logger) {
        if (util.isNullOrUndefined(logger)) return false;
        let result = true;
        if(util.isNullOrUndefined(logger.debug) || typeof logger.debug !== 'function') {
            debug('[!] Logger not implemented the debug method.'); result = false;
        }
        if(util.isNullOrUndefined(logger.info) || typeof logger.info !== 'function') {
            debug('[!] Logger not implemented the info method.'); result = false;
        }
        if(util.isNullOrUndefined(logger.warn) || typeof logger.warn !== 'function') {
            debug('[!] Logger not implemented the warn method.'); result = false;
        }
        if(util.isNullOrUndefined(logger.error) || typeof logger.error !== 'function') {
            debug('[!] Logger not implemented the error method.'); result = false;
        }
        if(util.isNullOrUndefined(logger.trace) || typeof logger.trace !== 'function') {
            debug('[!] Logger not implemented the trace method.'); result = false;
        }
        if(util.isNullOrUndefined(logger.log) || typeof logger.log !== 'function') {
            debug('[!] Logger not implemented the log method.'); result = false;
        }
        return result;
    };

    const _getSessionKey = function(id, self) {
        if (util.isNullOrUndefined(id)) {
            //TODO: TEST ...
            throw Error('Argument "id" is null or undefined.')
        }
        const result = self._pathToKeys + id;
        return result;
    };
    const _getLockSessionName = function(id, self) {
        if (util.isNullOrUndefined(id)) {
            //TODO: TEST ...
            throw Error('Argument "id" is null or undefined.')
        }
        const result = self._app + ':' + id;
        return result;
    };

    const __get = function(sessionKey, cb, self) { 
        self.debug(`[.] Get session ${sessionKey} value.`);
        self._consul.kv.get(sessionKey, function(err, item) {
            if (!util.isNullOrUndefined(err)) return cb(err);
            if (util.isNullOrUndefined(item)) {
                self.debug(`[X] The session ${sessionKey} not exists.`);
                return cb();
            }
            try {
                var sessionResult = self._serializer.parse(item.Value);
            }
            catch (e) {                
                self.error(`[X] Deserialization value failed, the session ${sessionKey} (lockSessionID: ${item.Session}).`);
                return cb(e);
            }              
            self.debug(`[V] The session ${sessionKey} exists (lockSessionID: ${item.Session}).`);
            return cb(null, sessionResult, item.Session);
        });
    }

    const __set = function(lockSessionID, sessionKey, data, cb, self) {
        self.debug(`[.] Set session ${sessionKey} value (lockSessionID: ${lockSessionID}).`);
        try {
            var sessionValue = self._serializer.stringify(data);
        }
        catch (e) {
            self.error(`[X] Serialization value failed, the session ${sessionKey} (lockSessionID: ${lockSessionID}).`);
            return cb(e);
        }                  
        self._consul.kv.set(sessionKey, sessionValue, { acquire: lockSessionID }, 
            function(err, success) {
                if (!util.isNullOrUndefined(err)) {
                    return cb(err);
                }
                if (!success) { self.warn('The \'set\' operation for the session to Consul k/v failed.'); }
                self.debug(`[V] Set session ${sessionKey} is completed (lockSessionID: ${lockSessionID}).`);
                cb(null);
            }
        );
    }

    /**
     * Options to ConsulSessionStore     
     * @param {Object} opts 
     * - opts.sessionsFolder    by default 'sessions'
     * - opts.application       the application name
     * - opts.serializer        serializer for session data (JSON by default)
     * - opts.socket            has null or Consul instance value. If null, will created a new Consul with opts parameter
     * - opts.logger            the logger should have methods: debug, trace, info, warn, error (undefined by default)
     * - opts.debug             enabled the debug log
     * - opts.sessionBehavior   the consule session behavior: 'delete', 'release' ('delete' by default)
     */
    function ConsulSessionStore(opts) {
        if (!(this instanceof ConsulSessionStore)) {
            return new ConsulSessionStore(opts);
        }

        opts = opts || {};
        this._separator = opts.separator || '/';

        this._logger = opts.logger || null;
        if (_loggerTest(this._logger) === true) {
            this.info('Logger object setup completed successfully.');
        } else {
            this.warn('Logger is failed.');
            this._logger = null;
        }
        delete opts.logger;

        store.call(this, opts);        

        this._app = (!util.isNullOrUndefined(opts.application) ? opts.application : 'connect') + '.sid';
        this._pathToKeys = (opts.sessionsFolder || 'sessions');
        if (this._app !== '') {
            this._pathToKeys += (this._separator + this._app)
        }        
        if (this._pathToKeys[this._pathToKeys.length - 1] != this._separator) {
            this._pathToKeys += this._separator;
        }

        delete opts.application;

        this._serializer = opts.serializer || JSON;
        
        if (!util.isNullOrUndefined(opts.socket) && (typeof opts.socket !== 'object' || opts.socket.constructor.name !== Consul.name)) {
            throw new TypeError('The options.socket value is not instance of Consul (require(\'consul\')).');
        }

        this._consul = opts.socket || new Consul(opts);
        delete opts.socket;
        
        // this._consul.txn = new Txn(this._consul);

        if (!util.isNullOrUndefined(opts.log) && typeof opts.log !== 'function') {
            throw new TypeError('The options.log not a function.');
        }       

        this._sessionBehavior = opts.sessionBehavior === 'release' ? opts.sessionBehavior : 'delete';
        delete opts.sessionBehavior;

        debug.enabled = opts.debug;
        delete opts.debug;

        //TODO: TEST ... Need testes set options values after created a new object with default and opts settings values.
    }

    util.inherits(ConsulSessionStore, session.Store);    

    /**
     * Attempt to fetch session by the given `id`.
     *
     * @param {String} id
     * @param {Function} cb
     * @api public
     */
    ConsulSessionStore.prototype.get = function (id, cb) {
        const self = this;
        const sessionKey = _getSessionKey(id, self); cb = cb || _nil;        
        return __get(sessionKey, cb, self);        
    }

    /**
     * Commit the given `data` object associated with the given `id`.
     *
     * @param {String} id
     * @param {Session} data
     * @param {Function} cb
     * @api public
     */
    ConsulSessionStore.prototype.set = function (id, data, cb) {
        _throwIfSessDataNotValid(data);

        const self = this;
        cb = cb || _nil;
        const sessionKey = _getSessionKey(id, self);
        __get(sessionKey, function(err, prevData, lockSessionID) {
            if (!util.isNullOrUndefined(err)) {
                self.warn(`[X] Session ${sessionKey}, get by key on set is failed, lockSessionID: ${lockSessionID}. The err has value: ${JSON.stringify(err)}`);
                return cb(err);
            }
            if (!util.isNullOrUndefined(prevData)) {     
                if (util.isNullOrUndefined(lockSessionID)) {
                    return cb(new Error('The session data not have a lock session ID'));
                }
                self.debug(`[.] Update session ${sessionKey}, lockSessionID: ${lockSessionID}.`);    
                __set(lockSessionID, sessionKey, data, function(err) {
                    if (!err) self.debug(`[V] Session ${sessionKey} updated, lockSessionID: ${lockSessionID}.`);
                    cb(err);
                }, self);
            } else {
                const ttl = _getTTL(data);
                self.debug(`[.] Create new session ${sessionKey}.`);
                self._consul.session.create({
                    name: _getLockSessionName(id, self),
                    ttl: !util.isNullOrUndefined(ttl) ? (ttl + 's') : null,
                    behavior: self._sessionBehavior,
                }, function(err, result) {
                    if (!util.isNullOrUndefined(err)) return cb(err);
                    const lockSessionID = result.ID;
                    __set(lockSessionID, sessionKey, data, function(err) {
                        if (!err) self.debug(`[V] New session ${sessionKey} successfully created, lockSessionID: ${lockSessionID}.`);
                        cb(err);
                    }, self);                    
                });
            }
        }, self);
    }

    /**
     * Destroy the session associated with the given `id`.
     *
     * @param {String} id
     * @param {Function} fn
     * @api public
     */
    ConsulSessionStore.prototype.destroy = function (id, cb) {
        const self = this;
        const sessionKey = _getSessionKey(id, self); cb = cb || _nil;
        self.debug(`[.] Destroy session ${sessionKey}.`);
        __get(sessionKey, function(err, sessionData, lockSessionID) {        
            if (!util.isNullOrUndefined(err)) {
                self.warn(`[X] Session ${sessionKey}, get by key on destroy is failed, lockSessionID: ${lockSessionID}. The err has value: ${JSON.stringify(err)}`);
                return cb(err);
            }
            if (util.isNullOrUndefined(sessionData)) {
                self.debug(`[X] Session id ${id} not exists.`);
                return cb();
            }
            if (util.isNullOrUndefined(lockSessionID)) {
                self.warn(`[X] Missing lockSessionID value for session id ${id}.`)
                return cb();
            }
            self._consul.session.destroy(lockSessionID, function(err) {
                if (!err) self.debug(`[V] Session ${sessionKey} destroyed, lockSessionID: ${lockSessionID}.`);
                cb(err);
            });            
        }, self);
    }

    /**
     * Refresh the time-to-live for the session with the given `id`.
     *
     * @param {String} id
     * @param {Session} data
     * @param {Function} cb
     * @api public
     */
    ConsulSessionStore.prototype.touch = function (id, data, cb) {
        _throwIfSessDataNotValid(data);

        const self = this;
        const sessionKey = _getSessionKey(id, self); cb = cb || _nil;
        self.debug(`[.] Touch session ${sessionKey}.`);
        if (!util.isNullOrUndefined(data) && data.cookie.maxAge === null) {
            self.debug(`[X] Refresh the time-to-live for the session ${sessionKey} is ignored becouse cookie.maxAge not set and the session does not expire.`);
            return cb();
        }        
        __get(sessionKey, function(err, sessionData, lockSessionID) {        
            if (!util.isNullOrUndefined(err)) {
                self.warn(`[X] Session ${sessionKey}, get by key on touch is failed, lockSessionID: ${lockSessionID}. The err has value: ${JSON.stringify(err)}`);
                return cb(err);
            }
            if (util.isNullOrUndefined(sessionData)) {
                self.debug(`[X] Missing sessionData value for session id ${id}.`);
                return cb();
            }
            if (util.isNullOrUndefined(lockSessionID)) {
                self.warn(`[X] Missing lockSessionID value for session id ${id}.`)
                return cb();
            }            
            self._consul.session.renew(lockSessionID, function(err, renew) {
                if (lockSessionID !== renew[0].ID) {
                    throw Error('Resulted renew[0].ID (' + renew[0].ID + ') and lockSessionID (' + lockSessionID + ') are not equal.');
                }
                if (!err) 
                    self.debug(`[V] Session ${sessionKey} touched, lockSessionID: ${renew[0].ID}.`);
                else //TODO: TEST
                    self.warn(`[X] Session ${sessionKey} touch is failed, lockSessionID: ${lockSessionID}.`);
                cb(err);
            });                    
        }, self);
    }

    ConsulSessionStore.prototype.debug = function(...args) {
        debug(...args);    
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.debug)) {
            this._logger.debug(...args); return true;
        } else return false;
    }

    ConsulSessionStore.prototype.info = function(...args) {
        if (args.length !== 0 && typeof args[0] === 'string') {
            debug('[info] ' + args[0]);
        } else { 
            debug(...args); 
        }
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.info)) {
            this._logger.info(...args); return true;
        } else return false;
    }

    ConsulSessionStore.prototype.warn = function(...args) {
        if (args.length !== 0 && typeof args[0] === 'string') {
            debug('[warn] ' + args[0]);
        } else { 
            debug(...args); 
        }
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.warn)) {
            this._logger.warn(...args); return true;
        } else return false;
    }

    ConsulSessionStore.prototype.error = function(...args) {
        if (args.length !== 0 && typeof args[0] === 'string') {
            debug('[error] ' + args[0]);
        } else { 
            debug(...args); 
        }
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.error)) {
            this._logger.error(...args); return true;
        } else return false;
    }

    ConsulSessionStore.prototype.trace = function(...args) {
        debug(...args);
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.trace)) {
            this._logger.trace(...args); return true;
        } else return false;
    }

    ConsulSessionStore.prototype.log = function(...args) {
        debug(...args);
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.log)) {
            this._logger.log(...args); return true;
        } else return false;
    }

    return ConsulSessionStore;
}