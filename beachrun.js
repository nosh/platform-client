var _ = require('lodash');
var async = require('async');
var superagent = require('superagent');
var platform = require('./index.js');
var pjson = require('./package.json');
var request = require('request');

var createClient = function(user, loginOpts,cb) {
  var myLog = { info: console.log, warn: console.log };
  
  if(process.argv.length < 4) {
    console.log('usage <username> <password> <host endpoint (optional defaults to staging)>');
    return;
  }

  var host = process.argv.length > 4 ? process.argv[4] : 'https://staging-api.tidepool.io';

  console.log('Creating strava notes for: ', process.argv[2], ' at ', host);

  var client = platform(
    { host: host,
      metricsSource : pjson.name,
      metricsVersion : pjson.version
    },
    {
      superagent : superagent,
      log : myLog,
      localStore: {}
    }
  );

  return client.login(user, {}, function (error, data) {
    if (error) {
      return cb(error, null);
    }

    return cb(null, client);
  });
};

var brandon = {
  username: process.argv[2],
  password: process.argv[3],
  emails: [process.argv[2]]
};

createClient(brandon, {}, function(error,loggedIn){
  loggedIn.getCurrentUser(function(error, user) {
    var note = {
      userid: user.userid,
      groupid: user.userid,
      timestamp: new Date().toISOString(), /*"start_date_local":"2014-08-15T09:53:00Z",*/
      messagetext: 'Hola Brandon!'
    };
    console.log("Got user.");

    /*get all messages*/
    loggedIn.getNotesForUser(user.userid, null, function (error, notes) {

      console.log("Got all notes.");
      /*get strava runs for brandon*/
      request('https://www.strava.com/api/v3/athlete/activities?access_token=ebd6383c33a90beebdb93308f0cb9b856a56617b', function (error, response, body) {
          console.log("Got all activities.");
          console.log("Check to see if new activities are available and notes need to be created.");
          var runs = JSON.parse(body)
          for(var i in runs) {
            var run = runs[i];
            var msg = 'Strava ' + run.type + ': ' + run.name + '\n\r'+
              'Distance: ' + (run.distance * 0.000621371).toFixed(1) + ' mi \n\r' +
              'Duration: ' + Math.round(run.moving_time / 3600) +':'+ Math.round(((run.moving_time / 3600) - Math.floor(run.moving_time / 3600)) * 60) + '\n\r' +
              'Elevation: ' + run.total_elevation_gain + ' ft';
            var note = {
              userid: user.userid,
              groupid: user.userid,
              timestamp: new Date(run['start_date']).toISOString(),
              messagetext: msg
            };
            var match = _.filter(notes, {timestamp: note.timestamp});

            if(!match) {
                loggedIn.startMessageThread(note, function (error, added) {
                  console.log("Create note for run:", run.name, error, added);
                });
            }
          }

          console.log("Done! Nothing more the see here. CTRL+c to end");
      });
    });
  });
});
