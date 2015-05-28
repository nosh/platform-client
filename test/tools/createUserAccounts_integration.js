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

describe('create users', function () {
  /**
  * Timeout is used when running against the deployed services
  */
  this.timeout(10000000);
  /**
  * User who will manage and run the process
  */
  var masterClient = null;
  var masterUser = { id: null, token: null, username: 'jamie+skip@tidepool.org', password: 'blip4life' };
  var fullPermsToApply =  { upload:{}, view:{}, note:{}};
  /**
   * Line reader
   */
  var LineByLineReader = require('line-by-line');
  /**
  * Helpers functions
  */
  function createAndValidateAppUser(user, cb) {
    createClient(function(err, client){
      if (err != null) {
        return cb(err);
      }
      client.signup(user,{},function (error, data) {
        if (error != null) {
          return cb(error);
        }
        user.id = data.userid;

        async.series([
          client.addOrUpdateProfile.bind(null, user.id, user.profile),
          client.setAccessPermissions.bind(null, masterUser.id, fullPermsToApply)
        ], function(err, results) {
          if(_.isEmpty(err)){
            /*
             * do tests for profile
             */
            console.log('user profile added: ',results[0]);
            var profile = results[0];
            expect(profile).to.be.exist;
            expect(profile.fullName).to.equal(user.profile.fullName);
            expect(profile.patient).to.deep.equal(user.profile.patient);
            /*
             * do tests for permissons
             */
            /*console.log('user permissions set: ',results[1]);
            var permissions = results[1];
            //we have given upload perms to the master account
            expect(permissions).to.deep.equal(fullPermsToApply);*/
            return cb(null);
          }
          return cb(err);
        });

      });
    });
  }
  function createAccounts(userOne, userTwo, cb) {
    async.waterfall([
      function(callback) {
        createAndValidateAppUser(userOne, callback);
      },
      function(callback) {
        createAndValidateAppUser(userTwo, callback);
      }
    ], function (err, result) {
      return cb(err);
    });
  }

 /**
  * Setup
  */
  before(function (done) {
    //init the master account
    createClient(function(err, client){
      if (err != null) {
        return done(err);
      }
      masterClient = client;
      masterClient.login(masterUser,{},function (error, data) {
        if (data && data.userid) {
          masterUser.id = data.userid;
          //console.log('main account logged in: ',masterUser.id);
        }
        done();
      });
    });
  });

 /**
  * Tear down
  */
  after(function (done) {
    //logout master account
    masterClient.logout(function(){
      done();
    });
  });

  it.skip('as singles from accounts list', function (done) {
    var lr = new LineByLineReader(accountsTxtPath);
    lr.on('line', function (line) {

      lr.pause();
      var userDetails = line.split(' ');

      if( _.isEmpty(userDetails[0]) || userDetails.length !== 3){
        console.log('We need three bits of info per line but given ',userDetails);
        done();
      } else {

        var userOne = {
          id: null,
          username: userDetails[0],
          emails: [userDetails[0]],
          password: userDetails[1],
          profile: {fullName:userDetails[2],patient:{birthday:'1900-01-01',diagnosisDate:'1900-01-01'}}
          //profile: {fullName:userDetails[2],patient:{birthday:'1900-01-01',diagnosisDate:'1900-01-01'}}
        };

        console.log('adding ... ', userOne);

        createAndValidateAppUser(userOne,function(err){
            if(_.isEmpty(err)){
              lr.resume();
            } else {
              console.log('failed creating and verifying app-user ', err);
              throw err;
            }
        });

      }
    });
    lr.on('error', function (err) {
      console.log('error trying to generate accounts: ',err);
      done();
    });
    lr.on('end', function () {
      console.log('all accounts created and validated');
      done();
    });
  });
  it('as pairs for linking from accounts list', function (done) {

    var lr = new LineByLineReader(accountsTxtPath);

    lr.on('line', function (line) {

      console.log('starting ...');
      lr.pause();
      var userDetails = line.split(' ');

      if( _.isEmpty(userDetails[0]) || userDetails.length !== 6 ){
        console.log('We need six bits of info per line but given ',userDetails);
        done();
      } else {

        var userOne = {
          id: null,
          username: userDetails[0],
          emails: [userDetails[0]],
          password: userDetails[1],
          profile: {fullName:userDetails[2],patient:{birthday:'1900-01-01',diagnosisDate:'1900-01-01'}}
        };

        var userTwo = {
          id: null,
          username: userDetails[3],
          emails: [userDetails[3]],
          password: userDetails[4],
          profile: {fullName:userDetails[5]}
        };

        console.log('adding one ... ', userTwo);
        console.log('adding two ... ', userOne);

        createAccounts(userOne, userTwo, function(err){
          if(_.isEmpty(err)){
            lr.resume();
          } else {
            console.log('failed adding ', userOne.username, userTwo.username);
            console.log('failed reason ', err);
            lr.resume();
          }
        });
      }
    });
    lr.on('error', function (err) {
      console.log('error trying to generate accounts: ',err);
      done();
    });
    lr.on('end', function () {
      console.log('all accounts created and validated');
      done();
    });
  });
});