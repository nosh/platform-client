// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
//
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

'use strict';
var _ = require('lodash');
var async = require('async');
var expect = require('salinity').expect;
var superagent = require('superagent');

var storage = require('./../../lib/inMemoryStorage');

var platform = require('../../index.js');
var pjson = require('../../package.json');

var accountsTxtPath = './accounts.txt';


function createClient(cb) {
  var myLog = { info: console.log, warn: console.log };

  var client = platform(
    {
      host: 'https://devel-api.tidepool.io',
      //host: 'http://localhost:8009',
      metricsSource : pjson.name,
      metricsVersion : pjson.version
    },
    {
      superagent : superagent,
      log : myLog,
      localStore: storage()
    }
  );
  client.initialize(function(err){
    return cb(err, client);
  });
}
describe('update users', function () {
  this.timeout(10000000);
  var uploadPermsToApply = { upload:{}};


  function getClient(user, cb) {
    createClient(function(err, client){
      if (err != null) {
        return cb(err);
      }
      client.login(user, function (error, data) {
        if (error != null) {
          return cb(error);
        }
        return cb(null, client);
      });
    });
  }
  function updateAccountProfile(user, updates, cb) {
    async.waterfall([
      function(callback) {
        //login as the user
        getClient(user, function(err, userClient){
          callback(err, userClient);
        });
      },
      function(userClient, callback) {
        console.log('Update ', user, ' with updates ',updates);

        userClient.addOrUpdateProfile(userClient.getUserId(), updates, function(err, updatedProfile){
          if(_.isEmpty(err)){
            console.log('profile updated ',updatedProfile);
            expect(updatedProfile).to.exist;
            expect(updatedProfile).to.deep.equal(updates);
            callback();
          }else{
            console.log('error trying to update the account ',err);
            callback(err);
          }
        });
      }
    ], function (err, result) {
      return cb(err);
    });
  }
  it('from accounts list', function (done) {
    var LineByLineReader = require('line-by-line'),
    lr = new LineByLineReader(accountsTxtPath);

    lr.on('error', function (err) {
      console.log('you probably don`/nt have an accounts list to process');
      console.log('error was ',err);
      done();
    });

    lr.on('line', function (line) {
      lr.pause();

      var userDetails = line.split(' ');

      if( _.isEmpty(userDetails[0]) || userDetails.length !== 3){
        console.log('We need only three bits of info per line but given ',userDetails);
        done();
      } else {
        var user = { id: null, username: userDetails[0], password: userDetails[1] };
        var updates = { fullName:userDetails[2] };

        updateAccountProfile(user, updates, function(err){
          if(_.isEmpty(err)){
            lr.resume();
          } else {
            console.log('failed updating users account', err);
            return done(err);
          }
        });
      }
    });
    lr.on('end', function () {
      console.log('all accounts updated and validated');
      done();
    });
  });
});