const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // Reference to the user model
      required: true,
    },
  ], // Array of two users participating in the chat
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message", // Reference to the message model
    },
  ], // Array of messages
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "message", // Reference to the latest message
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // Tracks the latest activity in the chat
});

module.exports = mongoose.model("chat", chatSchema);
