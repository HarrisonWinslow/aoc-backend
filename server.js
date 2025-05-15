
import fs from "fs/promises";
import path from 'path';
import * as cheerio from 'cheerio';
import express from 'express';
import fetch from 'node-fetch'; // you can omit this if using built-in fetch
import dotenv from 'dotenv';
import cors from 'cors';
import { Redis } from "@upstash/redis";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION = process.env.SESSION_COOKIE;

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

if (!SESSION) {
  console.error("❌ Missing SESSION_COOKIE in .env file.");
  process.exit(1);
}

app.use(cors());

// Route to fetch AoC input
app.get("/input/:year/:day", async (req, res) => {
  const { year, day } = req.params;
  const cacheKey = `aocInput:${year}:${day}`

  try {

    // Try Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("✅ Redis cache hit");
      return res.type("text").send(cached);
    }
    else {
        console.log("Redis cache miss");
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

    await redis.set(cacheKey, text);

    res.type("text").send(text.trim());
  } catch (err) {
    console.error("❌ Error fetching input:", err);
    res.status(500).send("Server error");
  }
});

// Route to fetch AoC problem description
app.get("/description/:year/:day", async (req, res) => {
    const { year, day } = req.params;
    const cacheKey = `aocDescription:${year}:${day}`
  
    try {
  
      // Try Redis cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log("✅ Redis cache hit");
        return res.type("text").send(cached);
      }
      else {
          console.log("Redis cache miss");
      }
  
      const response = await fetch(`https://adventofcode.com/${year}/day/${day}`, {
        headers: {
          Cookie: `session=${SESSION}`,
          "User-Agent": "aoc-frontend-runner by your@email.com",
        },
      });
  
      if (!response.ok) {
        return res.status(response.status).send(`Error: ${response.statusText}`);
      }
  
      const html = await response.text();
      const $ = cheerio.load(html);

      // AoC wraps puzzle text in <article> tags
      const articleHtml = $("article").first().html();
      await redis.set(cacheKey, articleHtml);

      res.type("html").send(articleHtml);
    } catch (err) {
      console.error("❌ Error fetching input:", err);
      res.status(500).send("Server error");
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
