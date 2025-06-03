const fs = require('node:fs');
const utils = require('./helper_utils.js');
const readline = require('readline');
const defaults = require('./defaults.js');
const {writeFile} = require('fs/promises');

// Create an interface for input and output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

utils.checkFolders();
const datasources = [];
// Find all plausible datasources to load images from
fs.readdirSync(utils.recordsDir).forEach(dir => {datasources.push(dir)});
let question = `'Start downloading images from a datasource. \n(Available datasources) \n`;
let dsi = 0;
datasources.forEach(d => {question += `[${dsi++}] - ${d}\n`});
question += `Give number of the datasource to download images from: \n`;
rl.question(question, number => {
    rl.close();
    const selected = Number.parseInt(number);
    loadImages(datasources[selected]);

});

const imagesPerDirectory = 100;

let imagesLoaded = 0;

/**
 * Queue images for a datasource
 * @param {string} datasource Datasource to load images from
 * @returns {Array}
 */
function getImagesToQueue(datasource) {
    let currentImages = 0;
    let imagesQueue = [];
    const subFolderPath = `${utils.recordsDir}/${datasource}`;
    let finalImagePath = '';
    utils.getDirs(subFolderPath).forEach(dir => {
        if (currentImages > imagesPerDirectory) {
            return;
        }
        const currentFolderPath = `${subFolderPath}/${dir}`;
        fs.readdirSync(currentFolderPath).forEach(record => {
            if (currentImages > imagesPerDirectory) {
                return;
            }
            if (!record.startsWith(datasource)) {
                return;
            }
            const fullPathForRecord = `${subFolderPath}/${dir}/${record}`;
            const loadedRecord = fs.readFileSync(fullPathForRecord);
            let recordJSON = JSON.parse(loadedRecord);
            if (recordJSON.loaded) { return; }
            if (!recordJSON.record.images) {
                recordJSON.loaded = true;
                fs.writeFileSync(fullPathForRecord, JSON.stringify(recordJSON));
                return;
            }
            
            let i = 0;
            let amountOfImages = recordJSON.record.images.length;
            const imageSubPath = `${utils.imagesDir}/${recordJSON.datasource}`;
            if (!fs.existsSync(imageSubPath)) {
                fs.mkdirSync(imageSubPath);
            }
            console.log(imageSubPath);
            recordJSON.record.images.forEach(img => {
                const curImg = {
                    url: `${defaults.viewBaseUrl}Cover/Pipe?id=${recordJSON.record.id}&index=${i}&size=large`,
                    subPath: `${imageSubPath}`,
                    name: `${recordJSON.record.id}-${i++}.jpg`,
                    record: fullPathForRecord,
                    isLastImage: i >= amountOfImages
                };
                imagesQueue.push(curImg);
                currentImages++;
            });
        });
    });
    return imagesQueue;
}

let totalImages = 0;
let totalImagesLoaded = 0;

/**
 * Calculate all and downloaded images counts
 * @param {string} datasource 
 */
function calculateImages(datasource)
{
    console.log('Calculating total images.');
    const subFolderPath = `${utils.recordsDir}/${datasource}`;
    utils.getDirs(subFolderPath).forEach(dir => {
        const currentFolderPath = `${subFolderPath}/${dir}`;
        fs.readdirSync(currentFolderPath).forEach(record => {
            if (!record.startsWith(datasource)) {
                return;
            }
            const fullPathForRecord = `${currentFolderPath}/${record}`;
            const loadedRecord = fs.readFileSync(fullPathForRecord);
            const recordJSON = JSON.parse(loadedRecord);
            if (!recordJSON.record.images) {
                return;
            }
            totalImages += recordJSON.record.images.length;
            if (recordJSON.loaded) {
                totalImagesLoaded += recordJSON.record.images.length;
            }
        });
    });
}

/**
 * Load images from given datasource
 * @param {string} datasource Datasource to load images from
 */
async function loadImages(datasource) {
    // Calculate total amount of images to load
    calculateImages(datasource);
    let _queue = getImagesToQueue(datasource);
    while (_queue.length > 0) {
        const image = _queue.shift();
        // Gather all images
        console.time('Loaded in');
        for (let attempt = 1; attempt <= defaults.maxAttemptsForFetch; attempt++) {
            try {
                await waitForImage(image);
                break;
            } catch(e) {
                console.log(`Error occurred: Attempt ${attempt} / 10. ${e}`);
                if (attempt >= defaults.maxAttemptsForFetch) {
                    throw new Error('Can not continue. Throwing error.');
                }
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
        }
        if (defaults.verbose) {
            console.log(process.memoryUsage());
        }
        console.clear(); // clear the console buffer after every image 
        imagesLoaded = ++totalImagesLoaded;
        process.stdout.write("Loaded:  " + imagesLoaded.toString() + " / " + totalImages.toString() + "   ");
        console.timeEnd('Loaded in');
        if (_queue.length === 0) {
            _queue = getImagesToQueue(datasource); 
        }
    }
    console.log(`Total images downloaded: ${imagesLoaded}\n`)
}

/**
 * Load an image defined in image object
 * @param {object} image Image object containing url, isLastImage, record, final
 * @returns 
 */
async function waitForImage(image) {
    // Wait for 1 second between requests to avoid being rate limited
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (defaults.verbose) {
        console.log(image);
    }
    const headers = new Headers(defaults.headers);
    return await fetch(image.url, {signal: AbortSignal.timeout(defaults.timeOut || 30000), method: 'GET', headers}).then(response => {
        if (response.ok) {
            return response.arrayBuffer();
        } else {
            throw new Error(response.status);
        }
    }).then(buffer => {
        const savePath = utils.getFolder(image.subPath, '');
        writeFile(`${savePath}/${image.name}`, Buffer.from(buffer));
        if (image.isLastImage) {
            const recordJson = JSON.parse(fs.readFileSync(image.record));
            recordJson.loaded = true;
            fs.writeFileSync(image.record, JSON.stringify(recordJson));
        }
        return true;
    });
};
