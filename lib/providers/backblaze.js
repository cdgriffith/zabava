const axios = require('axios')
const {Storage} = require('../storage')
const util = require('util')
const fs = require('fs')
const readFile = util.promisify(fs.readFile)
const hashFiles = util.promisify(require('hash-files'))
const mime = require('mime-types')
const {log} = require('winston')

class Backblaze extends Storage{

  constructor (accountId, accessId, accessKey, bucketName) {
    super()
    this.accountId = accountId
    this.accessId = accessId
    this.accessKey = accessKey
    this.bucketName = bucketName
    this.bucketId = null
    this.apiBase = `b2api/v1`
    this.apiUrl = ""
    this.downloadUrl = ""
    this.authToken = ""
    this.lastAuth = false
    this._buckets = []
    this._files = {}
  }

  async auth () {
    let result = await axios({
        method: 'get',
        url: `https://api.backblazeb2.com/${this.apiBase}/b2_authorize_account`,
        auth: {
          username: this.accessId,
          password: this.accessKey,
        },
      },
    )
    log('debug', 'backblaze authorized')
    this.apiUrl = result.data.apiUrl
    this.authToken = result.data.authorizationToken
    this.downloadUrl = result.data.downloadUrl
    this.lastAuth = new Date()
  }

  async _request (url, data, method = 'post', headers = {}) {
    if (! this.apiUrl || ! this.downloadUrl){
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
    })}
    catch (err){
      log('error', `Could not complete request to '${url}' : ${err}`)
      throw err
    }
  }

  async uploadFile(localFile, remoteFile, contentType = 'auto'){
    // TODO make sure file does not already exist
    await this.ensureAuth()
    if (!this.bucketId){
      this.bucketId = await this._findBucketId()
    }
    let get_upload_url = await this._request(`${this.apiUrl}/${this.apiBase}/b2_get_upload_url`, {bucketId: this.bucketId})
    let file_content = await readFile(localFile)
    if (contentType === 'auto'){
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
    return await this._request(get_upload_url.data.uploadUrl, file_content, 'post', headers)
  }

  async ensureAuth(){
    if (! this.authToken || ! this.lastAuth){
      await this.auth()
    }

    let  diff = (new Date().getTime() - this.lastAuth.getTime()) / 1000
    diff /= (60 * 60)
    if (Math.abs(Math.round(diff)) > 12){
      await this.auth()
    }
  }

  async _findBucketId() {
    if (!this._buckets.length){
      await this.listBuckets()
    }

    for (let i = 0; i < this._buckets.length; i++){
      if (this._buckets[i].bucketName === this.bucketName){
        return this._buckets[i].bucketId
      }
    }
    throw Error('No bucket named ${bucketName} found!')
  }


  async findFileName(bucketId, fileId) {
    if (this._files[bucketId] === undefined || !this._files[bucketId].length){
      await this.listFiles(bucketId)
    }

    for (let i = 0; i < this._files[bucketId].length; i++){
      if (this._files[bucketId][i].fileId === fileId){
        return this._files[bucketId][i].fileName
      }
    }
  }


  async listBuckets () {
    await this.ensureAuth()
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_buckets`, {accountId: this.accountId})
    this._buckets = result.data.buckets
    return result.data.buckets
  }

  async listFiles (bucketId, prefix="") {
    await this.ensureAuth()
    if (! bucketId || bucketId === undefined){
      throw Error("Must provide bucketId")
    }
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_file_names`, {bucketId: bucketId, prefix: prefix})
    this._files[bucketId] = result.data.files
    return result.data.files
  }

  async downloadFile (fileId) {
    await this.ensureAuth()
    let result = await this._request(`${this.downloadUrl}/${this.apiBase}/b2_download_file_by_id`, {fileId: fileId}, 'get')
    return result.data
  }

  async streamUrl (remoteFile, includeAuth = true) {
    await this.ensureAuth()
    let url = `${this.downloadUrl}/file/${this.bucketName}/${remoteFile}`
    if (includeAuth){
      url += `?Authorization=${this.authToken}`
    }
    return url
  }

}

module.exports = Backblaze


