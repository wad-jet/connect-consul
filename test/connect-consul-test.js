var chai = require('chai'),
    session = require('express-session'),
    util = require('util'),
    // sinon = require('sinon'), // DOC: https://sinonjs.org/
    ConsulMock = require('./mock/consul-mock'),
    SerializerMock = require('./mock/serializer-mock'),
    ConsulSessionStore = require('../src/connect-consul')(session);

var assert = chai.assert;    // Using Assert style
var expect = chai.expect;    // Using Expect style
var should = chai.should();  // Using Should style
var foo = { foo: 'bar' };

const logItems = [];
var loggerForTest = {
    debug: function(...args) {        
        logItems.push(args[0]);
    },
    info: function(...args) {
        logItems.push(args[0]);
    },
    warn: function(...args) {
        logItems.push(args[0]);
    },
    error: function(...args) {
        logItems.push(args[0]);
    },
    trace: function(...args) {
        logItems.push(args[0]);
    },
    log: function(...args) {
        logItems.push(args[0]);
    }
}

var _checkLog = function(startsWith, position = 0) {
    if (logItems.length === 0) return false;
    const result = logItems[logItems.length - 1].startsWith(startsWith, position);
    if (result === false) {
        console.log(`The '${logItems[logItems.length - 1]}' not starts with '${startsWith}' in position ${position}.`);
    }
    return result;
}

var _CreateMockSessionStore = function(opts) {
    opts = opts || { debug: true };
    opts.logger = loggerForTest;
    if (util.isNullOrUndefined(opts.socket)) {
        opts.socket = new ConsulMock();
    }
    const result = new ConsulSessionStore(opts);
    return result;
}

var consulMock = new ConsulMock();
var sessionStore = _CreateMockSessionStore({
    debug: true,    
    socket: consulMock,
});

describe('The module interface declaration test', function() {

    describe('Requiring the "connect-consul" module.', function() {
        it('Require should return a valid function.', function() {
            var cssFunc = require('../src/connect-consul');
            expect(cssFunc).to.be.a('function');      
        });
        it('Checking the SessionStore object instance.', function() {
            expect(sessionStore).to.be.an.instanceOf(ConsulSessionStore);
        });
        it('SessionStore object should instance of express-session.Store', function() {            
            expect(sessionStore).to.be.an.instanceOf(session.Store);    
        });
    }),

    describe('Checking the properties for the SessionStore object.', function() {
        
        it('object should have property get', function() {
            expect(sessionStore).to.have.property('get');
        });

        it('object should have property set', function() {
            expect(sessionStore).to.have.property('set');      
        });

        it('object should have property destroy', function() {
            expect(sessionStore).to.have.property('destroy');        
        });

        it('object should have property touch', function() {
            expect(sessionStore).to.have.property('touch');        
        });    

        it('object should have a logger properties', function() {
            expect(sessionStore).to.have.property('debug');     
            expect(sessionStore).to.have.property('info');
            expect(sessionStore).to.have.property('warn');
            expect(sessionStore).to.have.property('error');
            expect(sessionStore).to.have.property('trace');
            expect(sessionStore).to.have.property('log');
        });

        it('check validation the logger object', function() {

            const _logger = { };
            let opts = { logger: _logger };

            let ss = new ConsulSessionStore(opts);

            expect(ss.debug('foo')).to.be.false;
            expect(ss.info('foo')).to.be.false;
            expect(ss.warn('foo')).to.be.false;
            expect(ss.error('foo')).to.be.false;
            expect(ss.trace('foo')).to.be.false;
            expect(ss.log('foo')).to.be.false;

            _logger.debug = function(...args) { expect(args[0]).equal('foo'); };

            opts = { logger: _logger };
            ss = new ConsulSessionStore(opts);

            expect(ss.debug('foo')).to.be.false;
            expect(ss.info('foo')).to.be.false;
            expect(ss.warn('foo')).to.be.false;
            expect(ss.error('foo')).to.be.false;
            expect(ss.trace('foo')).to.be.false;
            expect(ss.log('foo')).to.be.false;

            _logger.info = function(...args) { if (args[0] !== 'Logger object setup completed successfully.') expect(args[0]).equal('foo'); };
            _logger.warn = function(...args) { expect(args[0]).equal('foo'); };
            _logger.error = function(...args) { expect(args[0]).equal('foo'); };
            _logger.trace = function(...args) { expect(args[0]).equal('foo'); };
            _logger.log = function(...args) { expect(args[0]).equal('foo'); };

            opts = { logger: _logger };
            ss = new ConsulSessionStore(opts);

            expect(ss.debug('foo')).to.be.true;
            expect(ss.info('foo')).to.be.true;
            expect(ss.warn('foo')).to.be.true;
            expect(ss.error('foo')).to.be.true;
            expect(ss.trace('foo')).to.be.true;
            expect(ss.log('foo')).to.be.true;
        });
    });
});

