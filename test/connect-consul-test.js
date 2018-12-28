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

var mock =  new ConsulMock();
var mockOpts = {
    debug: true,
    socket: mock,
};
var sessionStore = new ConsulSessionStore(mockOpts);

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
        destroyAsync = async function(key) {
            var result = await baseAsync(function(cb) {
                sessionStore.destroy(key, cb);
            });
            return result;
        }, 
        touchAsync = async function(key, sess) {
            var result = await baseAsync(function(cb) {
                sessionStore.touch(key, sess, cb);
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
        });
        it('get by key ' + ConsulMock.KeyExists + ', this key exists in KV Store.', async function() {
            var asyncResult = await getAsync(ConsulMock.KeyExists);            
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.not.be.null;
            expect(asyncResult.lockSessionId).to.not.be.null;
            expect(asyncResult.lockSessionId).equal(ConsulMock.LockSessionKeyByDefault);
            expect(asyncResult.data.cookie).to.not.be.null.and.not.be.undefined;
            expect(JSON.stringify(asyncResult.data.cookie)).equal(JSON.stringify(ConsulMock.SessAsDefault.cookie));
        });   
        it('get by key ' + ConsulMock.KeyCritical + ', this operation causes an critical error.', async function() {
            (await exceptAsync(getAsync(ConsulMock.KeyCritical))).equal(ConsulMock.TestErrorMessage);                        
        });

        it('(serializer test) get by key ' + ConsulMock.KeyExists + ', deserialize of value succesful.', async function() {
            //TODO: DRY
            const mock = new ConsulMock();
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = false;
            const _mockOpts = {
                debug: true,
                socket: mock,
                serializer: mockSerializer,
            };            
            var _sessionStore = new ConsulSessionStore(_mockOpts);

            var asyncResult = await getAsync(ConsulMock.KeyExists, _sessionStore);
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.not.be.null;
            expect(asyncResult.lockSessionId).to.not.be.null;
            expect(asyncResult.lockSessionId).equal(ConsulMock.LockSessionKeyByDefault);
            expect(asyncResult.data.cookie).to.not.be.null.and.not.be.undefined;
            expect(JSON.stringify(asyncResult.data.cookie)).equal(JSON.stringify(ConsulMock.SessAsDefault.cookie));
        }); 

        it('(serializer test) get by key ' + ConsulMock.KeyExists + ', deserialize of value causes an error.', async function() {
            //TODO: DRY
            const mock = new ConsulMock();
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = true;
            const _mockOpts = {
                debug: true,
                socket: mock,
                serializer: mockSerializer,
            };            
            var _sessionStore = new ConsulSessionStore(_mockOpts);

            (await exceptAsync(getAsync(ConsulMock.KeyExists, _sessionStore))).equal(SerializerMock.TestErrorMessage);    
        }); 
    });
    
    describe('SET', function() {
        it('set key ' + ConsulMock.KeyError + ', this operation should returned an error message', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyError, ConsulMock.SessAsDefault);            
            expect(asyncResult.err).to.not.be.null;
            expect(asyncResult.data).to.be.null;
            // expect(asyncResult.lockSessionId).to.be.undefined;
            expect(asyncResult.err).equal(ConsulMock.TestErrorMessage);
        });
        it('set new key ' + ConsulMock.KeyNotExists + ', this operation should be successful', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyNotExists, ConsulMock.SessAsDefault);            
            expect(asyncResult.err).to.be.null;            
        });
        it('update key ' + ConsulMock.KeyExists + ', this operation should be successful', async function() {
            var asyncResult = await setAsync(ConsulMock.KeyExists, ConsulMock.SessAsDefault);            
            expect(asyncResult.err).to.be.null;
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

        it('(serializer test) set key ' + ConsulMock.KeyExists + ', serialize of value succesful.', async function() {
            //TODO: DRY
            const mock = new ConsulMock();
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = false;
            mockSerializer.serFailure = false;
            const _mockOpts = {
                debug: true,
                socket: mock,
                serializer: mockSerializer,
            };            
            var _sessionStore = new ConsulSessionStore(_mockOpts);

            var asyncResult = await setAsync(ConsulMock.KeyExists, ConsulMock.SessAsDefault, _sessionStore);            
            expect(asyncResult.err).to.be.null;
        }); 

        it('(serializer test) set key ' + ConsulMock.KeyExists + ', serialize of value causes an error.', async function() {
            //TODO: DRY
            const mock = new ConsulMock();
            const mockSerializer = new SerializerMock();
            mockSerializer.deserFailure = false;
            mockSerializer.serFailure = true;
            const _mockOpts = {
                debug: true,
                socket: mock,
                serializer: mockSerializer,
            };            
            var _sessionStore = new ConsulSessionStore(_mockOpts);

            (await exceptAsync(setAsync(ConsulMock.KeyExists, ConsulMock.SessAsDefault, _sessionStore))).equal(SerializerMock.TestErrorMessage);    
        }); 
    });

    describe('SET TTL', function() {
        it('set new key ' + ConsulMock.KeyNotExists + ' with cookie.maxAge value, this operation should be successful', async function() {
            var mockKVRes = mock.kv.res;
            var mockSessRes = mock.session.res;

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
        });
        
        it('set new key ' + ConsulMock.KeyNotExists + ' with cookie.maxAge value (set "release" behavior), this operation should be successful', async function() {
            //TODO: DRY
            const mock = new ConsulMock();
            const mockOpts = {
                debug: true,
                socket: mock,
                sessionBehavior: "release",
            };
            var ss = new ConsulSessionStore(mockOpts);

            var mockKVRes = mock.kv.res;
            var mockSessRes = mock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }            
            sess.cookie.maxAge = 600000;

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess, ss);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            var mockResSess = mockSessRes[`connect.sid:${ConsulMock.KeyNotExists}`];
            expect(mockResSess.ttl).equal(sess.cookie.maxAge / 1000 + 's');
            expect(mockResSess.behavior).equal("release");
        });   
        
        it('set new key ' + ConsulMock.KeyNotExists + ', separator option changed to ":"', async function() {
            //TODO: DRY
            const mock = new ConsulMock({ separator: ':' });
            const mockOpts = {
                debug: true,
                socket: mock,
                separator: ':',
            };
            var ss = new ConsulSessionStore(mockOpts);
            var mockKVRes = mock.kv.res;
            var mockSessRes = mock.session.res;

            var sess = { cookie: Object.assign({ }, ConsulMock.SessAsDefault.cookie) }

            var asyncResult = await setAsync(ConsulMock.KeyNotExists, sess, ss);            
            expect(asyncResult.err).to.be.null;
            var mockResKV = JSON.parse(mockKVRes[ConsulMock.KeyNotExists]);
            expect(mockResKV).to.not.be.null.and.not.be.undefined;
            expect(mockResKV.cookie.maxAge).equal(sess.cookie.maxAge);

            const sessName = `connect.sid:${ConsulMock.KeyNotExists}`;
            var mockResSess = mockSessRes[sessName];

            expect(mockResSess.name).equal(sessName);
            expect(mockResSess.ttl).to.be.null;
            expect(mockResSess.behavior).equal("delete");
        });  
    });

    /*
    describe('DESTROY', function() {
        it('without connection to consul', async function() {
            var asyncResult = await destroyAsync(key);
            checkErrorFunc(asyncResult.err);

            console.log('DESTROY result.data: ' + JSON.stringify(asyncResult.data))

            // TODO: ...
        });
    });
    describe('TOUCH', function() {
        it('without connection to consul', async function() {
            var asyncResult = await touchAsync(key, Consul.SessAsDefault);
            checkErrorFunc(asyncResult.err);

            console.log('TOUCH result.data: ' + JSON.stringify(asyncResult.data))

            // TODO: ...
        });
    });
    */
});

/*
describe('The logger and its methods test', function() {
    
    describe('DEBUG with opts.debug is true', function() {
        // TODO: ...
    });
    describe('DEBUG with opts.debug is false', function() {
        // TODO: ...
    });
    describe('INGO', function() {
        // TODO: ...
    });
    describe('WARN', function() {
        // TODO: ...
    });
    describe('ERROR', function() {
        // TODO: ...
    }); 
    describe('TRACE', function() {
        // TODO: ...
    }); 
    describe('LOG', function() {
        // TODO: ...
    }); 
}); */