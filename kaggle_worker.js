import puppeteer from "puppeteer";
import { performance } from "perf_hooks";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import {pathToFileURL} from "url";
import fs from "fs";

const argv = yargs(hideBin(process.argv))
  .option("file", {
    alias: "f",
    type: "string",
    demandOption: true,
    describe: "Input file path",
  })
  .option("save", {
    alias: "s",
    type: "boolean",
    default: false,
    describe: "Whether to save the result to disk",
  })
  .parse(); 

const filePath = path.resolve(argv.file);
const {default: urls} = await import(pathToFileURL(filePath).href);

const shouldSave = argv.save;

const concurrency = 8;
const BATCH_PAUSE_STEP = 10;
const BATCH_PAUSE_INTERVAL = 30 * 1000; // 30 秒

(async () => {
  const browser = await puppeteer.launch({});
  const start = performance.now();

  let completed = 0;
  const total = urls.length;

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
      if (!url.includes("kaggle.com"))
        throw new Error("URL does not contain 'kaggle.com'");
      await page.goto(url, { waitUntil: "load", timeout: 0 });
      await page.waitForSelector('span[aria-label="Download"]', { timeout: 0 });

      const nestedPText = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span[aria-label="Download"]'));
        for (const s of spans) {
          if (s.textContent.trim().toLowerCase() === "get_app") {
            try {
              const parentSpan = s.closest("div").closest("span");
              const fileNameH2 = parentSpan.previousElementSibling;
              return fileNameH2.textContent.trim();
            } catch (e) {}
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

  let results = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fetchLicense));
    results.push(...chunkResults);

    if (completed % (BATCH_PAUSE_STEP * concurrency) === 0 && completed < total) {
      console.log(`\n[Info] Completed ${completed} items. Waiting ${BATCH_PAUSE_INTERVAL / 1000}s to avoid rate limiting...`);
      await sleep(BATCH_PAUSE_INTERVAL);
    }
  }

  console.log();

  results = results.map(item => item.replace(/\(.*\)/, ""));

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
