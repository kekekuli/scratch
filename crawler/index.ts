import puppeteer, { Page } from 'puppeteer';
import cliProgress from 'cli-progress';

const targetId = "treeZhiBiao";

const sleep = async (delay:number) => new Promise((resolve) => { setTimeout(resolve, delay) });



async function uploadAll(tableDatas: IndicatorGroup[]) {
    let total = 0;
    tableDatas.forEach(group => {
        group.data.forEach(item => {
            total += Object.keys(item.timeline).length;
        });
    });

    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar.start(total, 0);

    let count = 0;
   for (const group of tableDatas) {
        for (const item of group.data) {
            const indicator = item.name;
            for (const [date, value] of Object.entries(item.timeline)) {
                // Format date like "2024年5月" to "2024-05"
                const match = date.match(/^(\d{4})年(\d{1,2})月$/);
                const formattedDate = match ? `${match[1]}-${match[2].padStart(2, "0")}` : date;

                try {
                    await fetch("http://localhost:5000/addRecord", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            indicator,
                            date: formattedDate,
                            value: Number(value)
                        })
                    });
                } catch (err) {
                    console.error(`Upload error: ${indicator} ${formattedDate} ${value}`, err);
                }
                count++;
                bar.update(count);
            }
        }
    }
    bar.stop();
    console.log("All data uploaded successfully.");
}

function getTitleBeforeBracket(title:string) {
    return title.split(/（|\(/)[0].trim();
}

function transformTable({tHead, tBody} : RawTable): NamedTimeline[] {
    const result: NamedTimeline[] = [];
    for (const row of tBody) {
        const rowData: { [key: string]: any } = {};
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

async function readTableData(page : Page): Promise<NamedTimeline[]> {
    return transformTable(await page.evaluate(() => {
        const table = document.querySelector("#table_main");
        if (!table) {
            console.warn("Table with id 'table_main' not found.");
            return { tHead: [], tBody: [] };
        }
        const thElements = table.querySelector("thead")?.querySelectorAll("th");
        if (!thElements) {
            console.warn("Table header not found.");
            return { tHead: [], tBody: [] };
        }

        const tHeadTexts = Array.from(thElements).map((th) => {
          const strong = th.querySelector("strong");
          if (strong !== null) return strong.innerText.trim();
          return th.innerText.trim() ? th.innerText.trim() : "--";
        });

        const tRows = table.querySelector("tbody")?.querySelectorAll("tr");
        if (!tRows) {
            console.warn("Table body not found.");
            return { tHead: tHeadTexts, tBody: [] };
        }

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

async function getListTree(page: Page, selector: Selector) {
    return await page.evaluate((selector) => {
        const rootUl = document.querySelector(selector);

        const walk = (ul: Element) => {
            const result: TreeNode[] = [];

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

                const node: TreeNode = {
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
        if (!rootUl) {
            console.warn(`Element with selector ${selector} not found.`);
            return [];
        }   

        return walk(rootUl);
    }, selector);
}

async function expandSections(page: Page) {
    const clickedSet = new Set();

    console.log("Start to auto click");
    while (true) {
        console.log("One round");

        const newClicked = await page.evaluate(async (clicked) => {
            const newClicked: string[] = [];

            const buttons = document.querySelectorAll('[id$="_ico"].ico_close') as NodeListOf<HTMLElement>;

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

const getLeafNodes = (entireTree: TreeNode[]): TreeNode[] => {
  return entireTree.flatMap((node) =>
    node.children.length === 0 ? [node] : getLeafNodes(node.children)
  );
};

async function clickItem(page:Page,selector:Selector) {
    await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
            element.click();
        }
        else{
            console.warn(`Element with selector ${selector} not found.`);
        }
    }, selector);
}

const filterSamePrefix = (nodes: TreeNode[], getPrefixFn: (title: string) => string) => {
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
    console.log("Start to crawl data from https://data.stats.gov.cn/easyquery.htm?cn=A01");

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

    let tableDatas:IndicatorGroup[] = [];
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

    await uploadAll(tableDatas);
    await browser.close();
})()
