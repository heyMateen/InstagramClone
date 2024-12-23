const http = require("http");
const express = require("express");
const socketIo = require("socket.io");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const expressSession = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

const Message = require("./models/message"); // Import the Message model
const Chat = require("./models/chat"); // Import the Chat model

var app = express();

// Create HTTP server and initialize socket.io
const server = http.createServer(app);
const io = socketIo(server);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Session middleware should be the first middleware after requiring dependencies
app.use(
  expressSession({
    resave: false,
    saveUninitialized: false,
    secret: "heyheyehhdd",
  })
);

// Initialize passport and use session to manage authentication state
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(usersRouter.serializeUser());
passport.deserializeUser(usersRouter.deserializeUser());

// Middleware for flash messages
app.use(flash());

// Now that session, passport, and flash are set up, we can log requests, parse body, and set cookies
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Middleware to pass flash messages to views
app.use(function (req, res, next) {
  res.locals.successMessages = req.flash("success");

  const errorMessages = req.flash("errorMessages")[0];
  res.locals.errorMessages = errorMessages ? JSON.parse(errorMessages) : {}; // Parse errors

  const formData = req.flash("formData")[0];
  res.locals.formData = formData ? JSON.parse(formData) : {}; // Parse form data

  next();
});

// Route handlers come after the middleware setup
app.use("/", indexRouter);
app.use("/users", usersRouter);


// catch 404 and forward to error handler

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle joining a room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Handle sending messages
  socket.on("sendMessage", async (data) => {
    try {
      const { content, sender, roomId } = data;

      let chat = await Chat.findOne({ roomId });
      if (!chat) {
        chat = new Chat({
          roomId, // Assign the concatenated roomId here
          participants: [sender._id, data.recipient],
        });
        await chat.save();
      }

      // Create a new message
      const message = new Message({
        chat: chat._id,
        sender: sender._id,
        recipient: data.recipient, // Pass the recipient
        content,
      });

      // Save the message to the database
      await message.save();

      // Add the message to the chat's messages array and update lastMessage
      chat.messages.push(message._id);
      chat.lastMessage = message._id;
      chat.updatedAt = Date.now();
      await chat.save();

      // Emit the message to the room
      io.to(roomId).emit("newMessage", {
        sender: {
          _id: sender._id,
          username: sender.username,
          picture: sender.picture,
        },
        content: message.content,
      });

      console.log("Message saved and emitted:", message.content);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});
app.use(function (req, res, next) {
  next(createError(404));
});

// Error-handling middleware should always be the last middleware
app.use(function (err, req, res, next) {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render("error");
});

// Listen on the port for HTTP and WebSocket connections
server.listen(8000, () => {
  console.log("Server is running on port 8000");
});

module.exports = app;
