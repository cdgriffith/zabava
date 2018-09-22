'use strict'
const {promisify} = require('util')
const path = require('path')
const fs = require('fs')
const stat = promisify(fs.stat)
const readDir = promisify(fs.readdir)

class ProviderInterface {

  constructor(){
    this.accountId = process.env.STORAGE_ACCOUNT_ID
    this.accessId = process.env.STORAGE_TOKEN_ID
    this.accessKey = process.env.STORAGE_TOKEN
    this.bucketName = process.env.STORAGE_BUCKET_NAME
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

  async _listLocalDirectory(dir) {
    const subDirs = await readDir(dir)
    const files = await Promise.all(subDirs.map(async (subDir) => {
      const res = path.join(dir, subDir)
      return (await stat(res)).isDirectory() ? this._listLocalDirectory(res) : res
    }))
    return files.reduce((a, f) => a.concat(f), [])
  }

}

module.exports = ProviderInterface
