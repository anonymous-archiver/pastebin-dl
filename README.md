# pastebin-dl

# Overview
This just a quick 1-2 day project to write something that will be able to download the public pastes given a user's pastebin url.  None of this is unit tested, just ran through a few pastebins to see what I can do.  Also note that there is a default timeout of 5 seconds in between file downloads.  As I'm not paying for a pastebin pro account, I'm doing things such that I don't get IP banned/rate limited.  Yes, the downloads are synchronous and not async.  Yes, it's not ideal but hey, what else do you want?

# Files
index.js: main entry point
src/commands/list.js: quick command to list out the public pastes
src/commands/download.js: command that will find the public pastes and download them to an output directory
package.json: the includes/dependencies
README.MD

# Languages/Tools used
nodeJS

# How to install
- make sure you have nodejs installed https://nodejs.org/en/download/
- go to the directory that contains the package.json file and run `npm install`
    - this should download all the dependencies needed to run this project

# Running the program
- in a command line terminal, navigate to the directory containing the index.js file
- run the command node index.js [command] -u [url] or `npm run start [command] -u [url]`
- eg `node index.js list -u https://pastebin.com/u/someones_pastebin` or `npm run start download -u https://pastebin.com/u/someones_pastebin`
    - you can specify an output directory, but if not specified, it'll just default to "output"
    - each user's pastebin you specify will have a subdirectory created in the output directory
    - files with the same title will have the current time as a unix timestamp appended to the name to delineate different files

# License
ISC License (ISC)
Copyright 2020

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
