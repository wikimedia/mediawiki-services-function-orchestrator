'use strict';

const fetch = require('node-fetch');

// TODO: hardcoded for now, must be changed when we agree on a way to define configs.
const fetchUri = 'https://notwikilambda.toolforge.org/w/api.php';

/**
 * Gets the ZObjects of a list of ZIDs.
 *
 * @param {Array} ZIDs A list of ZIDs to fetch.
 * @return {Object} An object mapping ZIDs to ZObjects
 */
function fetchTypeZObject(ZIDs) {
  const ZIDsParam = [...new Set(ZIDs)].join('|');

  const url = new URL(fetchUri);

  url.searchParams.append('action', 'wikilambda_fetch');
  url.searchParams.append('format', 'json');
  url.searchParams.append('zids', ZIDsParam);

  return fetch(url)
    .then((res) => res.json())
    .then((res) => {
      const typeZ1s = {};

      for (const key in res) {
        typeZ1s[key] = JSON.parse(res[key].wikilambda_fetch);
      }

      return typeZ1s;
    });
}

module.exports = { fetchTypeZObject };
