function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    req.session.user = req.user;
    return next();
  } else {
    return res.redirect('/login');
  }
}
module.exports = isAuthenticated;
