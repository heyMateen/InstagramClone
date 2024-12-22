var express = require("express");
var router = express.Router();
const passport = require("passport");
const localStrategy = require("passport-local");
const userModel = require("./users");
const postModel = require("./posts");
const storyModel = require("./story");
passport.use(new localStrategy(userModel.authenticate()));
const upload = require("./multer");
const utils = require("../utils/utils");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isGuest = require("../middlewares/isGuest");
const deleteStoryAuthorization = require("../middlewares/deleteStoryAuthorization");

// Guest Routes
router.get("/", isGuest, function (req, res) {
  res.render("index", { footer: false });
});

router.get("/login", isGuest, function (req, res) {
  res.render("login", { footer: false });
});

router.get("/like/:postid", isAuthenticated, async function (req, res) {
  const post = await postModel.findOne({ _id: req.params.postid });
  const user = await userModel.findOne({ username: req.session.passport.user });
  if (post.like.indexOf(user._id) === -1) {
    post.like.push(user._id);
  } else {
    post.like.splice(post.like.indexOf(user._id), 1);
  }
  await post.save();
  res.json(post);
});

router.get("/feed", isAuthenticated, async function (req, res) {
  let user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate("posts")
    .populate("stories");
  let stories = await storyModel.find().populate("user");
  let filtered = stories.filter((item) => {
    return item.user._id.toString() !== user._id.toString();
  });
  let myStories = user.stories;

  let posts = await postModel.find().populate("user");
  console.log(myStories);
  res.render("feed", {
    footer: true,
    user,
    posts,
    stories: filtered,
    myStories: myStories,
    dater: utils.formatRelativeTime,
  });
});
router.get("/story/:id", isAuthenticated, async (req, res) => {
  try {
    const storyId = req.params.id;
    const user = req.session.user;

    // Fetch story and populate user details
    const story = await storyModel.findById(storyId).populate("user");

    if (!story) {
      return res.status(404).send("Story not found");
    }

    // Log populated story details
    console.log("Story object:", story);
    console.log("Populated user ID:", story.user?._id);

    res.render("story", { footer: true, story: story, user: user });
  } catch (error) {
    console.error("Error fetching story:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/delete/story/:id", isAuthenticated, deleteStoryAuthorization, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.session.user._id;

  try {
    const story = await storyModel.findById(storyId);

    if (!story) {
      return res.status(404).send("Story not found");
    }

    // Delete the story
    await storyModel.findByIdAndDelete(storyId);

    const user = await userModel.findById(userId);
    const storyIndex = user.stories.indexOf(storyId);
    if (storyIndex !== -1) {
      user.stories.splice(storyIndex, 1);
      await user.save();
    }

    res.redirect("/feed");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while deleting the story");
  }
});

router.get("/profile", isAuthenticated, async function (req, res) {
  let user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate("posts")
    .populate("saved");
  console.log(user);

  res.render("profile", { footer: true, user });
});

router.get("/profile/:user", isAuthenticated, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });

  if (user.username === req.params.user) {
    res.redirect("/profile");
  }

  let userprofile = await userModel
    .findOne({ username: req.params.user })
    .populate("posts");

  res.render("userprofile", { footer: true, userprofile, user });
});

router.get("/follow/:userid", isAuthenticated, async function (req, res) {
  let followKarneWaala = await userModel.findOne({
    username: req.session.passport.user,
  });

  let followHoneWaala = await userModel.findOne({ _id: req.params.userid });

  if (followKarneWaala.following.indexOf(followHoneWaala._id) !== -1) {
    let index = followKarneWaala.following.indexOf(followHoneWaala._id);
    followKarneWaala.following.splice(index, 1);

    let index2 = followHoneWaala.followers.indexOf(followKarneWaala._id);
    followHoneWaala.followers.splice(index2, 1);
  } else {
    followHoneWaala.followers.push(followKarneWaala._id);
    followKarneWaala.following.push(followHoneWaala._id);
  }

  await followHoneWaala.save();
  await followKarneWaala.save();

  res.redirect("back");
});

router.get("/search", isAuthenticated, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });
  res.render("search", { footer: true, user });
});

router.get("/save/:postid", isAuthenticated, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });

  if (user.saved.indexOf(req.params.postid) === -1) {
    user.saved.push(req.params.postid);
  } else {
    var index = user.saved.indexOf(req.params.postid);
    user.saved.splice(index, 1);
  }
  await user.save();
  res.json(user);
});

router.post("/saved-posts", isAuthenticated, async (req, res) => {
  try {
    const user = req.user;

    const savedPostIds = user.saved;

    if (!savedPostIds || savedPostIds.length === 0) {
      return res.status(200).json([]);
    }

    const savedPosts = await postModel.find({ _id: { $in: savedPostIds } });

    res.status(200).json(savedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/liked-posts", isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id;

    const likedPosts = await postModel.find({
      like: { $in: [userId] },
    });

    if (likedPosts.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(likedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/search/:user", isAuthenticated, async function (req, res) {
  const searchTerm = `^${req.params.user}`;
  const regex = new RegExp(searchTerm);

  let users = await userModel.find({ username: { $regex: regex } });

  res.json(users);
});

router.get("/edit", isAuthenticated, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render("edit", { footer: true, user });
});

router.get("/upload", isAuthenticated, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });
  res.render("upload", { footer: true, user });
});
router.post(
  "/upload",
  isAuthenticated,
  upload.single("image"),
  async function (req, res) {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });
    user.picture = req.file.filename;
    await user.save();
    res.redirect("/edit");
  }
);

router.post(
  "/update",
  isAuthenticated,
  upload.single("picture"),
  async function (req, res) {
    const user = await userModel.findOneAndUpdate(
      { username: req.session.passport.user },
      { username: req.body.username, name: req.body.name, bio: req.body.bio },
      { new: true }
    );
    if (req.file) {
      user.picture = req.file.filename;
      await user.save();
    }
    res.redirect("/profile");
  }
);

router.post(
  "/post",
  isAuthenticated,
  upload.single("image"),
  async function (req, res) {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });

    if (req.body.category === "post") {
      const post = await postModel.create({
        user: user._id,
        caption: req.body.caption,
        picture: req.file.filename,
      });
      user.posts.push(post._id);
    } else if (req.body.category === "story") {
      let story = await storyModel.create({
        story: req.file.filename,
        user: user._id,
        caption: req.body.caption,
      });
      user.stories.push(story._id);
    } else {
      res.send("tez mat chalo");
    }

    await user.save();
    res.redirect("/feed");
  }
);

// POST

router.post("/register", function (req, res, next) {
  const user = new userModel({
    username: req.body.username,
    email: req.body.email,
    name: req.body.name,
  });

  userModel.register(user, req.body.password).then(function (registereduser) {
    passport.authenticate("local")(req, res, function () {
      res.redirect("/profile");
    });
  });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/feed",
    failureRedirect: "/login",
  }),
  function (req, res) {}
);

router.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

module.exports = router;
