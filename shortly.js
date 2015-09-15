var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser  = require("cookie-parser");
var crypto = require('crypto');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(cookieParser());

app.all("/", function(req, res, next) {
  checkUser(req.cookies, res, next);
});

app.all("/create", function(req, res, next) {
  checkUser(req.cookies, res, next);
});

app.all("/links", function(req, res, next) {
  checkUser(req.cookies, res, next);
});

function checkUser(cookies, res, next) {
  Users.query({where: {username: cookies.username, password: cookies.password}}).fetch().then(function(model) {
   if (model.length === 0) {
    res.redirect(302, "/login");
    return;
   }
    next();
  });
}

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/create', function(req, res) {
  res.render('index');
});

app.get('/login', function(req,res) {
  res.cookie('username', "");
  res.cookie('password', "");
  res.render('login');
});

app.get('/signup', function(req,res) {
  res.render('signup');
});

app.get('/links', function(req, res) {
  Users.query({where: {username: req.cookies.username, password: req.cookies.password}}).fetchOne().then(function (model) {
    Links.reset().query({where: {user_id: model.attributes.id}}).fetch().then(function(links) {
      res.send(200, links.models);
    });
  });


});

app.post('/links', function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        var link;
        Users.query({where: {username: req.cookies.username, password: req.cookies.password}}).fetchOne().then(function (model) {
          console.log(model.attributes);
          link = new Link({
            url: uri,
            title: title,
            user_id: model.attributes.id,
            base_url: req.headers.origin,
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          })

        });
      });
    }
  });
});

app.post('/login', function(req, res) {
  Users.query({where: {username: req.body.username}}).fetchOne().then(function(user) {
    if (!user) {
      res.render('signup', { error: 'No user in database' });
    } else {
      var hash = hashPassword(req.body.password);
      if (hash === user.attributes.password) {
        res.cookie("username", req.body.username);
        res.cookie("password", hash);
        res.redirect('/');
      } else {
        res.render('login', { error: 'Invalid user or password.' });
      }
    }
  });
});

function hashPassword(str) {
  var shasum = crypto.createHash('sha1');
  shasum.update(str);
  return shasum.digest('hex');
};

app.post('/signup', function(req, res) {
  Users.query({where: {username: req.body.username}}).fetchOne().then(function(user) {
    console.log(user);
    if (user) {
      res.render('login', { error: 'user in database' });
    } else {
      //User does not exsist
      var user = new User({
        'username': req.body.username,
        'password': req.body.password
      }).save().then(function() {
        res.render('login');
      });
    }
  });
});

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
