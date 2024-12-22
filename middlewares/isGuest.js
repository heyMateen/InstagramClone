function isGuest(req, res, next) {
    if(!req.isAuthenticated()){
        return next();
    }
    return res.redirect("/feed");
}
module.exports = isGuest;
