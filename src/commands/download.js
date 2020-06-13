const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const command = 'download [url]'
const desc = 'Download all files for repo at url [url]'
const builder = {
    url: {
        alias: 'u',
        default: ''
    },
    outputMainDir: {
        alias: 'o',
        default: './output'
    }
}
const handler = function (argv) {
    
    let { url, outputMainDir } = argv;

    if(!url){
        console.log('Empty url passed')
    }

    if(!fs.existsSync(outputMainDir)){
        fs.mkdirSync(outputMainDir);
    }

    let pasteDownloader = new DownloadPastes([url], outputMainDir);

    pasteDownloader.download();
}

const FILE_BLANK_RETURNS = `\n\n\n\n\n`;
const SLEEP_TIME = 5000;

/**
 * slugify - just a helper function to make the filname safe
 * @param {string} str - filename to be sanitized/made safe for the filesystem
 * @param {boolean} allowUnicode - boolean
 */
function slugify(str, allowUnicode){
    let retStr = "";
    if (allowUnicode){
        retStr = str.normalize('NFKC');
    } else {
        retStr = Buffer.from(str.normalize("NFKD"), 'ascii').toString('ascii');
    }

    retStr = retStr.replace(/[^\w\s-\/\\\*\(\)]/g, '').trim().replace(/[\/\*\\\(\)]+/g, '_');

    return retStr;
}

/**
 * sleep - wrapped function to do a synchronous wait
 */
function sleep() {
    return new Promise((resolve) => {
      setTimeout(resolve, SLEEP_TIME);
    });
}

/**
 * writeToFilePromise - helper function wrapping a file write in a promise to ensure synchronous actions
 * @param {*} filename - name of file to create, string was run through the above slugify to get relative safe filenames
 * @param {*} dirPath - path of where to write the file
 * @param {*} data - an array of data, has 3 items:  header with meta info about the paste, breaking spaces, the actual paste
 */
function writeToFilePromise(filename, dirPath, data){
    // from https://stackoverflow.com/questions/39880832/how-to-return-a-promise-when-writestream-finishes
    // basically want to wrap the file write into a promise to do the async/await to ensure synchronous file writes
    return new Promise((resolve, reject) => {

        let fileDest = `${dirPath}/${filename}.txt`;

        // if the file exists, create another file with the relative same name but appending the current timestamp
        // as a unix timestamp to the filename
        if(fs.existsSync(fileDest)){
            fileDest = `${dirPath}/${filename}_${Date.now().valueOf()}.txt`
        }

        const fStream = fs.createWriteStream(fileDest, {
            flags: 'a' // 'a' means appending (old data will be preserved)
        });
        for (const row of data) {
            fStream.write(row);
          }
        fStream.end();
        fStream.on("finish", () => {
            console.log(`downloaded file ${filename}.txt at ${new Date().toUTCString()}`);
            return resolve(true);
        });
        fStream.on("error", e => {reject(e)}); // don't forget this!
    });
}

class DownloadPastes {
    /**
     * constructor - main setup for this class
     * @param {string[]} urlList - list of pastebins we want to save
     * @param {string} outputMainDir - what directory we should save the files to
     */
    constructor(urlList, outputMainDir){
        this.urlList = urlList;
        this.outputMainDir = outputMainDir;
        this.parsePage = this.parsePage.bind(this);
        this.pageLoadLoop = this.pageLoadLoop.bind(this);
        this.downloadPastebin = this.downloadPastebin.bind(this);
        this.downloadFiles = this.downloadFiles.bind(this);
    }

    /**
     * pageLoadLoop - just loops through to load each page and store each page's list of unique pastes in an array
     * @param {integer} startPage - starting page number, should just be 2
     * @param {string} url - Base author's pastebin url
     */
    async pageLoadLoop(startPage, url){
        let currentPage = startPage;
        this.currentPage = currentPage;
        let allLinks = [];

        // TODO: fix this non-ideal loop
        while(true){
            let pageData
            try {
                pageData = await axios.get(`${url}/${currentPage}`);
            } catch (e) {
                console.log(`error trying to load page ${url}/${currentPage}, message: ${e.message}`)
            }
            
            const $ = cheerio.load(pageData.data);

            // return the list we've built once we see a notice, which should denote that the page doesn't exist
            if($("#notice").length === 1){
                return allLinks;
            } else {
                allLinks = allLinks.concat(this.parsePage(pageData.data));
            }

            currentPage++;
            // private class current page value is used for debugging/troubleshooting
            this.currentPage = currentPage;
        }
    }

    /**
     * parsePage - Parses the html of an author's page and returns back a list of public paste keys
     * @param {string} pageData - the Axios returned data from the author's page, should be the page HTML
     */
    parsePage(pageData){
        const $ = cheerio.load(pageData);
        let links = []

        // Function to loop through all the rows in the main table to get the links to each public paste
        // and store it to a list
        $('.maintable').find('tr:not(:first-child)').each((i, elem) => {
            let anchor = $(elem).find('td:first-child').find('a');
            let href = anchor.attr('href');
            links.push(href);
        })

        return links;
    }

