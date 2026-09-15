const fs = require('node:fs');
const defaults = require('./defaults.js');

const readline = require('readline');

const utils = require('./helper_utils.js');

// Create an interface for input and output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

utils.checkFolders();

let _foundSaves = utils.getSaves();
let _savePath;

class SearchHandler {
    /**
     * Url for the search
     */
    _url;
    /**
     * Name of this search
     */
    _name;
    /**
     * Save path for the cached search object
     */
    _savePath;
    /**
     * Flag if an error occurred during loading process
     */
    _failure = false;
    /**
     * Id of this search
     */
    _id;
    /**
     * Current folder to save results into
     */
    _currentFolderToSaveInto = '';
    /**
     * Resumption token obtained from the search
     */
    _resumptionToken = '*';
    /**
     * Time when the search expires
     */
    _expires = '';

    /**
     * Constructor
     * @param {string} url Url to use for the search
     */
    constructor(url) {
        this._url = url;
        this._id = utils.getMainMemory().saveIndexIterator++;
    }
    /**
     * Give a name for this search
     * @param {string} name Descriptive name for this search
     */
    giveName(name) {
        this._name = name;
    }
    /**
     * Set the id for this search
     * @param {number} id Id of this search
     */
    setId(id) {
        this._id = +id;
    }
    /**
     * Set the resumption token.
     * @param {string} token New resumption token
     */
    setResumptionToken(token) {
        this._resumptionToken = token;
    }
    /**
     * Save this search into the cache folder to be continued later
     */
    save() {
        const newSaveName = `${this._id}.json`;
        _savePath = `${utils.cacheDir}/${newSaveName}`;
        fs.writeFileSync(_savePath, JSON.stringify(
            {
                _page: this._page,
                _url: this._url,
                _id: this._id,
                _resumptionToken: this._resumptionToken,
                _expires: this._expires,
                _name: this._name
            }
        ));
    }
    /**
     * Main loop 
     */
    async loadLoop() {
        utils.getMainMemory().lastLoadIndex = this._id;
        utils.saveMainMemory();
        while (typeof this._resumptionToken !== 'undefined') {
            this.save();
            for (let attempt = 1; attempt <= defaults.maxAttemptsForFetch; attempt++) {
                try {
                    await this.loadPage();
                    break;
                } catch(e) {
                    console.log(`Error occurred: Attempt ${attempt} / 10. ${e}`);
                    if (attempt >= defaults.maxAttemptsForFetch) {
                        throw new Error('Can not continue. Throwing error.');
                    }
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }
            }
            
            if (this._failure) {
                throw new Error('Failure occured and shortcut set');
            }
        }
        console.log('Load complete');
    }
    /**
     * Load a single page using a resumption token.
     * @returns {Promise} fetch as a promise
     */
    async loadPage() {
        // Wait for 1 second between requests to avoid being rate limited
        const wait = await new Promise(resolve => setTimeout(resolve, 1000));
        let url = this._url;
        console.time('Loaded in');
        switch (this._resumptionToken)
        {
            case '*':
                const params = new URLSearchParams(defaults.recordFields.map(e => ['field[]', e])); 
                params.append('resumptionToken', '*');
                url += '&' + params.toString();
                break;
            case undefined:
                throw new Error('Unexpected error occurred.');
            default:
                url = `${defaults.viewBaseUrl}api/v1/search?resumptionToken=${this._resumptionToken}`;
                break;
        }
        const headers = new Headers(defaults.headers);
        return await fetch(url, {headers, method: 'GET'}).then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Error occurred during fetch');
        }).then(data => {
            if (data.records) {
                data.records.forEach(record => {
                    const recordID = record.id;
                    const recordIDSplitted = recordID.split('.', 2);
                    let subFolderName = 'unknown';
                    if (recordIDSplitted.length > 1) {
                        subFolderName = recordIDSplitted[0];
                    }
                    const subFolderPath = `${utils.recordsDir}/${subFolderName}`;
                    if (!fs.existsSync(subFolderPath)){
                        fs.mkdirSync(subFolderPath);
                    }
                    this._currentFolderToSaveInto = utils.getFolder(subFolderPath, this._currentFolderToSaveInto);

                    const fileName = `${encodeURIComponent(record.id)}.json`;

                    const filePath = `${this._currentFolderToSaveInto}/${fileName}`;
                    if (fs.existsSync(filePath)) {
                        return;
                    }
                    const finalFile = {
                        'record': record,
                        'datasource': subFolderName,
                        'loaded': false,
                    };
                    fs.writeFileSync(filePath, JSON.stringify(finalFile));
                });
            }
            if (data.resumptionToken) {
                this._resumptionToken = data.resumptionToken.token;
                this._expires = data.resumptionToken.expires;
                // Save resumption token to cache and continue from that
            } else {
                this._resumptionToken = undefined;
            }
            if (defaults.verbose) {
                console.log(data);
            }
            console.timeEnd('Loaded in');
        }).catch(err => {
            // Do something for an error here
            this._failure = true;
            console.log(err);
        });
    }
}

const saves = utils.getSaves();

console.log('Select action you would like to perform:\n');
console.log('(1) Enter new url to start loading results.\n');
if (Object.keys(saves).length !== 0) {
    console.log('(2) Continue search from a specific save file.\n');
} else if (utils.getMainMemory().saveIndexIterator !== 0) {
    utils.resetMainMemory();
}
if (utils.getMainMemory().lastLoadIndex > -1) {
    console.log(utils.getMainMemory().lastLoadIndex);
    console.log(`(3) Continue previously used search: ${_foundSaves[utils.getMainMemory().lastLoadIndex]._name}`);
}

let searchObject;

rl.question('Select option to perform with number:\n', num => {
    if (num === '1') {
        rl.question('Give url to download:\n', url => {
            rl.question('Give descriptive name for this search:\n', (answer) => {
                searchObject = new SearchHandler(url);
                searchObject.giveName(answer);
                startLoadProcess();
            });
        });
    } else if (num === '2') {
        console.log('Previous saved searches found:');
        for (const [key, value] of Object.entries(_foundSaves)) {
            console.log(`${key}: ${value._name}`);
        }
        rl.question('Give number of the file:\n', answer => {
            let search = _foundSaves[answer];
            handleSearchAssignment(search);
        });
    } else if (num === '3') {
        let search = _foundSaves[utils.getMainMemory().lastLoadIndex];
        handleSearchAssignment(search);
    } else {
        console.log('no reasonable input found. Exiting...');
        rl.close();
    }
});

/**
 * Handle search with given search object
 * @param {object} search Search object containing url, resumptionToken, name, id
 */
function handleSearchAssignment(search) {
    searchObject = new SearchHandler(search._url);
    searchObject.setId(search._id);
    searchObject.setResumptionToken(search._resumptionToken);
    searchObject.giveName(search._name);
    startLoadProcess();
    rl.close();
}

/**
 * Starts the main loop for loading the results
 */
async function startLoadProcess() {
    const loopWait = await searchObject.loadLoop();
    rl.close();
}
