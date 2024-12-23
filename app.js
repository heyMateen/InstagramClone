var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var expressSession = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

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

module.exports = app;
