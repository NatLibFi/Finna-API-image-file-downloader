const fs = require('fs');
const defaults = require('./defaults.js');

/**
 * Base path for saved searches
 */
const _cacheDir = `${__dirname}/cache`;
/**
 * Base path for saving records
 */
const _recordsDir = `${__dirname}/records`;
/**
 * Base path for the global memory used to keep track
 */
const _mainMemoryDir = `${__dirname}/main`;

/**
 * Main memory for application, keeps track of internal indexes.
 */
const _mainMemoryPath = `${_mainMemoryDir}/memory.json`;

// Base path for images folder
const _imagesDir = `${__dirname}/images`;

let mainMemoryObject;

/**
 * Find possible folder to save files into, taking into account defaults.js maxFilesPerFolder
 * @param {string} subFolderPath Sub folder path
 * @param {string} currentFolder Current folder path
 * @returns {string} Folder path where saving is permitted
 */
function getPossibleFolderToSave(subFolderPath, currentFolder)
{
    if (subFolderPath == currentFolder) {
        // We have a folder set to save records into. Calculate that it does not exceed the max amount
        if (fs.readdirSync(currentFolder, isHidden).length < defaults.maxFilesPerFolder) {
            return currentFolder;
        }
    }
    if (defaults.verbose) {
      console.log(subFolderPath);
    }
    let newFolder = '';
    let directories = getDirectoriesFromDirectory(subFolderPath);
    directories.forEach(directory => {
      if (newFolder !== '') {
        return;
      }
      const curDirPath = `${subFolderPath}/${directory}`;
      if (fs.readdirSync(curDirPath, isHidden).length < defaults.maxFilesPerFolder) {
        newFolder = curDirPath;
      }
    });
    if (newFolder !== '') {
      return newFolder;
    }
    // No possible folders found for save, create a new one with index continued from the last
    let directoryCounter = directories.length;
    const possibleNewFolder = `${subFolderPath}/part_${directoryCounter}`;
    if (!fs.existsSync(possibleNewFolder)) {
        fs.mkdirSync(possibleNewFolder);
    }
    return possibleNewFolder;
}

function manageFoldersExists()
{
  if (!fs.existsSync(_cacheDir)) {
    fs.mkdirSync(_cacheDir);
  }
  if (!fs.existsSync(_recordsDir)) {
      fs.mkdirSync(_recordsDir);
  }
  if (!fs.existsSync(_mainMemoryDir)) {
      fs.mkdirSync(_mainMemoryDir);
  }
  if (!fs.existsSync(_imagesDir)) {
    fs.mkdirSync(_imagesDir);
  }
}

function getMainMemory()
{
  mainMemoryObject = {
    lastLoadIndex: -1,
    saveIndexIterator: 0,
    name: ''
  };
  if (fs.existsSync(_mainMemoryPath)) {
    const tmpMemory = fs.readFileSync(_mainMemoryPath);
    mainMemoryObject = JSON.parse(tmpMemory);
  }
  return mainMemoryObject;
}

function saveMainMemory()
{
  fs.writeFileSync(_mainMemoryPath, JSON.stringify(mainMemoryObject));
}

function getSavedSearches()
{
  let saves = {};
  /**
   * Loop through all the previous saves and get the last iterator for new objects.
   */
  fs.readdirSync(_cacheDir).forEach(save => {
      const saveSplitted = save.split('.', 2);
      const savedInt = Number.parseInt(saveSplitted[0]);
      const fullPath = `${_cacheDir}/${save}`;
      saves[savedInt] = JSON.parse(fs.readFileSync(fullPath));
  });
  return saves;
}

function resetMainMemory()
{
  console.log('Resetting Main Memory. \n');
  const defaultMemory = {
      lastLoadIndex: -1,
      saveIndexIterator: 0,
      name: ''
  };
  fs.writeFileSync(_mainMemoryPath, JSON.stringify(defaultMemory, null, 2));
}

/**
 * Get directories inside a directory
 * @param {string} dirPath Directory path to get subdirectories from
 * @returns {Array} directories found
 */
function getDirectoriesFromDirectory(dirPath)
{
  return fs.readdirSync(dirPath, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
}

function isHidden(path) {
  return (/(^|\/)\.[^\/\.]/g).test(path);
};

module.exports = {
  getFolder: getPossibleFolderToSave,
  getDirs: getDirectoriesFromDirectory,
  checkFolders: manageFoldersExists,
  cacheDir: _cacheDir,
  recordsDir: _recordsDir,
  mainMemoryDir: _mainMemoryDir,
  imagesDir: _imagesDir,
  mainMemoryObject: mainMemoryObject,
  getMainMemory: getMainMemory,
  saveMainMemory: saveMainMemory,
  resetMainMemory: resetMainMemory,
  getSaves: getSavedSearches
};