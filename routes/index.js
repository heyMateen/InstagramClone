var express = require("express");
var router = express.Router();
const passport = require("passport");
const localStrategy = require("passport-local");
const userModel = require("./users");
const postModel = require("./posts");
const storyModel = require("./story");
const SearchQuery = require("../models/searchQuery");
const chatModel = require("../models/chat");
const messageModel = require("../models/message");
const notificationModel = require("../models/notification");
passport.use(new localStrategy(userModel.authenticate()));
const upload = require("./multer");
const utils = require("../utils/utils");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isGuest = require("../middlewares/isGuest");
const deleteStoryAuthorization = require("../middlewares/deleteStoryAuthorization");
const { body, validationResult } = require("express-validator");

// Guest Routes
router.get("/", isGuest, function (req, res) {
  res.render("index", { footer: false });
});

router.get("/login", isGuest, function (req, res) {
  res.render("login", { footer: false });
});

router.get("/like/:postid", isAuthenticated, async function (req, res) {
  try {
    const post = await postModel
      .findOne({ _id: req.params.postid })
      .populate("user", "_id username"); // Ensure `user` field references the author of the post

    const user = await userModel.findOne({
      username: req.session.passport.user,
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    let liked = false;

    // Toggle like
    if (post.like.indexOf(user._id) === -1) {
      post.like.push(user._id);
      liked = true;
    } else {
      post.like.splice(post.like.indexOf(user._id), 1);
      liked = false;
    }

    await post.save();

    if (liked && String(post.user._id) !== String(user._id)) {
      const notification = new notificationModel({
        recipient: post.user._id, // The user who owns the post
        sender: user._id, // The user who liked the post
        type: "like",
        post: post._id, // Reference to the post
        isRead: false,
        content: `${user.username} liked your post`,
      });

      await notification.save();
    }

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while liking the post" });
  }
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

router.get(
  "/delete/story/:id",
  isAuthenticated,
  deleteStoryAuthorization,
  async (req, res) => {
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
  }
);

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
  try {
    const follower = await userModel.findOne({
      username: req.session.passport.user,
    });

    const currentUser = await userModel.findOne({ _id: req.params.userid });

    if (!follower || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (follower.following.includes(currentUser._id)) {
      // Unfollow logic
      const followingIndex = follower.following.indexOf(currentUser._id);
      follower.following.splice(followingIndex, 1);

      const followerIndex = currentUser.followers.indexOf(follower._id);
      currentUser.followers.splice(followerIndex, 1);
    } else {
      // Follow logic
      currentUser.followers.push(follower._id);
      follower.following.push(currentUser._id);

      // Create a notification for the user being followed
      const notification = new notificationModel({
        recipient: currentUser._id, // User being followed
        sender: follower._id, // User who initiated the follow
        type: "follow",
        isRead: false,
        content: `${follower.username} started following you`,
      });

      await notification.save();
    }

    await currentUser.save();
    await follower.save();

    res.redirect("back");
  } catch (error) {
    console.error("Error in follow route:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing follow request" });
  }
});

router.get("/search", isAuthenticated, async function (req, res) {
  let user = req.user;
  try {
    // Find the search queries for the user and populate both the user and searchedUser
    const searchQueries = await SearchQuery.find({ user: user._id })
      .sort({ timestamp: -1 }) // Sort by most recent search
      .limit(10) // Limit the number of search queries to 10
      .populate("searchedUser", "username name picture"); // Populate the searched user details

    // Pass the search queries to the EJS template
    res.render("search", { footer: true, user, searchQueries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching search queries" });
  }
});

// POST route to store search query
// Handle storing search query
router.post("/store-search", isAuthenticated, async function (req, res) {
  try {
    const { query, username } = req.body; // Get the search query and username from the frontend

    const user = await userModel.findOne({
      username: req.session.passport.user,
    });
    const searchedUser = await userModel.findOne({ username: username });

    // Create a new search query entry
    const searchQuery = new SearchQuery({
      user: user._id, // Store the user who performed the search
      searchedUser: searchedUser._id, // Store the searched user ID
    });

    // Save the search query to the database
    await searchQuery.save();

    res.status(200).json({ message: "Search query stored successfully" });
  } catch (error) {
    console.error("Error storing search query:", error);
    res.status(500).json({ message: "Error storing search query" });
  }
});

router.get("/save/:postid", isAuthenticated, async function (req, res) {
  try {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });
    const post = await postModel
      .findOne({ _id: req.params.postid })
      .populate("user", "_id username");

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    let saved = false;

    // Toggle save
    if (user.saved.indexOf(req.params.postid) === -1) {
      user.saved.push(req.params.postid);
      saved = true;
    } else {
      const index = user.saved.indexOf(req.params.postid);
      user.saved.splice(index, 1);
    }

    await user.save();

    // Store a notification only if the post is saved (not unsaved)
    if (saved && String(post.user._id) !== String(user._id)) {
      const notification = new notificationModel({
        recipient: post.user._id, // The author of the post
        sender: user._id, // The user who saved the post
        type: "save",
        post: post._id, // Reference to the post
        isRead: false,
        content: `${user.username} saved your post`,
      });

      await notification.save();
    }

    res.json(user);
  } catch (error) {
    console.error("Error in save route:", error);
    res.status(500).json({ error: "An error occurred while saving the post" });
  }
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
  [
    // Username validation
    body("username")
      .notEmpty()
      .withMessage("Username is required")
      .custom(async (value, { req }) => {
        const existingUser = await userModel.findOne({ username: value });
        if (
          existingUser &&
          existingUser.username !== req.session.passport.user
        ) {
          throw new Error("Username is already taken");
        }
        return true;
      }),

    // Name validation
    body("name")
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 3 })
      .withMessage("Name must be at least 3 characters long")
      .isAlpha("en-US", { ignore: " " })
      .withMessage("Name must contain only alphabetic characters"),

    // Bio validation
    body("bio")
      .optional()
      .isLength({ max: 300 })
      .withMessage("Bio must be at most 300 characters long"),
  ],
  async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = {};
      errors.array().forEach((err) => {
        formattedErrors[err.path] = err.msg;
      });

      req.flash("errorMessages", JSON.stringify(formattedErrors));
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/edit");
    }

    try {
      const user = await userModel.findOneAndUpdate(
        { username: req.session.passport.user },
        { username: req.body.username, name: req.body.name, bio: req.body.bio },
        { new: true }
      );

      if (req.file) {
        user.picture = req.file.filename;
        await user.save();
      }

      // Re-authenticate the user with the new username
      req.session.passport.user = user.username; // Update the session
      req.login(user, function (err) {
        // Re-authenticate the user
        if (err) {
          console.log("Re-authentication error:", err);
        }
      });

      req.flash("success", "Profile updated successfully.");
      res.redirect("/edit");
    } catch (err) {
      console.log("Profile Update Error:", err);
      req.flash("error", "An error occurred while updating your profile.");
      res.redirect("/edit");
    }
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
router.get("/post/:id/comments", async (req, res) => {
  try {
    const post = await postModel
      .findById(req.params.id)
      .populate("comments.user", "username picture")
      .lean();
    res.json(post.comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Add Comment Endpoint
router.post("/comment/:id", isAuthenticated, async (req, res) => {
  const user = await userModel.findOne({
    username: req.session.passport.user,
  });
  try {
    // Validate request body
    if (!req.body.text) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Find the post by ID
    const post = await postModel
      .findById(req.params.id)
      .populate("user", "_id username");
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Add comment to the post
    const comment = { text: req.body.text, user: req.user._id };
    post.comments.push(comment);
    await post.save();

    // Populate the comment's user field
    await post.populate("comments.user", "username picture");

    // Send back the newly added comment
    const newComment = post.comments[post.comments.length - 1];

    // Create a notification only if the commenter is not the post owner
    if (String(post.user._id) !== String(req.user._id)) {
      const notification = new notificationModel({
        recipient: post.user._id, // The post owner
        sender: req.user._id, // The commenter
        type: "comment", // Notification type
        post: post._id, // The commented post
        isRead: false,
        content: `${user.username} commented on your post : ${req.body.text}`, // The comment content
        createdAt: new Date(),
      });

      await notification.save();
    }

    res.json(newComment);
  } catch (error) {
    console.error("Error in comment route:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST

router.post(
  "/register",
  [
    body("username")
      .notEmpty()
      .withMessage("Username is required")
      .custom(async (value) => {
        const existingUser = await userModel.findOne({ username: value });
        if (existingUser) {
          throw new Error("Username is already taken");
        }
        return true;
      }),
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("A valid email is required")
      .custom(async (value) => {
        const existingEmail = await userModel.findOne({ email: value });
        if (existingEmail) {
          throw new Error("Email is already taken");
        }
        return true;
      }),

    body("name").notEmpty().withMessage("Name is required"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/[\W_]/)
      .withMessage("Password must contain at least one special character"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
  ],
  async function (req, res) {
    console.log("Request Body:", req.body);
    const errors = validationResult(req);
    console.log("Validation Errors:", errors.array());
    if (!errors.isEmpty()) {
      const formattedErrors = {};
      errors.array().forEach((err) => {
        formattedErrors[err.path] = err.msg;
      });
      console.log("Formatted Errors:", formattedErrors);
      req.flash("errorMessages", JSON.stringify(formattedErrors));
      req.flash("formData", JSON.stringify(req.body));

      return res.redirect("/"); // Redirect back to the form on error
    }

    try {
      // Create new user
      const user = new userModel({
        username: req.body.username,
        email: req.body.email,
        name: req.body.name,
      });

      // Register user with password
      await userModel.register(user, req.body.password);

      req.flash("success", "Registration successful. Please log in.");
      res.redirect("/login");
    } catch (err) {
      console.log("Registration Error:", err); // Log error to debug
      req.flash(
        "errorMessages",
        JSON.stringify(["An error occurred during registration."])
      );
      res.redirect("/");
    }
  }
);

router.post("/login", (req, res, next) => {
  // Check if both username and password are provided
  if (!req.body.username || !req.body.password) {
    req.flash("errorMessages", JSON.stringify(["Please provide all fields"]));
    return res.redirect("/login");
  }

  passport.authenticate("local", (err, user, info) => {
    if (err || !user) {
      // Flash the custom error message for authentication failure
      req.flash(
        "errorMessages",
        JSON.stringify(["Invalid username or password"])
      );
      return res.redirect("/login");
    }

    // Log the user in if authentication was successful
    req.login(user, (err) => {
      if (err) return next(err);
      return res.redirect("/feed");
    });
  })(req, res, next);
});

//messegner routes
router.get("/messenger", isAuthenticated, async (req, res) => {
  try {
    // Find all chats for the authenticated user
    const userChats = await chatModel
      .find({ participants: req.user._id })
      .populate("participants", "username picture") // Populate participants
      .populate({
        path: "lastMessage",
        select: "content sender createdAt",
        populate: { path: "sender", select: "username picture" }, // Populate sender of the last message
      })
      .exec();

    // Format chat data
    const chats = userChats.map((chat) => {
      // Generate roomId dynamically based on participants
      const participant = chat.participants.find(
        (participant) => participant._id.toString() !== req.user._id.toString()
      );

      const roomId =
        req.user._id < participant._id
          ? `${req.user._id}-${participant._id}`
          : `${participant._id}-${req.user._id}`;

      return {
        roomId, // Include roomId instead of _id
        participant,
        lastMessage: chat.lastMessage,
      };
    });

    res.render("messenger", { user: req.user, chats, footer: true });
  } catch (err) {
    console.error("Error loading messenger:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/chat/:roomId", isAuthenticated, async (req, res) => {
  try {
    const roomId = req.params.roomId;

    // Ensure messages and sender fields are populated
    const chat = await chatModel
      .findOne({ roomId })
      .populate({
        path: "messages",
        populate: { path: "sender", select: "username picture" },
      })
      .populate("participants", "username picture");

    if (!chat) {
      return res.status(404).send("Chat not found");
    }

    // Filter messages with valid sender
    chat.messages = chat.messages.filter((message) => message.sender);

    // Find the participant who is not the current user
    const participant = chat.participants.find(
      (p) => p._id.toString() !== req.user._id.toString()
    );
    console.log(chat.messages);
    res.render("chat", { footer: true, chat, participant, user: req.user });
  } catch (error) {
    console.error("Error loading chat:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/chat/start", isAuthenticated, async (req, res) => {
  try {
    const { username } = req.body;
    const currentUser = req.user;

    // Prevent users from chatting with themselves
    if (username === currentUser.username) {
      req.flash(
        "errorMessages",
        JSON.stringify(["You cannot chat with yourself."])
      );
      req.flash("formData", JSON.stringify(req.body)); // Retain form data for pre-filling
      return res.redirect("/messenger"); // Redirect back to the messenger page
    }

    // Find the user by username
    const participant = await userModel.findOne({ username });
    if (!participant) {
      // Flash error message and the form data
      req.flash("errorMessages", JSON.stringify(["User not found."]));
      req.flash("formData", JSON.stringify(req.body)); // Retain form data for pre-filling
      return res.redirect("/messenger"); // Redirect back to the messenger page
    }

    // Generate a consistent roomId for the chat
    const roomId =
      currentUser._id < participant._id
        ? `${currentUser._id}-${participant._id}`
        : `${participant._id}-${currentUser._id}`;

    // Check if a chat already exists
    let chat = await chatModel.findOne({
      roomId, // Check based on roomId
    });

    if (!chat) {
      // Create a new chat if one does not exist
      chat = new chatModel({
        participants: [currentUser._id, participant._id],
        roomId, // Include the roomId in the new chat
      });
      await chat.save();
    }

    // Redirect to the newly created or existing chat
    res.redirect(`/chat/${chat.roomId}`);
  } catch (error) {
    console.error("Error starting chat:", error);
    res.status(500).send("Internal Server Error");
  }
});
router.get("/notifications", isAuthenticated, async function (req, res, next) {
  try {
    console.log("User ID:", req.user._id); // Log user ID to make sure it exists

    // Fetch notifications for the logged-in user
    const notifications = await notificationModel
      .find({ recipient: req.user._id })
      .populate("sender", "username picture")
      .sort({ createdAt: -1 });

    // If there are no notifications, just render the page with an empty list
    console.log("Notifications:", notifications); // Log notifications

    // Populate post only if the notification type is related to a post (like, comment, or save)
    for (let notification of notifications) {
      if (
        notification.type === "like" ||
        notification.type === "comment" ||
        notification.type === "save"
      ) {
        // Use populate without execPopulate, directly populating the post field
        await notification.populate("post", "title");
      }
    }

    // Render the notifications view with the notifications data (even if empty)
    res.render("notification", { notifications, footer: true, user: req.user });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      error: "An error occurred while fetching notifications",
      details: error.message || error,
    });
  }
});



router.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

module.exports = router;
