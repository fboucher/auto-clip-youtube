/**
 * Simple Clip Generator - Create short clips from YouTube videos using Reka AI
 *
 * This script demonstrates how to use the Reka Clips API to generate
 * short video clips from YouTube videos.
 */

const readline = require("readline");

// API Configuration
const BASE_URL = "https://vision-agent.api.reka.ai/v1/clips";

/**
 * Get the API key from environment variable.
 */
function getApiKey() {
  const apiKey = process.env.REKA_API_KEY;
  if (!apiKey) {
    console.log("Error: REKA_API_KEY environment variable is not set.");
    console.log("Please set it with: export REKA_API_KEY=your_api_key");
    process.exit(1);
  }
  return apiKey;
}

/**
 * Read streaming events from the API response.
 * The API sends events as lines starting with 'data: ' followed by JSON.
 */
async function* streamEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastData = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          // Only yield if data changed (avoid duplicates)
          if (JSON.stringify(data) !== JSON.stringify(lastData)) {
            yield data;
          }
          lastData = data;
        } catch {
          // Ignore JSON parse errors
        }
      }
    }
  }
}

/**
 * Call the Reka API to create a clip from the video.
 * Streams the response and prints status updates.
 */
async function createClip(videoUrl, apiKey) {
  // Prepare the request
  const payload = {
    video_urls: [videoUrl],
    prompt: "Create an engaging video clip highlighting the best moments",
    generation_config: {
      template: "moments",
      num_generations: 1,
      min_duration_seconds: 0,
      max_duration_seconds: 30,
    },
    rendering_config: {
      subtitles: true,
      aspect_ratio: "9:16",
    },
    stream: true,
  };

  const headers = {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
  };

  console.log("\nStarting clip generation...");
  console.log("-".repeat(40));

  let jobIdShown = false;

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Process each event as it arrives
    for await (const event of streamEvents(response)) {
      // Show job ID as soon as available (important for recovery)
      if (!jobIdShown && event.id) {
        console.log(`Job ID: ${event.id}`);
        console.log("(Save this ID to retrieve results if interrupted)");
        console.log("-".repeat(40));
        jobIdShown = true;
      }

      const status = event.status || "unknown";
      console.log(`Status: ${status}`);

      // Show clip details when job is completed
      if (status === "completed" && event.output) {
        console.log("\n" + "=".repeat(40));
        console.log("  CLIP(S) READY!");
        console.log("=".repeat(40));
        event.output.forEach((clip, i) => {
          console.log(`\n--- Clip ${i + 1} ---`);
          console.log(`Title: ${clip.title || "N/A"}`);
          console.log(`URL: ${clip.video_url || "N/A"}`);
          console.log(`Caption: ${clip.caption || "N/A"}`);
          if (clip.hashtags && clip.hashtags.length > 0) {
            console.log(`Hashtags: ${clip.hashtags.join(" ")}`);
          }
        });
      }
    }
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      console.log(
        "Error: Could not connect to the API. Check your internet connection."
      );
    } else {
      console.log(`API Error: ${error.message}`);
    }
  }
}

/**
 * Prompt user for input.
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main function - entry point of the script.
 */
async function main() {
  console.log("=".repeat(40));
  console.log("  Reka Clip Generator");
  console.log("=".repeat(40));

  // Get API key
  const apiKey = getApiKey();

  // Ask user for the video URL
  const videoUrl = await prompt("\nEnter the YouTube video URL: ");

  if (!videoUrl) {
    console.log("Error: No URL provided.");
    process.exit(1);
  }

  // Create the clip
  await createClip(videoUrl, apiKey);

  console.log("-".repeat(40));
  console.log("Done!");
}

// This runs when you execute the script directly
main();
