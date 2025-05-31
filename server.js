
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

//redis object
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
      const articles = $("article").map((_, el) => $(el).html()).get().join("<hr />");
      await redis.set(cacheKey, articles);
      res.type("html").send(articles);
      
    } catch (err) {
      console.error("❌ Error fetching input:", err);
      res.status(500).send("Server error");
    }
});

// Route to refresh AoC problem description
app.get("/description/refresh/:year/:day", async (req, res) => {
    const { year, day } = req.params;
    const cacheKey = `aocDescription:${year}:${day}`
  
    try {
  
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
      const articles = $("article").map((_, el) => $(el).html()).get().join("<hr />");
      await redis.set(cacheKey, articles);
      res.type("html").send(articles);
      
    } catch (err) {
      console.error("❌ Error fetching input:", err);
      res.status(500).send("Server error");
    }
});

//gets all the stars per year
app.get("/stars", async (req, res) => {
  const cacheKey = `aocStars:allYears`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("✅ Cached stars from /events");
      console.log("Type of cached:", typeof cached);
      console.log("Cached content:", cached);
      return res.json(cached);
    }

    const response = await fetch("https://adventofcode.com/events", {
      headers: {
        Cookie: `session=${SESSION}`,
        "User-Agent": "aoc-frontend-runner by you@example.com",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send("Error fetching events page");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    console.log($.html()); // see what cheerio actually parsed


    const results = [];

    $("div.eventlist-event").each((_, el) => {
      const yearText = $(el).find("a").text(); // e.g., "[2023]"
      const starsText = $(el).find("span.star-count").text(); // e.g., "★ 42"

      const year = parseInt(yearText.match(/\d+/)[0], 10);
      const stars = parseInt(starsText.match(/\d+/)?.[0] || "0", 10);

      results.push({ year, stars });
    });

    await redis.set(cacheKey, JSON.stringify(results));

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching events:", err.stack || err);
    res.status(500).send("Error fetching events");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
