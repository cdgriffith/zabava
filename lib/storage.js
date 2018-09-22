'use strict'
const path = require('path')

const PROVIDER_DIRECTORY = path.join(__dirname, 'providers')

const PROVIDERS = {
  'backblaze': require(path.join(PROVIDER_DIRECTORY, 'backblaze'))
}


const getProvider = () => {
  return PROVIDERS[process.env.STORAGE_PROVIDER || 'backblaze']
}


module.exports = {
  getFolders,
  getProvider
}
