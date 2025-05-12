# To Start

### Install the dependcies
run `npm install` at root directory, wait for command finish.

### change the config in the script
You can see some config in the `./gov.js`

``` js
const USER_ACCOUNT = "";
const USER_PASSWORD = "";

const MAX_TOTAL_DOWNLOAD_COUNT = 5;
```

change that for you want

### use node to run

1. check **node** have been installed on your machine, the recommonded version is `node 22`.

2. run `node ./gov.js`

3. you need manully enter the CAPTCHA every time you run the script

### Trouble fix

If some unexpected behavior happened in the browser, re run the script many and many times, there must have one success

The unexpected behavior includes the web looks werid, or the CAPTCHA works bad (The CAPTCHA in that web is **suck** and have **bug**).