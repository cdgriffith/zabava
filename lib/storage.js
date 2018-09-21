'use strict'

const PROVIDER_DIRECTORY = __dirname + '/providers/'

const PROVIDERS = {
  'backblaze': require(PROVIDER_DIRECTORY + 'backblaze')
}

const getFolders = async (b2, bucketId, baseFolder) => {
  if (b2.files[bucketId] === undefined || !b2.files[bucketId].length) {
    await b2.listFiles(bucketId)
  }

  let folders = new Set()

  for (let i = 0; i < b2.files[bucketId].length; i++) {
    let fileName = b2.files[bucketId][i].fileName
    if ((fileName.match(/\//g) || []).length >= 2) {
      let [base, folderName] = fileName.split('/', 2)
      if (base === baseFolder) {
        folders.add(folderName)
      }
    }
  }
  return new Set(folders)
}


class Storage {
  constructor (){

  }

  async uploadFile(localFile, remoteFile){
    throw Error('Inheritance must override this function')
  }

  async uploadDirectory(localDirectory, remoteDirectory){
    throw Error('Inheritance must override this function')
  }

  async downloadFile(remoteFile){
    throw Error('Inheritance must override this function')
  }

  async streamUrl(remoteFile){
    throw Error('Inheritance must override this function')
  }

}

const getProvider = () => {
  return PROVIDERS[process.env.PROVIDER || 'backblaze']
}

module.exports = {
  getFolders,
  Storage,
  getProvider
}
