const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Define storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Setting upload destination");
    cb(null, "./public/images/uploads"); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    console.log("Processing filename:", file.originalname);
    const unique = uuidv4();
    cb(null, unique + path.extname(file.originalname));
  },
});

// Multer middleware
const upload = multer({ storage: storage });

module.exports = upload;