describe('Properties execution tests for the SessionStore object.', function() {
    var 
        exceptAsync = async function(promise) {
            try {
                const res = await promise;                
                if (res.err !== null) {
                    return expect(res.err.message);
                }
            } catch (err) {
                return expect(err.message);
            }
            throw 'Error not thrown';
        },
        baseAsync = async function(action) {
            var result = await new Promise(function(resolve, reject) {
                // 2000ms by default used in mocha. Using this code if need less timeout:
                // setTimeout(function() { reject('test timeout'); }, 1000);
                action(function(err, data, lockSessionId) {
                    var resolveValue = { 
                        err: (!!err ? err : null), 
                        data: (!!data ? data : null),
                        lockSessionId: lockSessionId,
                    };
                    resolve(resolveValue);
                });            
            });
            return result;
        },    
        getAsync = async function(key, ss = sessionStore) {
            var result = await baseAsync(function(cb) {
                ss.get(key, cb);           
            });
            return result;
        },
        setAsync = async function(key, sess, ss = sessionStore) {
            var result = await baseAsync(function(cb) {                
                ss.set(key, sess, cb);
            });
            return result;
        },
        destroyAsync = async function(key, ss = sessionStore) {
            var result = await baseAsync(function(cb) {
                ss.destroy(key, cb);
            });
            return result;
        }, 
        touchAsync = async function(key, sess, ss = sessionStore) {
            var result = await baseAsync(function(cb) {
                ss.touch(key, sess, cb);
            });
            return result;
        };

    describe('GET', function() {
        it('get by key ' + ConsulMock.KeyError + ', this operation should returned an error message.', async function() {
            var asyncResult = await getAsync(ConsulMock.KeyError);            
            expect(asyncResult.err).to.not.be.null;
            expect(asyncResult.data).to.be.null;
            expect(asyncResult.lockSessionId).to.be.undefined;
            expect(asyncResult.err).equal(ConsulMock.TestErrorMessage);
        });
        it('get by key ' + ConsulMock.KeyNotExists + ', this key not exists in KV Store.', async function() {
            var asyncResult = await getAsync(ConsulMock.KeyNotExists);            
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(asyncResult.lockSessionId).to.be.undefined;
            expect(_checkLog(`[X] The session sessions/connect.sid/${ConsulMock.KeyNotExists} not exists`)).to.be.true;
        });
        it('get by key ' + ConsulMock.KeyExists + ', this key exists in KV Store.', async function() {
            var asyncResult = await getAsync(ConsulMock.KeyExists);            
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.not.be.null;
            expect(asyncResult.lockSessionId).to.not.be.null;
            expect(asyncResult.lockSessionId).equal(ConsulMock.LockSessionKeyByDefault);
            expect(asyncResult.data.cookie).to.not.be.null.and.not.be.undefined;
            expect(_checkLog(`[V] The session sessions/connect.sid/${ConsulMock.KeyExists} exists`)).to.be.true;
            expect(JSON.stringify(asyncResult.data.cookie)).equal(JSON.stringify(ConsulMock.SessAsDefault.cookie));
        });   
        it('get by key ' + ConsulMock.KeyCritical + ', this operation causes an critical error.', async function() {
            (await exceptAsync(getAsync(ConsulMock.KeyCritical))).equal(ConsulMock.TestErrorMessage);                        
        });

        it('(serializer test) get by key ' + ConsulMock.KeyExists + ', deserialize of value succesful.', async function() {
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = false;
            var _sessionStore = _CreateMockSessionStore({
                debug: true,
                serializer: mockSerializer,
            });

            var asyncResult = await getAsync(ConsulMock.KeyExists, _sessionStore);
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.not.be.null;
            expect(asyncResult.lockSessionId).to.not.be.null;
            expect(asyncResult.lockSessionId).equal(ConsulMock.LockSessionKeyByDefault);
            expect(asyncResult.data.cookie).to.not.be.null.and.not.be.undefined;
            expect(_checkLog(`[V] The session sessions/connect.sid/${ConsulMock.KeyExists} exists`)).to.be.true;
            expect(JSON.stringify(asyncResult.data.cookie)).equal(JSON.stringify(ConsulMock.SessAsDefault.cookie));
        }); 

        it('(serializer test) get by key ' + ConsulMock.KeyExists + ', deserialize of value causes an error.', async function() {
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = true;
            var _sessionStore = _CreateMockSessionStore({
                debug: true,
                serializer: mockSerializer,
            });

            (await exceptAsync(getAsync(ConsulMock.KeyExists, _sessionStore))).equal(SerializerMock.TestErrorMessage);
            expect(_checkLog(`[X] Deserialization value failed, the session sessions/connect.sid/${ConsulMock.KeyExists}`)).to.be.true;
        }); 
    });
    
    describe('SET', function() {
        it('set key ' + ConsulMock.KeyError + ', this operation should returned an error message', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyError, ConsulMock.SessAsDefault);            
            expect(asyncResult.err).to.not.be.null;
            expect(asyncResult.data).to.be.null;
            // expect(asyncResult.lockSessionId).to.be.undefined;
            expect(asyncResult.err).equal(ConsulMock.TestErrorMessage);
            expect(_checkLog(`[X] Session sessions/connect.sid/${ConsulMock.KeyError}, get by key on set is failed`)).to.be.true;
        });
        it('set new key ' + ConsulMock.KeyNotExists + ', this operation should be successful', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyNotExists, ConsulMock.SessAsDefault);            
            expect(asyncResult.err).to.be.null;
            expect(_checkLog(`[V] New session sessions/connect.sid/${ConsulMock.KeyNotExists}`)).to.be.true;         
        });
        it('update key ' + ConsulMock.KeyExists + ', this operation should be successful', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyExists, ConsulMock.SessAsDefault);            
            expect(asyncResult.err).to.be.null;
            expect(_checkLog(`[V] Session sessions/connect.sid/${ConsulMock.KeyExists} updated`)).to.be.true;
        });
        it('set key ' + ConsulMock.KeyLockSessionIsNull + ', lock session is null.', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyLockSessionIsNull, ConsulMock.SessAsDefault);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.not.be.null;
            expect(asyncResult.err.message).equal('The session data not have a lock session ID');
            expect(_checkLog(`[V] The session sessions/connect.sid/${ConsulMock.KeyLockSessionIsNull} exists`)).to.be.true;
        });
        it('set key ' + ConsulMock.KeyCritical + ', this operation causes an critical error.', async function() {
            (await exceptAsync(setAsync(ConsulMock.KeyCritical, ConsulMock.SessAsDefault))).equal(ConsulMock.TestErrorMessage);                        
        });
        it('set key ' + ConsulMock.KeyCritical + ', this operation causes an critical error, because the session data is null.', async function() {
            (await exceptAsync(setAsync(ConsulMock.KeyCritical, null))).equal('The session data is null.');                        
        }); 
        it('set key ' + ConsulMock.KeyCritical + ', this operation causes an critical error, because the session data is undefined.', async function() {
            (await exceptAsync(setAsync(ConsulMock.KeyCritical, undefined))).equal('The session data is undefined.');                        
        }); 
        it('set key ' + ConsulMock.KeyCritical + ', this operation causes an critical error, because data.cookie is undefined.', async function() {
            (await exceptAsync(setAsync(ConsulMock.KeyCritical, { } )));                        
        });
        it('set new key ' + ConsulMock.KeyNotExists + ', separator option changed to ":"', async function() {
            
            const mock = new ConsulMock({ separator: ':' });
            var _sessionStore = _CreateMockSessionStore({
                debug: true,
                socket: mock,
                separator: ':',
            });

            var mockKVRes = mock.kv.res;
            var mockSessRes = mock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess, _sessionStore);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            const sessName = `connect.sid:${ConsulMock.KeyNotExists}`;
            var mockResSess = mockSessRes[sessName];

            expect(mockResSess.name).equal(sessName);
            expect(mockResSess.ttl).to.be.null;
            expect(mockResSess.behavior).equal("delete");

            expect(_checkLog(`[V] New session sessions:connect.sid:${ConsulMock.KeyNotExists}`)).to.be.true;
        });
        it('(serializer test) set key ' + ConsulMock.KeyExists + ', serialize of value succesful.', async function() {
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = false;
            mockSerializer.serFailure = false;
            var _sessionStore = _CreateMockSessionStore({
                debug: true,
                serializer: mockSerializer,
            });

            var asyncResult = await setAsync(ConsulMock.KeyExists, ConsulMock.SessAsDefault, _sessionStore);            
            expect(asyncResult.err).to.be.null;

            expect(_checkLog(`[V] Session sessions/connect.sid/${ConsulMock.KeyExists} updated`)).to.be.true;
        });
        it('(serializer test) set key ' + ConsulMock.KeyExists + ', serialize of value causes an error.', async function() {
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = false;
            mockSerializer.serFailure = true;
            var _sessionStore = _CreateMockSessionStore({
                debug: true,
                serializer: mockSerializer,
            });

            (await exceptAsync(setAsync(ConsulMock.KeyExists, ConsulMock.SessAsDefault, _sessionStore))).equal(SerializerMock.TestErrorMessage);
            
            expect(_checkLog(`[X] Serialization value failed, the session sessions/connect.sid/${ConsulMock.KeyExists}`)).to.be.true;
        }); 
    });

    describe('SET TTL', function() {
        it('set new key ' + ConsulMock.KeyNotExists + ' with cookie.maxAge value, this operation should be successful', async function() {
            var mockKVRes = consulMock.kv.res;
            var mockSessRes = consulMock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }
            sess.cookie.maxAge = 600000;

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            var mockResSess = mockSessRes[`connect.sid:${ConsulMock.KeyNotExists}`];
            expect(mockResSess.ttl).equal(sess.cookie.maxAge / 1000 + 's');
            expect(mockResSess.behavior).equal("delete");

            expect(_checkLog(`[V] New session sessions/connect.sid/${ConsulMock.KeyNotExists}`)).to.be.true;
        });        
        it('set new key ' + ConsulMock.KeyNotExists + ' with cookie.maxAge value (set "release" behavior), this operation should be successful', async function() {
            const mock = new ConsulMock();
            var _sessionStore = _CreateMockSessionStore({
                debug: true,
                socket: mock,
                sessionBehavior: "release",
            });

            var mockKVRes = mock.kv.res;
            var mockSessRes = mock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }            
            sess.cookie.maxAge = 600000;

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess, _sessionStore);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            var mockResSess = mockSessRes[`connect.sid:${ConsulMock.KeyNotExists}`];
            expect(mockResSess.ttl).equal(sess.cookie.maxAge / 1000 + 's');
            expect(mockResSess.behavior).equal("release");

            expect(_checkLog(`[V] New session sessions/connect.sid/${ConsulMock.KeyNotExists}`)).to.be.true;
        });
        it('set new key ' + ConsulMock.KeyNotExists + ', cookie.maxAge has null value.', async function() {
            var mockKVRes = consulMock.kv.res;
            var mockSessRes = consulMock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }
            sess.cookie.maxAge = null;

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            var mockResSess = mockSessRes[`connect.sid:${ConsulMock.KeyNotExists}`];
            expect(mockResSess.ttl).to.be.null;
            expect(mockResSess.behavior).equal("delete");

            expect(_checkLog(`[V] New session sessions/connect.sid/${ConsulMock.KeyNotExists}`)).to.be.true;
        });
        it('set new key ' + ConsulMock.KeyNotExists + ', cookie.maxAge has undefined value.', async function() {
            var mockKVRes = consulMock.kv.res;
            var mockSessRes = consulMock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }
            sess.cookie.maxAge = undefined;

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            var mockResSess = mockSessRes[`connect.sid:${ConsulMock.KeyNotExists}`];
            expect(mockResSess.ttl).to.be.null;
            expect(mockResSess.behavior).equal("delete");

            expect(_checkLog(`[V] New session sessions/connect.sid/${ConsulMock.KeyNotExists}`)).to.be.true;
        });
    });
    
    describe('DESTROY', function() {
        it('key ' + ConsulMock.KeyNotExists + ' is not exists.', async function() {
            var asyncResult = await destroyAsync(ConsulMock.KeyNotExists);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog('[X] Session id not-exists not exists')).to.be.true;
        });
        it('key ' + ConsulMock.KeyExists + ' is exists.', async function() {
            var asyncResult = await destroyAsync(ConsulMock.KeyExists);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog(`[V] Session sessions/connect.sid/${ConsulMock.KeyExists} destroyed`)).to.be.true;
        });
        it('key ' + ConsulMock.KeyLockSessionIsNull + ', lock session is null.', async function() {
            var asyncResult = await destroyAsync(ConsulMock.KeyLockSessionIsNull);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog('[X] Missing lockSessionID value for session')).to.be.true;
        });
        it('key ' + ConsulMock.KeyError + ', this operation should returned an error message.', async function() {
            var asyncResult = await destroyAsync(ConsulMock.KeyError);            
            expect(asyncResult.err).to.not.be.null;
            expect(asyncResult.data).to.be.null;
            expect(asyncResult.lockSessionId).to.be.undefined;
            expect(asyncResult.err).equal(ConsulMock.TestErrorMessage);
            expect(_checkLog(`[X] Session sessions/connect.sid/${ConsulMock.KeyError}`)).to.be.true;
        });
        it('key ' + ConsulMock.KeyCritical + ', this operation causes an critical error.', async function() {
            (await exceptAsync(destroyAsync(ConsulMock.KeyCritical))).equal(ConsulMock.TestErrorMessage)
        });
    });

    describe('TOUCH', function() {
        it('key ' + ConsulMock.KeyNotExists + ' is not exists.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            var asyncResult = await touchAsync(ConsulMock.KeyNotExists, sess);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog('[X] Missing sessionData value')).to.be.true;
        });
        it('key ' + ConsulMock.KeyExists + ' is exists.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            var asyncResult = await touchAsync(ConsulMock.KeyExists, sess);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog(`[V] Session sessions/connect.sid/${ConsulMock.KeyExists} touched`)).to.be.true;
        });
        it('key ' + ConsulMock.KeyLockSessionIsNull + ', lock session is null.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            var asyncResult = await touchAsync(ConsulMock.KeyLockSessionIsNull, sess);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog('[X] Missing lockSessionID value')).to.be.true;
        });
        it('key ' + ConsulMock.KeyExists + ', cookie.maxAge is null or undefined.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            
            sess.cookie.maxAge = null;
            var asyncResult = await touchAsync(ConsulMock.KeyExists, sess);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog('[X] Refresh the time-to-live')).to.be.true;

            sess.cookie.maxAge = undefined;
            var asyncResult = await touchAsync(ConsulMock.KeyExists, sess);
            expect(asyncResult).to.not.be.null.and.not.be.undefined;
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
            expect(_checkLog(`[V] Session sessions/connect.sid/${ConsulMock.KeyExists} touched`)).to.be.true;
        });
        it('key ' + ConsulMock.KeyError + ', this operation should returned an error message.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            var asyncResult = await touchAsync(ConsulMock.KeyError, sess);            
            expect(asyncResult.err).to.not.be.null;
            expect(asyncResult.data).to.be.null;
            expect(asyncResult.lockSessionId).to.be.undefined;
            expect(asyncResult.err).equal(ConsulMock.TestErrorMessage);
            expect(_checkLog(`[X] Session sessions/connect.sid/${ConsulMock.KeyError}`)).to.be.true;
        });
        it('key ' + ConsulMock.KeyCritical + ', this operation causes an critical error.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            (await exceptAsync(touchAsync(ConsulMock.KeyCritical, sess))).equal(ConsulMock.TestErrorMessage);
        });
        it('key ' + ConsulMock.KeyTouchRenewFailed + ', this operation should returned an error message.', async function() {
            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) };
            (await exceptAsync(touchAsync(ConsulMock.KeyTouchRenewFailed, sess))).equal(
                `Resulted renew[0].ID (${ConsulMock.LockSessionKeyUnknown}) and lockSessionID (${ConsulMock.LockSessionKeyOfTouchRenewFailed}) are not equal.`);
        });
    });    
});