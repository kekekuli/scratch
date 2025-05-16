import puppeteer from "puppeteer";
import { performance } from "perf_hooks";
import fs from "fs";
import urls from "./kaggleURL.js";

const shouldSave = process.argv.includes("--save");
const filterURL = urls.filter((url) => url.includes("kaggle.com"));

const concurrency = 8;
const BATCH_PAUSE_STEP = 10;
const BATCH_PAUSE_INTERVAL = 30 * 1000; // 等待30秒

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const start = performance.now();

  let completed = 0;
  const total = filterURL.length;

  function printProgress(completed, total) {
    const percent = ((completed / total) * 100).toFixed(1);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`Progress: ${completed}/${total} (${percent}%)`);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchLicense(url) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "load", timeout: 0 });
      await page.waitForSelector("h2", { timeout: 0 });

      const nestedPText = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h2"));
        for (const h of headings) {
          if (h.textContent.trim().toLowerCase() === "license") {
            const sibling = h.nextElementSibling;
            if (sibling) {
              return sibling.children[0]
                ? sibling.children[0].innerText.trim()
                : sibling.innerText.trim();
            }
          }
        }
        return "Unknown";
      });

      return nestedPText;
    } catch (e) {
      console.error(`\nError fetching ${url}:`, e.message);
      return "Error";
    } finally {
      await page.close();
      completed++;
      printProgress(completed, total);
    }
  }

  const results = [];

  for (let i = 0; i < filterURL.length; i += concurrency) {
    const chunk = filterURL.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fetchLicense));
    results.push(...chunkResults);

    if (completed % BATCH_PAUSE_STEP * concurrency === 0 && completed < total) {
      console.log(`\n[Info] Completed ${completed} items. Waiting ${BATCH_PAUSE_INTERVAL / 1000}s to avoid rate limiting...`);
      await sleep(BATCH_PAUSE_INTERVAL);
    }
  }

  console.log(); 
  if (shouldSave) {
    fs.writeFileSync("license-results.json", JSON.stringify(results, null, 2));
    console.log("Results saved to license-results.json");
  } else {
    console.log("Results:", results);
  }

  const end = performance.now();
  console.log(`Execution time: ${((end - start) / 1000).toFixed(2)} seconds`);

  await browser.close();
})();
