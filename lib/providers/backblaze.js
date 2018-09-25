const axios = require('axios')
const ProviderInterface = require('./interface')
const {promisify} = require('util')
const fs = require('fs')
const readFile = promisify(fs.readFile)
const hashFiles = promisify(require('hash-files'))
const path = require('path')
const mime = require('mime-types')
const {log} = require('winston')
const followRedirects = require('follow-redirects')
followRedirects.maxRedirects = 10
followRedirects.maxBodyLength = 5 * 1024 * 1024 * 1024

function chunk(arr, chunkSize) {
  let R = []
  for (let i = 0, len = arr.length; i < len; i += chunkSize)
    R.push(arr.slice(i, i + chunkSize))
  return R
}

class Backblaze extends ProviderInterface {

  constructor() {
    super()
    this.bucketId = null
    this.apiBase = `b2api/v1`
    this.apiUrl = ""
    this.downloadUrl = ""
    this.authToken = ""
    this.lastAuth = false
    this._buckets = []
  }

  async auth() {
    let result = await axios({
          method: 'get',
          url: `https://api.backblazeb2.com/${this.apiBase}/b2_authorize_account`,
          auth: {
            username: this.accessId,
            password: this.accessKey
          }
        }
    )
    log('debug', 'BackBlaze authorized')
    this.apiUrl = result.data.apiUrl
    this.authToken = result.data.authorizationToken
    this.downloadUrl = result.data.downloadUrl
    this.lastAuth = new Date()
  }

  async _request(url, data, method = 'post', headers = {}, options = {}) {
    if (!this.apiUrl || !this.downloadUrl) {
      throw Error("URLS are still undefined")
    }
    try {
      return await axios({
        headers: {
          Authorization: this.authToken,
          ...headers
        },
        method: method,
        data: data,
        url: url,
        timeout: 120000,
        ...options
      })
    }
    catch (err) {
      log('error', `Could not complete request to '${url}' : ${err}`)
      throw err
    }
  }

  async uploadFile(localFile, remoteFile, contentType = 'auto') {
    // TODO make sure file does not already exist
    await this.ensureAuth()
    await this.ensureBucket()
    let get_upload_url = await this._request(`${this.apiUrl}/${this.apiBase}/b2_get_upload_url`, {bucketId: this.bucketId})
    let file_content = await readFile(localFile)
    if (contentType === 'auto') {
      contentType = mime.lookup(localFile)
    }
    let headers = {
      bucketId: this.bucketId,
      'X-Bz-File-Name': remoteFile,
      'Content-Type': contentType,
      'Content-Length': file_content.length,
      'X-Bz-Content-Sha1': await hashFiles({files: [localFile], algorithm: 'sha1'}),
      'Authorization': get_upload_url.data.authorizationToken

    }
    log('debug', `About to upload ${localFile} to ${remoteFile}`)
    return await this._request(get_upload_url.data.uploadUrl, file_content, 'post', headers)
  }

  async _uploadHelper(file, localDirectory, remoteDirectory){
    let nixSafeFile = file.replace(/\\/g, '/').slice(localDirectory.length + 1)
    let uploadFile = `${remoteDirectory}/${nixSafeFile}`
    try {
      await this.uploadFile(file, uploadFile)
    } catch (err) {
      log('warning', `Could not upload ${file}, retrying`)
      await this.uploadFile(file, uploadFile)
    }
  }

  async uploadDirectory(localDirectory, remoteDirectory) {
    localDirectory = path.resolve(localDirectory)
    let files = await this._listLocalDirectory(localDirectory)
    let chucks = chunk(files, 2)
    for (let [index, eachChunk] of chucks.entries()){
      log('debug', `Uploading chunk ${index} of ${chucks.length}`)
      let promises = []
      for (let item of eachChunk){
        promises.push(this._uploadHelper(item, localDirectory, remoteDirectory))
      }
      await Promise.all(promises)
    }
  }

  async ensureAuth() {
    if (!this.authToken || !this.lastAuth) {
      return await this.auth()
    }
    let diff = (new Date().getTime() - this.lastAuth.getTime()) / 1000
    diff /= (60 * 60)
    if (Math.abs(Math.round(diff)) > 12) {
      await this.auth()
    }
  }

  async ensureBucket() {
    if (!this.bucketId) {
      this.bucketId = await this._findBucketId()
    }
  }

  async _findBucketId() {
    if (!this._buckets.length) {
      await this.listBuckets()
    }

    for (let i = 0; i < this._buckets.length; i++) {
      if (this._buckets[i].bucketName === this.bucketName) {
        return this._buckets[i].bucketId
      }
    }
    throw Error('No bucket named ${bucketName} found!')
  }


  async findFileName(bucketId, fileId) {
    if (this._files[bucketId] === undefined || !this._files[bucketId].length) {
      await this.listFiles(bucketId)
    }

    for (let i = 0; i < this._files[bucketId].length; i++) {
      if (this._files[bucketId][i].fileId === fileId) {
        return this._files[bucketId][i].fileName
      }
    }
  }

  async deleteDirectory(remoteDirectory) {
    await this.ensureAuth()
    let files = await this.listFiles(remoteDirectory)
    for (const [index, file] of files.entries()) {
      log('debug', `Deleting file ${index + 1} of ${files.length}`)
      try {
        await this._request(`${this.apiUrl}/${this.apiBase}/b2_delete_file_version`, {
          fileName: file.fileName,
          fileId: file.fileId
        })
      } catch (err) {
        log('warning', `Could not delete ${file.fileName}, retrying`)
        await this._request(`${this.apiUrl}/${this.apiBase}/b2_delete_file_version`, {
          fileName: file.fileName,
          fileId: file.fileId
        })
      }
    }
  }

  async deleteFile(remoteFile) {

  }

  async listBuckets() {
    await this.ensureAuth()
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_buckets`, {accountId: this.accountId})
    this._buckets = result.data.buckets
    return result.data.buckets
  }

  async listFiles(prefix = "") {
    await this.ensureAuth()
    await this.ensureBucket()
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_file_names`, {
      bucketId: this.bucketId,
      prefix: prefix
    })
    return result.data.files
  }

  async downloadFile(remoteFile) {
    await this.ensureAuth()
    let result = await this._request(`${this.downloadUrl}/file/${this.bucketName}/${remoteFile}`, {}, 'get', {}, {responseType: 'arraybuffer'})
    return result.data
  }

  async streamUrl(remoteFile, includeAuth = true) {
    await this.ensureAuth()
    let url = `${this.downloadUrl}/file/${this.bucketName}/${remoteFile}`
    if (includeAuth) {
      url += `?Authorization=${this.authToken}`
    }
    return url
  }

}

module.exports = Backblaze


