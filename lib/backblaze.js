const axios = require('axios')

class Backblaze {

  constructor (accountId, access_id, access_key) {
    this.accountId = accountId
    this.accessId = access_id
    this.accessKey = access_key
    this.apiBase = `b2api/v1`
    this.buckets = []
    this.files = {}
    this.apiUrl = ""
    this.downloadUrl = ""
    this.authToken = ""
    this.lastAuth = false
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
    this.apiUrl = result.data.apiUrl
    this.authToken = result.data.authorizationToken
    this.downloadUrl = result.data.downloadUrl
    this.lastAuth = new Date()
  }

  async _request (url, data, method = 'post') {
    if (! this.apiUrl || ! this.downloadUrl){
      throw Error("URLS are still undefined")
    }
    return await axios({
      headers: {
        Authorization: this.authToken,
      },
      method: method,
      data: data,
      url: url,
    })
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

  async findBucket(bucketName) {
    if (!this.buckets.length){
      await this.listBuckets()
    }

    for (let i = 0; i < this.buckets.length; i++){
      if (this.buckets[i].bucketName === bucketName){
        return this.buckets[i].bucketId
      }
    }
  }

  async findFileName(bucketId, fileId) {
    if (this.files[bucketId] === undefined || !this.files[bucketId].length){
      await this.listFiles(bucketId)
    }

    for (let i = 0; i < this.files[bucketId].length; i++){
      if (this.files[bucketId][i].fileId === fileId){
        return this.files[bucketId][i].fileName
      }
    }
  }



  async listBuckets () {
    await this.ensureAuth()
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_buckets`, {accountId: this.accountId})
    this.buckets = result.data.buckets
    return result.data.buckets
  }

  async listFiles (bucketId, prefix="") {
    await this.ensureAuth()
    if (! bucketId || bucketId === undefined){
      throw Error("Must provide bucketId")
    }
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_file_names`, {bucketId: bucketId, prefix: prefix})
    this.files[bucketId] = result.data.files
    return result.data.files
  }

  async downloadFile (fileId) {
    await this.ensureAuth()
    let result = await this._request(`${this.downloadUrl}/${this.apiBase}/b2_download_file_by_id`, {fileId: fileId}, 'get')
    return result.data
  }

  downloadFileNameUrl (bucketName, fileName) {
    return `${this.downloadUrl}/file/${bucketName}/${fileName}?Authorization=${this.authToken}`
  }

}


const main = async () => {
  let b2 = new Backblaze(process.env.B2_ACCOUNT_ID, process.env.B2ID, process.env.B2KEY)
  await b2.auth()
  return await b2.findBucket('griff-test')

  // let buckets = await b2.listBuckets()
  // let files = await b2.listFiles(buckets[0].bucketId)
  // return b2.downloadFileNameUrl(buckets[0].bucketName, files[0].fileName)
}

//main().then(_ => console.log(_)).catch(err => console.error(err))

module.exports = {
  Backblaze
}

