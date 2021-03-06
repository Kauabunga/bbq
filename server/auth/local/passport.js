import passport from 'passport';
import {Strategy as LocalStrategy} from 'passport-local';
import uuid from 'uuid';
import moment from 'moment';

const TOKEN_LIFETIME = 1000 * 60 * 60 * 2;  // 2 hours

function localAuthenticate(User, email, password, done) {

  return User.findOne({
    email: email.toLowerCase()
  }).exec()
    .then(user => {
      if (!user) {
        return done(null, false, { message: 'The email and token do not match' });
      }

      // limit the token lifetime to ~2hours
      if(isExpiredUserToken(user)){
        return done(null, false, { message: 'The email and token do not match' });
      }

      return user.authenticate(password, function(authError, authenticated) {
        if (authError) {
          return done(authError);
        }
        if (!authenticated) {
          return done(null, false, { message: 'The email and token do not match' });
        }
        else {

          // Remove token password on successful authentication
          user.password = uuid.v4();

          //change the last created token date to the past so the user can go and create a new token if they logout
          user.lastTokenCreatedDate = new Date();
          user.lastTokenCreatedDate.setDate(user.lastTokenCreatedDate.getDate() - 1);


          return user.save()
          .then(updatedUser => {
              return done(null, updatedUser);
            });
        }
      });
    })
    .catch(err => done(err));

}

function isExpiredUserToken(user){
  return Math.abs(moment(user.lastTokenCreatedDate).diff(Date.now())) > TOKEN_LIFETIME;
}

export function setup(User, config) {
  return passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password' // this is the virtual field on the model
  }, function(email, password, done) {
    return localAuthenticate(User, email, password, done);
  }));
}
