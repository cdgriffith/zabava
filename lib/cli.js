'use strict'
require('dotenv').config()
const {prepareVideo} = require('./dash')
const db = require('./db')
const Asset = require('./models/asset')()
const {getProvider} = require('./storage')
const crypto = require('crypto')
const fs = require('fs-extra')
const {encrypt} = require('./encryption')
const os = require('os')
const path = require('path')

const uploadVideo = async (movieName, movieFile, coverFile) => {
  await db()
  let provider = getProvider()
  let storage = new provider()
  let key = crypto.randomBytes(16).toString('hex')
  let keyId = crypto.randomBytes(16).toString('hex')
  let coverKey = crypto.randomBytes(16).toString('hex')
  // let movieFiles = []
  // for (let file of files){
  //   if (file.toLowerCase().endsWith('.mp4')){
  //     movieFiles.push(file)
  //   }
  // }
  // if (movieFiles.length === 1){
  //   console.log('WE CAN DO IT!')
  // } else if (movieFiles.length >= 1){
  //   console.log("THERE'S TOO MANY OF THEM CAPTAIN")
  //   return
  // } else {
  //   console.log("Aww, no movies here!")
  //   return
  // }

  let {videoId, outputDir} = await prepareVideo(movieFile, keyId, key)
  let encryptedImage = await encrypt(await fs.readFile(coverFile), coverKey)
  let coverData = {
    key: coverKey,
    iv: encryptedImage.iv,
    tag: encryptedImage.tag,
    salt: encryptedImage.salt
  }

  await Asset.create({
    media_id: videoId,
    media_name: movieName,
    encryption: {key_id: keyId, key: key},
    cover: coverData
  })

  let tmpCover = path.join(os.tmpdir(), `${videoId}.jpg`)
  await fs.writeFile(tmpCover, encryptedImage.encrypted)

  await storage.uploadDirectory(outputDir, `mpeg_dash/${videoId}`)
  await storage.uploadFile(tmpCover, `covers/${videoId}.jpg`)
  await fs.remove(tmpCover)
  await fs.remove(outputDir)

}


module.exports = {
  uploadVideo
}