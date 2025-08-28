const express = require("express");
const path = require("path");
const cors = require("cors");  // <-- import cors
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Allow CORS for all origins (development)
app.use(cors({
  origin: "https://streetdelic-fbg0gchtavakeqhg.canadacentral-01.azurewebsites.net", // your frontend URL
  methods: ["GET","POST"],
  credentials: true
}));

// Parse JSON
app.use(express.json());

// Serve static files
app.use(express.static("public"));

// Import auth routes
const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
