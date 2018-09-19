'use strict'

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


module.exports = {
  getFolders
}