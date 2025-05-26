import puppeteer from 'puppeteer';
const targetId = "treeZhiBiao";

const sleep = async (delay) => new Promise((resolve) => { setTimeout(resolve, delay) });
function getTitleBeforeBracket(title) {
    return title.split(/（|\(/)[0].trim();
}

function transformTable({tHead, tBody}) {
    const result = [];
    for (const row of tBody) {
        const rowData = {};
        row.forEach((cell, index) => {
            // skip first column
            if (index === 0) return;
            rowData[tHead[index]] = cell;
        });

        result.push({
            name: row[0],
            timeline: rowData 
        });
    }
    return result;
}

async function readTableData(page) {
    return transformTable(await page.evaluate(() => {
        const table = document.querySelector("#table_main");
        const thElements = table.querySelector("thead").querySelectorAll("th");

        const tHeadTexts = Array.from(thElements).map(th => {
            const strong = th.querySelector("strong");
            if (strong)
                return strong.innerText.trim();
            return th.innerText.trim() ? strong.innerText.trim() : '--';
        })

        const tRows = table.querySelector("tbody").querySelectorAll("tr");
        const tBodyData = Array.from(tRows).map(tr => {
            const tds = tr.querySelectorAll("td");
            const tdTexts = Array.from(tds).map(td => {
                return td.innerText.trim() ? td.innerText.trim() : '--';
            })
            return tdTexts;
        })

        return {
            tHead: tHeadTexts,
            tBody: tBodyData
        }
    }));
}

async function getListTree(page, selector) {
    return await page.evaluate((selector) => {
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
    }, selector);
}

async function expandSections(page) {
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
}

const getLeafNodes = (nodes) => {
    return nodes.flatMap(node => 
        node.children.length === 0 
            ? [node] 
            : getLeafNodes(node.children)
    );
};

async function clickItem(page,selector) {
    await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
            element.click();
        }
        else{
            console.warn(`Element with selector ${selector} not found.`);
        }
    }, selector);
}

const filterSamePrefix = (nodes, getPrefixFn) => {
    const prefixSet = new Set();
    return nodes.filter(node => {
        const prefix = getPrefixFn(node.title);
        if (prefixSet.has(prefix)) {
            return false;
        }
        prefixSet.add(prefix);
        return true;
    });
}

(async () => {
    const browser = await puppeteer.launch({
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 })

    await page.goto("https://data.stats.gov.cn/easyquery.htm?cn=A01", { waitUntil: "networkidle0", timeout: 0 });
    await page.waitForSelector("#table_main", { timeout: 0 });
    await sleep(1000);

    await expandSections(page);

    let listTree = await getListTree(page, `#${targetId}`);
    let leafNodes = getLeafNodes(listTree);

    let filteredLeafNodes = filterSamePrefix(leafNodes, getTitleBeforeBracket);

    console.log("Filtered leaf nodes: ", filteredLeafNodes);

    let tableDatas = [];
    let MAX_COUNT = 10;
    let count = 0;

    for (const node of filteredLeafNodes) {
        const hrefSelector = node.hrefId;
        await clickItem(page, `#${hrefSelector}`);
        await page.waitForNetworkIdle();
        tableDatas.push({
          group: node.title,
          data: await readTableData(page),
        });
        count++;
        if (count >= MAX_COUNT) {
            break;
        }
    }
    console.log("Table data collected: ", tableDatas);

})()
