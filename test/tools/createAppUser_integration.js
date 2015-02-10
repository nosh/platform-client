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


describe('users setup', function () {

  /**
  * Timeout is used when running against the deployed services
  */
  this.timeout(10000);
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
  function createClientAsNewUser(user, cb) {
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
  before(function (done) {
    //init the master account
    createClient(function(err, client){
      if (err != null) {
        return done(err);
      }
      //console.log('init master client');
      masterClient = client;
      masterClient.login(masterUser,{},function (error, data) {
        if (data && data.userid) {
          masterUser.id = data.userid;
          //console.log('init master user: ',masterUser);
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
  it('create new app account', function (done) {

    var newUser = {
      id: null,
      token: null,
      username: 'jamie+A100-B200@tidepool.org',
      password: 'A100-B200',
      emails: ['jamie+A100-B200@tidepool.org'],
      profile: {fullName:'A100-B200',patient:{birthday:'2000-01-01',diagnosisDate:'2001-01-01'}}
    };

    var newUserClient;

    var uploadPermissions = {view: {}};

    createClientAsNewUser(newUser, function(error, client){
      expect(error).to.not.exist;
      expect(client.isLoggedIn()).to.be.true;
      newUserClient = client;
      console.log('signed-up: ',newUser.username);

      async.series([
        newUserClient.addOrUpdateProfile.bind(null, newUser.id, newUser.profile),
        newUserClient.setAccessPermissions.bind(null, masterUser.id, uploadPermissions)
      ], function(err, results) {
        if(_.isEmpty(err)){
          /*
           * do tests for profile
           */
          console.log('profile added: ',results[0]);
          var profile = results[0];
          expect(profile).to.be.exist;
          expect(profile.fullName).to.equal(newUser.profile.fullName);
          expect(profile.patient).to.deep.equal(newUser.profile.patient);
          /*
           * do tests for permissons
           */
          console.log('permissions set: ',results[1]);
          var permissions = results[1];
          //we have given upload perms to the master account
          expect(permissions).to.deep.equal(uploadPermissions);
          return done();
        }
        return done(err);
      });
    });
  });
});
