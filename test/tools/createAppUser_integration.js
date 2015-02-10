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

describe('users setup', function () {

  /**
  * Timeout is used when running against the deployed services
  */
  this.timeout(100000);
  /**
  * User who will manage and run the process
  */
  var masterClient = null;
  var masterUser = {
    id: null,
    token: null,
    username: 'jamie+bate@tidepool.org',
    password: 'blip4life'
  };
  var permsToApply =  { view: {}};
  /**
  * Helpers
  */
  function createClient(cb) {
    var myLog = { info: console.log, warn: console.log };

    var client = platform(
      {
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
  function createClientAsNewUser_old(user, cb) {
    return createClient(function(err, client){
      if (err != null) {
        return cb(err);
      }
      return client.signup(user, function (error, data) {
        if (error) {
          return cb(error, null);
        }
        user.id = data.userid;
        return cb(null, client);
      });
    });
  }

  function createAndValidateAppUser(user, cb) {
    createClient(function(err, client){
      if (err != null) {
        return cb(err);
      }
      client.signup(user, function (error, data) {
        if (error != null) {
          return cb(error);
        }
        user.id = data.userid;

        async.series([
          client.addOrUpdateProfile.bind(null, user.id, user.profile),
          client.setAccessPermissions.bind(null, masterUser.id, permsToApply)
        ], function(err, results) {
          if(_.isEmpty(err)){
            /*
             * do tests for profile
             */
            console.log('profile added: ',results[0]);
            var profile = results[0];
            expect(profile).to.be.exist;
            expect(profile.fullName).to.equal(user.profile.fullName);
            expect(profile.patient).to.deep.equal(user.profile.patient);
            /*
             * do tests for permissons
             */
            console.log('permissions set: ',results[1]);
            var permissions = results[1];
            //we have given upload perms to the master account
            expect(permissions).to.deep.equal(permsToApply);
            return cb();
          }
          return cb(err);
        });

      });
    });
  }
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
        }
        done();
      });
    });
  });
  after(function (done) {
    //logout master account
    masterClient.logout(function(){
      done();
    });
  });
  it.skip('create app account', function (done) {

    var newUser = {
      id: null,
      token: null,
      username: 'jamie+A101-B201@tidepool.org',
      password: 'A101-B201',
      emails: ['jamie+A101-B201@tidepool.org'],
      profile: {fullName:'A101-B201',patient:{birthday:'2000-01-01',diagnosisDate:'2001-01-01'}}
    };
    //do the work
    createAndValidateAppUser(newUser,function(err){
      if(_.isEmpty(err)){
        return done();
      }
      console.log('failed creating and verifying app-user ', err);
      return done(err);
    });

  });
  it('create app user accounts', function (done) {

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
      var newUser = {
        id: null,
        username: userDetails[0],
        password: userDetails[2],
        emails: [userDetails[0]],
        profile: {fullName:userDetails[1],patient:{birthday:'2000-01-01',diagnosisDate:'2001-01-01'}}
      };

      //console.log('adding .. ', newUser);

      /*createAndValidateAppUser(newUser,function(err){
        if(_.isEmpty(err)){
          lr.resume();
        } else {
          console.log('failed creating and verifying app-user ', err);
          return done(err);
        }
      });*/

      setTimeout(function () {
        console.log('adding .. ', newUser);
        lr.resume();
      }, 100);
    });

    lr.on('end', function () {
      console.log('all accounts created and validated');
      done();
    });

  });
});
