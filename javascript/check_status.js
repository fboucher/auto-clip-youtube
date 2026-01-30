/**
 * Check Status - Check the status of a Reka clip generation job
 *
 * This script polls the Reka API every 30 seconds to check if your
 * clip is ready, then displays the results.
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
 * Check the status of a clip generation job.
 */
async function checkJobStatus(jobId, apiKey) {
  const url = `${BASE_URL}/${jobId}`;
  const headers = { "X-Api-Key": apiKey };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Display the clip results when job is completed.
 */
function displayResults(data) {
  console.log("\n" + "=".repeat(40));
  console.log("  CLIP(S) READY!");
  console.log("=".repeat(40));

  const output = data.output || [];
  if (output.length === 0) {
    console.log("No clips in output.");
    return;
  }

  output.forEach((clip, i) => {
    console.log(`\n--- Clip ${i + 1} ---`);
    console.log(`Title: ${clip.title || "N/A"}`);
    console.log(`URL: ${clip.video_url || "N/A"}`);
    console.log(`Caption: ${clip.caption || "N/A"}`);
    if (clip.hashtags && clip.hashtags.length > 0) {
      console.log(`Hashtags: ${clip.hashtags.join(" ")}`);
    }
  });
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  console.log("  Reka Job Status Checker");
  console.log("=".repeat(40));

  // Get API key
  const apiKey = getApiKey();

  // Ask user for the job ID
  const jobId = await prompt("\nEnter the Job ID: ");

  if (!jobId) {
    console.log("Error: No Job ID provided.");
    process.exit(1);
  }

  console.log("\n" + "-".repeat(40));
  console.log("Press Ctrl+C to stop checking");
  console.log("-".repeat(40));

  let checkCount = 0;
  let running = true;

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n\nStopped by user.");
    running = false;
  });

  while (running) {
    checkCount++;
    console.log(`\nCheck #${checkCount} - Fetching status...`);

    try {
      const data = await checkJobStatus(jobId, apiKey);
      const status = data.status || "unknown";
      console.log(`Status: ${status}`);

      if (status === "completed") {
        displayResults(data);
        break;
      } else if (status === "failed") {
        const error = data.error_message || "Unknown error";
        console.log(`Job failed: ${error}`);
        break;
      } else {
        console.log("Waiting 30 seconds before next check...");
        await sleep(30000);
      }
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        console.log("Connection error. Retrying in 30 seconds...");
        await sleep(30000);
      } else {
        console.log(`API Error: ${error.message}`);
        break;
      }
    }
  }

  console.log("-".repeat(40));
  console.log("Done!");
}

// This runs when you execute the script directly
main();
