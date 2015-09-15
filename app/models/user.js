var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link.js');
var crypto = require('crypto');

var User = db.Model.extend({
  tableName: 'users',

  hasTimestamps: true,
  links: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    this.on('creating', function(model, attrs, options){
      var shasum = crypto.createHash('sha1');
      shasum.update(model.get('password'));
      model.set('password', shasum.digest('hex'));
    });
  }
});

module.exports = User;