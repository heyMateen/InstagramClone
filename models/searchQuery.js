const mongoose = require("mongoose");

// Define schema for storing search queries
const searchQuerySchema = new mongoose.Schema({
  searchedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", // Reference to the User model for the user being searched
    required: true, // Every search will be associated with a searched user
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", // Reference to User model to track who performed the search
    required: true, // Every search needs to be associated with a user
  },
  timestamp: {
    type: Date,
    default: Date.now, // Automatically stores the time of the search
  },
});

// Create and export the model
const SearchQuery = mongoose.model("SearchQuery", searchQuerySchema);

module.exports = SearchQuery;
