var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var events = require('./routes/events');
var sessions = require('./routes/sessions');
var loadCSV = require('./routes/loadCSV');
var saveJSON = require('./routes/saveJSON');
var fs = require("fs");


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/events', events);
app.use('/sessions', sessions);
//app.post('sessions/save', function(req, res, next) {
//  fs.writeFile( "filename.json", JSON.stringify( myJson ), "utf8", yourCallback );
//});
app.use('/scripts/d3.js', express.static(__dirname + '/node_modules/d3/d3.js'));
//app.use('/models/data.csv', express.static(__dirname + '/models/data.csv'));
//app.use('/models/data.csv', loadCSV);
app.use('/models/sms.json', express.static(__dirname + '/models/sms.json'));
app.use('/models/sessions.json', express.static(__dirname + '/models/sessions.json'));



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
