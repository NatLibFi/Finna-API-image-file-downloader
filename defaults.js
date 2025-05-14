/**
 * maxFilesPerFolder: Target amount of files per folder.
 * maxAttemptsForFetch: How many times can the script try to get an image. Default is 10 and every time it takes second longer.
 * viewBaseUrl: Url to use as base for downloading records and images.
 * verbose: true|false, Show extra data when performing searches.
 * timeOut: Milliseconds to wait until fetch is considered timed out.
 * headers: Object containing headers for requests, X-API-KEY: Api key obtained from finna, User-Agent: Descriptive user agent i.e small description + email
 * recordFields: Which record fields to return when fetching data. [id, images] has to be defined for this script to work.
 * Default fields are set. For more fields, look at: https://api.finna.fi/swagger-ui, scroll down for schemas and open Record under
 * schemas.
 */

module.exports = {
  maxFilesPerFolder: 1000,
  maxAttemptsForFetch: 10,
  viewBaseUrl: 'http://api.finna.fi/',
  verbose: false,
  timeOut: 30000,
  headers: {
      "User-Agent": "API-TESTING (EXAMPLE@EMAIL.COM)",
      "X-API-KEY": ''
  },
  recordFields: [
    'id',
    'images',
    'buildings',
    'firstIndexed',
    'formats',
    'imageRights',
    'languages',
    'nonPresenterAuthors',
    'onlineUrls',
    'presenters',
    'rating',
    'series',
    'subjects',
    'title',
    'urls',
    'year'
  ]
};