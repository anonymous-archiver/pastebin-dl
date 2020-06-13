const axios = require('axios');
const cheerio = require('cheerio');

const command = 'list [url]';
const desc = 'Lists all files for repo at url <url>';
const builder = { 
    url: {
        alias: 'u',
        default: ''
    }
};

const handler = function (argv) {
    let { url } = argv;

    if(!url){
        console.log('Empty url passed');
        return;
    }
    let pasteLister = new ListPastes([url]);

    pasteLister.list()
        .catch(e => {
            console.log(`Errored loading url ${url}; message: ${e.message}`)
        });
}

class ListPastes {
    constructor(urlList){
        this.urlList = urlList;
        this.parsePage = this.parsePage.bind(this);
        this.pageLoadLoop = this.pageLoadLoop.bind(this);
        this.currentPage
    }

    /**
     * pageLoadLoop - loops through page 2 onwards to get and list out what pastes are public
     * @param {int} startPage - integer page to start at, should always start at 2 since we first pulled page 1
     * @param {string} url - url of the artist/creator/user we want to list pastes from
     */
    async pageLoadLoop(startPage, url){
        let currentPage = startPage;
        this.currentPage = currentPage;

        while(true){
            let pageData;
            try {
                pageData = await axios.get(`${url}/${currentPage}`);
            } catch (e) {
                console.log(`Error looping page ${url}/${currentPage}, message: ${e.message}`)
            }
            
            const $ = cheerio.load(pageData.data);

            if($("#notice").length === 1){
                return;
            } else {
                this.parsePage(pageData.data);
            }

            currentPage++;
            this.currentPage = currentPage;
        }
    }

    /**
     * parsePage - parse the page to get the information of the pastes/paste keys
     * @param {string} pageData  - returned text data from Axios' get call, should be the page HTML
     */
    parsePage(pageData){
        const $ = cheerio.load(pageData);

        $('.maintable').find('tr:not(:first-child)').each((i, elem) => {
            let anchor = $(elem).find('td:first-child').find('a');
            console.log(`${anchor.text()} - ${anchor.attr('href')}`);
        })
    }

    /**
     * list - loads the author/creator's first page, checks to see if we 
     *        should loop and lists out all the public pastes for this user
     */
    async list(){

        for(const url of this.urlList){
            let urlSplit = url? url.split('/') : [];
            let userName = urlSplit.length ? urlSplit[urlSplit.length -1 ] : '';
            console.log(`${userName}'s pastebin listings:`);

            let pageData;
            try {
                pageData = await axios.get(url);
            } catch(e){
                console.log(`Error loading user's pastebin ${url}, message: ${e.message}`);
            };

            const $ = cheerio.load(pageData.data);
            
                if($(".pagination").length === 0){
                    //
                    this.parsePage(pageData.data);
                } else {
                    this.parsePage(pageData.data);
                    this.pageLoadLoop(2, url).catch(e => {
                        console.log(`loop err on ${this.currentPage}`)
                    })
                }

            // given how the dom is structured, we have to look for the main list and parse the following data

            // look for the pagination
            
        }
        
    }
}

// see yarg docs for exporting commands from files
// https://github.com/yargs/yargs/blob/master/docs/advanced.md#providing-a-command-module
module.exports = { command, desc, builder, handler };
