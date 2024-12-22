function deleteStoryAuthorization(req, res, next){
    const userId = req.session.passport.user;
    const storyId = req.params.id;

    if(story.user._id.toString() === userId){
        return next();
    }
    return res.redirect('/feed');
}
module.exports = deleteStoryAuthorization;