const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true }, // Add a unique room identifier
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  ],
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message",
    },
  ],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "message",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("chat", chatSchema);
