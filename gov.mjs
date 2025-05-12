import puppeteer from 'puppeteer';
import path from "node:path"
import fs from "node:fs"

const USER_ACCOUNT = "";
const USER_PASSWORD = "";

const MAX_TOTAL_DOWNLOAD_COUNT = 999;

const targetId = "treeZhiBiao";

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
    });

    const sleep = async (delay) => new Promise((resolve) => { setTimeout(resolve, delay) });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 })
    const client = await page.createCDPSession();

    // login html success will auto navigtion
    await page.goto("https://data.stats.gov.cn/login.htm", { waitUntil: "load", timeout: 0 });

    await page.type('#username', USER_ACCOUNT);
    await page.type('#keyp', USER_PASSWORD);
    await page.waitForNavigation({ timeout: 0 })

    console.log("Login down, auto re-navigate")

    // as start point
    await page.goto("https://data.stats.gov.cn/easyquery.htm?cn=A01", { waitUntil: "networkidle0", timeout: 0 });
    await page.waitForSelector("#table_main", { timeout: 0 });
    await sleep(1000);

    const clickedSet = new Set();

    console.log("Start to auto click");
    while (true) {
        console.log("One round");

        const newClicked = await page.evaluate(async (clicked) => {
            const newClicked = [];

            const buttons = document.querySelectorAll('[id$="_ico"].ico_close');

            buttons.forEach(btn => {
                const id = btn.id;
                const alreadyClicked = clicked.includes(id);
                const isVisible = btn.offsetParent !== null;

                if (!alreadyClicked && isVisible) {
                    btn.click();
                    newClicked.push(id);
                }
            });

            await new Promise((resolve) => { setTimeout(resolve, 1000) });
            return newClicked;
        }, [...clickedSet]);

        if (newClicked.length === 0) {
            break;
        }

        newClicked.forEach(id => clickedSet.add(id));
    }
    console.log("These buttons have been clicked: ", clickedSet);

    let listTree;
    console.log("start to recursly query");
    // recursly query
    listTree = await page.evaluate((selector) => {
        const rootUl = document.querySelector(selector);

        const walk = (ul) => {
            const result = [];

            const liNodes = ul.querySelectorAll(':scope > li');

            liNodes.forEach(li => {
                const id = li.id || '';

                const spanId = id + '_span';
                const titleEl = document.getElementById(spanId);
                const title = titleEl ? titleEl.innerText.trim() : '';

                const childUlId = id + '_ul';
                const childUl = document.getElementById(childUlId);

                const buttonIcoId = id + '_ico';
                const hrefId = id + '_a';

                const node = {
                    id,
                    title,
                    children: childUl ? walk(childUl) : [],
                    buttonIcoId,
                    hrefId
                };

                result.push(node);
            });

            return result;
        };

        return walk(rootUl);
    }, `#${targetId}`);

    let currDownloaded = 0;

    const processNodeTree = async (node, pwd) => {
        if (currDownloaded >= MAX_TOTAL_DOWNLOAD_COUNT) return;
        if (!node) return;

        const newPwd = path.resolve(pwd, node.title);

        // This is directroy
        if (node.children && node.children.length > 0) {
            fs.mkdirSync(newPwd, { recursive: true });
            for (const child of node.children) {
                await processNodeTree(child, newPwd);
            }
        } else {
            currDownloaded++;
            await client.send("Page.setDownloadBehavior", {
                behavior: "allow",
                downloadPath: pwd
            })
            console.log("Files will saved to: ", pwd);
            await page.evaluate(async (node) => {
                // let the web load the curr node data
                const href = document.getElementById(node.hrefId);
                href.click()
                await new Promise((resolve) => { setTimeout(resolve, 100) }); // This is hacky

                console.log("Try to download file of ", node.title)
                window.download(true, "excel", "table_main");

                // Wait more time to avoid been detected and blocked
                await new Promise((resolve=>{setTimeout(resolve, 3000)}));
            }, node);

            const downloadTempFile = path.resolve(pwd, "月度数据.xls");
            const finalFileName = path.resolve(pwd, `${node.title}.xls`);

            fs.renameSync(downloadTempFile, finalFileName);
        }
    };
    await processNodeTree(listTree[0], path.resolve(path.dirname(".")));

    console.log("All tasks done");

})()