    /**
     * downloadFiles - simple enough, we loop thorugh the pasteUrls to save the pastes
     * @param {string} originUrl - author/creator's pastebin from where we got the pastes
     * @param {string[]} pasteUrls - list of paste urls in the form of something like "/paUWkbTm"
     */
    async downloadFiles(originUrl, pasteUrls){
        let urlSplit = originUrl? originUrl.split('/') : [];
        let author = urlSplit.length ? urlSplit[urlSplit.length -1 ] : '';
        let count = 0;

        //create directory
        let dirPath = `${this.outputMainDir}/${author}`;

        if(!fs.existsSync(dirPath)){
            fs.mkdirSync(dirPath);
        }

        for(const pasteUrl of pasteUrls){
            this.downloadSinglePaste(dirPath, pasteUrl)
                .catch(e => {
                    console.log(`error trying to load paste ${pasteUrl}, message: ${e.message}`)
                });
            // sleep for 5 seconds to try to avoid any rate limiting, should result in an
            // average of 12 files/min.  Yeah, it's slow but should work.
            try{
                await sleep();
            } catch (e) {
                console.log(`Somehow errored on sleeping for file ${pasteUrl}`);
            }
            
            count++;
        }

        console.log(`There were ${count} files downloaded in this run`)
    }

    /**
     * downloadSinglePaste - like the name says, downloads a single paste and writes the file out to the 
     *                       specified dirPath
     * @param {string} dirPath - directory path to write the file to
     * @param {string} pasteUrl - just the pastebin unique paste value, eg '/paUWkbTm'
     */
    async downloadSinglePaste(dirPath, pasteUrl){
        let url = `https://pastebin.com${pasteUrl}`;
        let pageData;
        try {
          pageData = await axios.get(url)
        } catch(e){
            console.log(`Error loading paste file ${fullPasteURL}, message: ${e.message}`)
        };

        console.log(`downloading: ${url}`);
        const $ = cheerio.load(pageData.data);

        let name = $('div.paste_box_line1').text()
        let filename = slugify(name);

        let info = $('div.paste_box_line2');
        let srcAnchor = info.find('a').first();
        let author, authorUrl, dateEdit
        if(srcAnchor.length === 0){
            author = "Unknown";
            authorUrl = "Unknown";
            dateEdit = info.find('span').last();
        } else {
            author = srcAnchor.text()
            authorUrl = "https://pastebin.com" + srcAnchor.attr('href');

            let lastDateSpan = info.find('span').last();
            let title = lastDateSpan.attr('title');
            if(title.includes('Last edit on: ')){
                dateEdit = title.replace("Last edit on: ", "")
            } else {
                dateEdit = title;
            }
        }

        let currentDate = new Date();
        let fullPasteURL = `http://pastebin.com/raw${pasteUrl}`;
        let rawData;
        try{
            rawData = await axios.get(fullPasteURL)
        } catch(e){
            console.log(`Error loading raw file ${fullPasteURL}, message: ${e.message}`)
        };
        let headerInfo = `"${name}"\nBy: ${author}\n${authorUrl}\n${fullPasteURL}\n\nLast Edit: ${dateEdit}\nRetrieved: ${currentDate.toUTCString()}`;
        try{
            await writeToFilePromise(filename, dirPath, [headerInfo, FILE_BLANK_RETURNS, rawData.data])
        } catch(e){
            console.log(`Error writing file ${filename}, message: ${e.message}`)
        };
    }

    /**
     * downloadPastebin - this loads the first page of the author's pastebin, checks to see if we should loop through
     *                    and then fetches all the public pastes
     * @param {string} url - url of author/creator we want to save the pastes from
     */
    async downloadPastebin(url){
        let pageData
        try{
            pageData = await axios.get(url);
        } catch(e){
            console.log(`Error loading pastebin ${url}, message: ${e.message}`)
        };

        const $ = cheerio.load(pageData.data);
        
        // look for the pagination control, this will determin if we should loop until we hit the end or not
        let pasteUrls = [];
        if($(".pagination").length === 0){
            //
            pasteUrls = this.parsePage(pageData.data);
        } else {
            pasteUrls = this.parsePage(pageData.data);
            let returnedList
            try {
                returnedList = await this.pageLoadLoop(2, url)
            } catch(e) {
                console.log(`Error parsing data on page ${this.currentPage}, message: ${e.message}`)
            };
            pasteUrls = pasteUrls.concat(returnedList);
        }

        this.downloadFiles(url, pasteUrls);
    }

    /**
     * download - main function to kick off the whole process
     */
    download(){

        // TODO: in the future, add functionality to read in a list of different urls to read from
        for(const url of this.urlList){
            this.downloadPastebin(url)
                .catch((e) => {
                    console.log(`errored downloading pastebin ${url}, error: ${e.message}`);
                })
        }

        // for testing purposes
        // let dirPath = `./output/shukaku20`;

        // if(!fs.existsSync(dirPath)){
        //     fs.mkdirSync(dirPath);
        // }
        // this.downloadSinglePaste(dirPath, '/paUWkbTm');
    }
}

// see yarg docs for exporting commands from files
// https://github.com/yargs/yargs/blob/master/docs/advanced.md#providing-a-command-module
module.exports = { command, desc, builder, handler }