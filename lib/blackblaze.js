require('dotenv').config()
const axios = require('axios')

class BlackBlaze {

  constructor (accountId, access_id, access_key) {
    this.accountId = accountId
    this.accessId = access_id
    this.accessKey = access_key
    this.apiBase = `b2api/v1`
    this.buckets = []
    this.files = {}
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
  }

  async _request (url, data, method = 'post') {
    await this._ensureAuth()
    return await axios({
      headers: {
        Authorization: this.authToken,
      },
      method: method,
      data: data,
      url: url,
    })
  }

  async _ensureAuth(){
    if (! this.authToken){
      await this.auth()
    }
    // TODO make sure is still valid
  }

  async findBucket(bucketName) {
    if (!this.buckets){
      await this.listBuckets()
    }

    for (let i = 0; i < this.buckets.length; i++){
      if (this.buckets[i].bucketName === bucketName){
        return this.buckets[i].bucketId
      }
    }
  }

  async listBuckets () {
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_buckets`, {accountId: this.accountId})
    this.buckets = result.data.buckets
    return result.data.buckets
  }

  async listFiles (bucketId, prefix="") {
    let result = await this._request(`${this.apiUrl}/${this.apiBase}/b2_list_file_names`, {bucketId: bucketId, prefix: prefix})
    this.files[bucketId] = result.data.files
    return result.data.files
  }

  async downloadFile (fileId) {
    let result = await this._request(`${this.downloadUrl}/${this.apiBase}/b2_download_file_by_id`, {fileId: fileId}, 'get')
    return result.data
  }

  downloadFileNameUrl (bucketName, fileName) {
    return `${this.downloadUrl}/file/${bucketName}/${fileName}?Authorization=${this.authToken}`
  }

}


const main = async () => {
  let b2 = new BlackBlaze(process.env.B2_ACCOUNT_ID, process.env.B2ID,
    process.env.B2KEY)
  await b2.auth()
  return await b2.findBucket('griff-test')

  // let buckets = await b2.listBuckets()
  // let files = await b2.listFiles(buckets[0].bucketId)
  // return b2.downloadFileNameUrl(buckets[0].bucketName, files[0].fileName)
}

//main().then(_ => console.log(_)).catch(err => console.error(err))

module.exports = {
  BlackBlaze
}

