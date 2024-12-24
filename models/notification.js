const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true, // The user receiving the notification
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true, // The user who triggered the notification
  },
  type: {
    type: String,
    enum: ["like", "comment", "follow", "save"], // Types of notifications
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "post", // Reference to the post if relevant
    default: null,
  },
  story: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "story", // Reference to the story if relevant
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false, // Whether the notification has been read
  },
  content : {
    type : String
  },
  createdAt: {
    type: Date,
    default: Date.now, // Timestamp for notification creation
  },
});

module.exports = mongoose.model("notification", notificationSchema);
