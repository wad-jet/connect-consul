var chai = require('chai'),
    session = require('express-session'),
    util = require('util'),
    // sinon = require('sinon'), // DOC: https://sinonjs.org/
    ConsulMock = require('./mock/consul-mock'),
    ConsulSessionStore = require('../src/connect-consul')(session);

var assert = chai.assert;    // Using Assert style
var expect = chai.expect;    // Using Expect style
var should = chai.should();  // Using Should style
var foo = { foo: 'bar' };

const mockOpts = {
    debug: true,
    socket: new ConsulMock(),
};
var obj = new ConsulSessionStore(mockOpts);

describe('The module interface declaration test', function() {
    describe('require("connect-consul")', function() {
        it('it should return a valid function', function() {
            var cssFunc = require('../src/connect-consul');
            expect(cssFunc).to.be.a('function');      
        });    
    }),
    describe('new (require("connect-consul")(session))(opts) object', function() {
        it('object should instance of express-session.Store', function() {            
            expect(obj).to.be.an.instanceOf(ConsulSessionStore);        
            expect(obj).to.be.an.instanceOf(session.Store);    
        });

        it('object should have property get', function() {
            expect(obj).to.have.property('get');
        });

        it('object should have property set', function() {
            expect(obj).to.have.property('set');      
        });

        it('object should have property destroy', function() {
            expect(obj).to.have.property('destroy');        
        });

        it('object should have property touch', function() {
            expect(obj).to.have.property('touch');        
        });    

        it('object should have a logger properties', function() {
            expect(obj).to.have.property('debug');     
            expect(obj).to.have.property('info');
            expect(obj).to.have.property('warn');
            expect(obj).to.have.property('error');
            expect(obj).to.have.property('trace');
            expect(obj).to.have.property('log');
        });
    });
});

describe('The main operations test', function() {
    
    var mockSess = {
        cookie: {
            maxAge: null,
            // TODO: ...
        }
    }

    var 
    checkErrorFunc = function(err) {
        if (!util.isNullOrUndefined(err)) {           
            /*if(err instanceof Object) {
                console.log('ERR as object: ' + JSON.stringify(err))

                expect(err).to.have.property('isPapi', true);    
                expect(err).to.have.property('isResponse', true);
                expect(err).to.have.property('message', 'missing session');
                expect(err).to.have.property('statusCode', 500);
            } else */ {
                throw 'err has value: ' + JSON.stringify(err);
            }
        }
    },
    baseAsync = async function(action) {
        var result = await new Promise(function(resolve, reject) {
            // 2000ms by default used in mocha. Using this code if need less timeout:
            // setTimeout(function() { reject('test timeout'); }, 1000);
            action(function(err, data) {

                resolve(data);
            });            
        });
        result = result || { err: null, data: null };

        console.debug('> baseAsync result: ' + JSON.stringify(result));
        return result;
    },    
    getAsync = async function(key, noDeleteLCID) {
        var result = await baseAsync(function(cb) {
            obj.get(key, cb, noDeleteLCID);           
        });
        return result;
    },
    setAsync = async function(key, sess) {
        var result = await baseAsync(function(cb) {
            obj.set(key, sess, cb);
        });
        return result;
    },
    destroyAsync = async function(key) {
        var result = await baseAsync(function(cb) {
            obj.destroy(key, cb);
        });
        return result;
    }, 
    touchAsync = async function(key) {
        var result = await baseAsync(function(cb) {
            obj.touch(key, mockSess, cb);
        });
        return result;
    };

    describe('GET', function() {
        it('get by key ' + ConsulMock.KeyNotExists + ', this key not exists in KV Store', async function() {
            var asyncResult = await getAsync(ConsulMock.KeyNotExists, false);            
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
        });
        it('get by key ' + ConsulMock.KeyExists + ', this key exists in KV Store', async function() {
            var asyncResult = await getAsync(ConsulMock.KeyExists, false);            
            expect(asyncResult.err).to.be.null;
            expect(asyncResult.data).to.be.null;
        });
    });


    /*
    describe('SET', function() {
        // TODO: chack is exception
        // obj.set(key, foo, function(...args) { });
        it('without connection to consul', async function() {
            var asyncResult = await setAsync(key, mockSess);
            checkErrorFunc(asyncResult.err);

            console.log('SET result.data: ' + JSON.stringify(asyncResult.data))
            
            // TODO: ...
        });
    });
    
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
            var asyncResult = await touchAsync(key);
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