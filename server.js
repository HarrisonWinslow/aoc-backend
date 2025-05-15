
import fs from "fs/promises";
import path from 'path';
import express from 'express';
import fetch from 'node-fetch'; // you can omit this if using built-in fetch
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION = process.env.SESSION_COOKIE;

if (!SESSION) {
  console.error("❌ Missing SESSION_COOKIE in .env file.");
  process.exit(1);
}

app.use(cors());

// Route to fetch AoC input
app.get("/input/:year/:day", async (req, res) => {
  const { year, day } = req.params;
  const cachePath = path.resolve(`./cache/${year}/${day}/input.txt`);

  try {

    try {
        const cachedData = await fs.readFile(cachePath, "utf8");
        console.log(`Cache hit for ${year} day ${day}`);
        return res.type("text").send(cachedData.trim());
      } catch (err) {
        if (err.code !== "ENOENT") throw err; // Re-throw if error not "file not found"
        console.log(`Cache miss for ${year} day ${day}`);
      }

    const response = await fetch(`https://adventofcode.com/${year}/day/${day}/input`, {
      headers: {
        Cookie: `session=${SESSION}`,
        "User-Agent": "aoc-frontend-runner by your@email.com",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send(`Error: ${response.statusText}`);
    }

    const text = await response.text();

    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, text);

    res.type("text").send(text.trim());
  } catch (err) {
    console.error("❌ Error fetching input:", err);
    res.status(500).send("Server error");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
