const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "chat", // Reference to the chat the message belongs to
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", // User who sent the message
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", // User who receives the message
    required: true,
  },
  content: { type: String, required: true }, // Message text
  isRead: { type: Boolean, default: false }, // Status of the message (read/unread)
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("message", messageSchema);
