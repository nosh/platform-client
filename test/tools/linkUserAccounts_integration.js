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
      //host: 'https://api.tidepool.io',
      //host: 'https://staging-api.tidepool.io',
      host: 'http://localhost:8009',
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
describe('link users', function () {
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
  function linkAccounts(grantingUser, askingUser, permissonsRequested, cb) {
    async.waterfall([
      function(callback) {
        //need id of askingUser
        getClient(askingUser, function(err, askingUserClient){
          callback(err, askingUserClient.getUserId());
        });
      },
      function(askingUsersId,callback) {
        //need client and id grantingUser
        getClient(grantingUser, function(err, grantingUserClient){
          callback(err, grantingUserClient, grantingUserClient.getUserId(), askingUsersId);
        });
      },
      function(grantingUserClient, grantingUsersId, askingUsersId, callback) {
        console.log('Give ', askingUser.username, permissonsRequested, 'permissions on user ',grantingUser.username);

        grantingUserClient.setAccessPermissions(askingUsersId, permissonsRequested, function(err,data){
          if(_.isEmpty(err)){
            console.log('no errors so lets check the result ',data);
            expect(data).to.deep.equal(uploadPermsToApply);
            callback();
          }else{
            console.log('error trying to link the accounts ',err);
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

      if( _.isEmpty(userDetails[0]) || userDetails.length !== 6){
        console.log('We need six bits of info per line but given ',userDetails);
        done();
      } else {
        var grantingUser = { id: null, username: userDetails[0], password: userDetails[1] };
        var askingUser = { id: null, username: userDetails[3], password: userDetails[4] };

        linkAccounts(grantingUser, askingUser, uploadPermsToApply, function(err){
          if(_.isEmpty(err)){
            lr.resume();
          } else {
            console.log('failed linking users accounts', err);
            return done(err);
          }
        });
      }
    });
    lr.on('end', function () {
      console.log('all accounts linked validated');
      done();
    });
  });
});