const express = require("express");
const router = express.Router();
const sql = require("mssql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true },
};

router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  console.log("Signup request body:", req.body);

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const pool = await sql.connect(config);

    // Trim email to remove whitespace
    const trimmedEmail = email.trim();

    // Check if email exists
    const existing = await pool
      .request()
      .input("Email", sql.NVarChar, trimmedEmail)
      .query(`SELECT * FROM Users WHERE Email = @Email`);

    if (existing.recordset.length > 0) {
      return res.status(400).json({ message: "Email already exists." });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);
    console.log("Inserting user:", { email: trimmedEmail });

    // Insert new user
    await pool
      .request()
      .input("Email", sql.NVarChar, trimmedEmail)
      .input("PasswordHash", sql.NVarChar, hash)
      .query(
        `INSERT INTO Users (Email, PasswordHash) VALUES (@Email, @PasswordHash)`
      );

    res.json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Signup error:", err);
    // Handle SQL unique constraint error explicitly
    if (err.message.includes("Violation of UNIQUE")) {
      return res.status(400).json({ message: "Email already exists." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login/user", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE Email = @Email");

    const user = result.recordset[0];
    if (!user) return res.status(400).json({ message: "User not found." });

    const match = await bcrypt.compare(password, user.PasswordHash);
    if (!match) return res.status(400).json({ message: "Invalid password." });

    const token = jwt.sign(
      {
        id: user.Id,
        email: user.Email,
        username: user.Username || user.Email,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful!",
      token,
      username: user.Username || user.Email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login/vendor", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT * FROM Vendors WHERE Email = @Email");

    const user = result.recordset[0];
    if (!user) return res.status(400).json({ message: "User not found." });

    const match = await bcrypt.compare(password, user.PasswordHash);
    if (!match) return res.status(400).json({ message: "Invalid password." });

    const token = jwt.sign({ id: user.Id, email: user.Email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful!", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/share - increment count
router.post("/share", async (req, res) => {
  const { platform, articleId } = req.body;
  if (!platform || !articleId)
    return res.status(400).json({ message: "Platform and articleId required" });

  try {
    const pool = await sql.connect(config);

    // Merge: insert if not exists, else increment count and update last_updated
    await pool
      .request()
      .input("url", sql.NVarChar, articleId)
      .input("platform", sql.NVarChar, platform).query(`
        MERGE ShareCounts AS target
        USING (SELECT @url AS url, @platform AS platform) AS source
        ON target.Url = source.url AND target.Platform = source.platform
        WHEN MATCHED THEN UPDATE SET Count = Count + 1, Last_Updated = GETDATE()
        WHEN NOT MATCHED THEN INSERT (Url, Platform, Count, Last_Updated)
        VALUES (@url, @platform, 1, GETDATE());
      `);

    // Return updated count
    const result = await pool
      .request()
      .input("url", sql.NVarChar, articleId)
      .input("platform", sql.NVarChar, platform)
      .query(
        "SELECT Count FROM ShareCounts WHERE Url=@url AND Platform=@platform"
      );

    res.json({ count: result.recordset[0].Count });
  } catch (err) {
    console.error("Share error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/share/:articleId - get all counts
router.get("/share/:articleId", async (req, res) => {
  const articleId = req.params.articleId;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("url", sql.NVarChar, articleId)
      .query("SELECT Platform, Count FROM ShareCounts WHERE Url=@url");

    res.json(result.recordset);
  } catch (err) {
    console.error("Share error:", err); // <-- full SQL error message
    console.error("Get share counts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET comments by page number (query version)
router.get("/comments", async (req, res) => {
  const { pageNum } = req.query;
  if (!pageNum) {
    return res.status(400).json({ message: "pageNum query is required" });
  }

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("PageNum", sql.Int, pageNum)
      .query(
        "SELECT * FROM Comments WHERE PageNum = @PageNum ORDER BY Created_at DESC"
      );

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// middleware to check JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; // decoded payload (should contain email)
    next();
  });
}

// POST /api/comments - only logged in users
router.post("/comments", authenticateToken, async (req, res) => {
  const { content, pageNum } = req.body;
  const author = req.user.email; // use email from JWT

  if (!content || !pageNum) {
    return res
      .status(400)
      .json({ message: "Content and page number are required." });
  }

  try {
    const pool = await sql.connect(config);
    await pool
      .request()
      .input("Author", sql.NVarChar, author)
      .input("Content", sql.NVarChar, content)
      .input("PageNum", sql.Int, pageNum)
      .query(
        "INSERT INTO Comments (Author, Content, PageNum) VALUES (@Author, @Content, @PageNum)"
      );

    res.json({ message: "Comment added successfully!" });
  } catch (err) {
    console.error("Error saving comment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
