const express = require('express');
var bodyParser = require('body-parser')
const app = express();
const port = 3000;

var session = require('express-session');
var ConsulSessionStore = require('../../src/connect-consul')(session);
 
var opts = { };

app.use(bodyParser.json());

app.use(session({
    store: new ConsulSessionStore(opts),
    secret: 'keyboard cat',
    resave: false
}));

var responseCounterValue = function(req, res) {
    res.json({
        counter: req.session.counter
    });
}

app.get('/', function(req, res, next) {
    req.session.counter = 0; next();
}, responseCounterValue);

app.get('/inc', function(req, res, next) {
    if (req.session.counter !== undefined) {
        req.session.counter += 1; 
    } else {
        req.session.counter = 0; 
    }
    next();
}, responseCounterValue);

app.get('/dec', function(req, res, next) {
    if (req.session.counter !== undefined) {
        req.session.counter -= 1; 
    } else {
        req.session.counter = 0; 
    }
    next();        
}, responseCounterValue);

app.listen(port, () => console.log(`Example app listening on port ${port}!`))