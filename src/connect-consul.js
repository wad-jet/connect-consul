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

    const _throwIfSessDataNotValid = function(data) {
        if (data === null) {
            throw new Error('The session data is null.');
        } else
        if (data === undefined) {
            throw new Error('The session data is undefined.');
        } else
        if (data.cookie === undefined) {
            var strData = (data instanceof Object) ? JSON.stringify(data) : (data + '');
            throw new Error('The sesssion data.cookie is undefined. Sess data has value: ' + strData);
        }
    }

    const _getTTL = function(self, sess, id) {
        _throwIfSessDataNotValid(sess);
        
        const maxAge = sess.cookie.maxAge;
        return (typeof maxAge === 'number'
            ? Math.floor(maxAge / 1000)
            : null);
    }

    const _nil = function(err, args) { };

    const _getSessionKey = function(id, self) {
        const result = self._pathToKeys + id;
        return result;
    };
    const _getLockSessionName = function(id, self) {
        const result = self._app + ':' + id;
        return result;
    };

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

        this._logger = opts.logger || null;
        delete opts.logger;

        this._sessionBehavior = opts.sessionBehavior === 'release' ? opts.sessionBehavior : 'delete';
        delete opts.sessionBehavior;

        debug.enabled = opts.debug;
        delete opts.debug;
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

        self.debug(`Get session ${sessionKey} value.`);
        const optsKV = { key: sessionKey };
        if (self._separator !== '/') {
            optsKV.separator = self._separator;
        }
        self._consul.kv.get(optsKV, function(err, item) {
            if (!util.isNullOrUndefined(err)) return cb(err);
            if (util.isNullOrUndefined(item)) return cb();
            try {
                var sessionResult = self._serializer.parse(item.Value);
            }
            catch (e) {
                return cb(e);
            }              
            self.debug(`The session ${sessionKey} has value.`);
            return cb(null, sessionResult, item.Session);
        });
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
        this.get(id, function(err, prevData, lockSessionID) {
            if (!util.isNullOrUndefined(err)) {
                return cb(err);
            }
            const sessionKey = _getSessionKey(id, self); 

            var __set = function(lockSessionID, _data, cb) {                
                try {
                    var sessionValue = self._serializer.stringify(_data);
                }
                catch (e) {
                    return cb(e);
                }                  
                self._consul.kv.set(sessionKey, sessionValue, { acquire: lockSessionID }, 
                    function(err, success) {
                        if (!util.isNullOrUndefined(err)) {
                            return cb(err);
                        }
                        if (!success) { self.warn('The \'set\' operation for the session to Consul k/v failed.'); }
                        cb(null);
                    }
                );
            }

            if (!util.isNullOrUndefined(prevData)) {     
                if (util.isNullOrUndefined(lockSessionID)) {
                    throw new Error('The session data not have a lock session ID');
                }

                self.debug(`Update session ${sessionKey}, lockSessionID: ${lockSessionID}.`);    
                __set(lockSessionID, data, function(err) {
                    if (!err) self.debug(`Session ${sessionKey} updated, lockSessionID: ${lockSessionID}.`);
                    cb(err);
                });
            } else {
                const ttl = _getTTL(self, data, id);
                self.debug(`Create new session ${sessionKey}.`);
                self._consul.session.create({
                    name: _getLockSessionName(id, self),
                    ttl: !util.isNullOrUndefined(ttl) ? (ttl + 's') : null,
                    behavior: self._sessionBehavior,
                }, function(err, result) {
                    if (!util.isNullOrUndefined(err)) return cb(err);
                    const lockSessionID = result.ID;
                    __set(lockSessionID, data, function(err) {
                        if (!err) self.debug(`New session ${sessionKey} created, lockSessionID: ${lockSessionID}.`);
                        cb(err);
                    });                    
                });
            }
        });
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

        self.debug(`Destroy session ${sessionKey}.`);
        this.get(id, function(err, sessionData, lockSessionID) {
            if (!util.isNullOrUndefined(err)) {
                return cb(err);
            }
            if (!util.isNullOrUndefined(sessionData)) {
                self._consul.session.destroy(lockSessionID, function(err) {
                    if (!err) self.debug(`Session ${sessionKey} destroyed, lockSessionID: ${lockSessionID}.`);
                    cb(err);
                });            
            }
        }, true);
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
        self.debug(`Touch session ${sessionKey}.`);
        if (!util.isNullOrUndefined(data) && data.cookie.maxAge === null) {
            self.debug(`Refresh the time-to-live for the session ${sessionKey} is ignored becouse cookie.maxAge not set and the session does not expire.`);
            return cb();
        }        
        this.get(id, function(err, sessionData, lockSessionID) {
            if (!util.isNullOrUndefined(err)) {
                return cb(err);
            }
            if (!util.isNullOrUndefined(sessionData)) {
                self._consul.session.renew(lockSessionID, function(err, renew) {
                    if (lockSessionID !== renew[0].ID) {
                        throw new Error('The renew[0].ID (' + renew[0].ID + ') and lockSessionID (' + lockSessionID + ') are not equal.');
                    }
                    if (!err) self.debug(`Session ${sessionKey} touched, lockSessionID: ${renew[0].ID}.`);
                    cb(err);
                });            
            }
        }, true);
    }

    ConsulSessionStore.prototype.debug = function(...args) {
        debug(...args);        
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.debug)) {
            this._logger.debug(...args);
        }
    }

    ConsulSessionStore.prototype.info = function(...args) {
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.info)) {
            this._logger.info(...args);
        }
    }

    ConsulSessionStore.prototype.warn = function(...args) {
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.warn)) {
            this._logger.warn(...args);
        }
    }

    ConsulSessionStore.prototype.error = function(...args) {
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.error)) {
            this._logger.error(...args);
        }
    }

    ConsulSessionStore.prototype.trace = function(...args) {
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.trace)) {
            this._logger.trace(...args);
        }
    }

    ConsulSessionStore.prototype.log = function(...args) {
        if (this._logger !== null && !util.isNullOrUndefined(this._logger.log)) {
            this._logger.log(...args);
        }
    }

    return ConsulSessionStore;
}