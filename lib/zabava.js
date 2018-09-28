#!/usr/bin/env node
'use strict'
require('dotenv').config()
const {prepareVideo, convertVideo} = require('./dash')
const db = require('./db')
const Asset = require('./models/asset')
const {getProvider} = require('./storage')
const crypto = require('crypto')
const fs = require('fs-extra')
const {encrypt} = require('./encryption')
const os = require('os')
const path = require('path')
const winston = require('winston')
let program = require('commander')
const {promisify} = require('util')
const getSize = promisify(require('get-folder-size'))
const sharp = require('sharp')
const log = winston.log
const {srt2webvtt} = require('./subtitles')
const uuid = require('uuid')
const {mediaTypes} = require('./media')


winston.add(new winston.transports.Console({
  format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
  )
}))
winston.level = process.env.LOG_LEVEL || 'info'

let cleanupFiles = []
let doNotDelete = false

const generateId = async (media = false) => {
  let newId = uuid.v4().replace(/-/g, '')
  if (media && await Asset.findOne({media_id: newId})){
    return await generateId()
  }
  return newId
}


const uploadVideo = async (movieFile, cmd) => {
  if (cmd.verbose){
    winston.level = 'debug'
  }

  let startTime = new Date().getTime()
  await db()

  if (!fs.existsSync(movieFile)) {
    throw Error(`Movie file ${movieFile} doesn't exist`)
  }
  // TODO check movie type


  let episode = null
  let series =  null
  let season =  null
  let mediaType = cmd.mediaType
  if (! Object.keys(mediaTypes).includes(mediaType)){
    throw Error(`Media type ${mediaType} is not supported`)
  }
  let media = mediaTypes[mediaType]
  if (media.series){
    try{
   episode = cmd.episode
   series =  cmd.series
   season =  cmd.season}
   catch (err){
      throw Error(`series must be defined for ${mediaType},
       episode and seasons must be included and be numbers`)
   }
    if (!series || season < 1 || episode < 1){
      throw Error(`series must be defined for ${mediaType},
       episode and seasons must be included and be numbers`)
    }
  }

  // Movie Name
  let movieName = cmd.movie_name
  if (movieName === undefined || !movieName) {
    movieName = path.parse(movieFile).name
  }
  movieName = movieName.trim()
  if (await Asset.findOne({media_name: movieName})) {
    throw Error(`Movie with name '${movieName}' already exists`)
  }
  // Cover file
  let coverFile = cmd.cover
  if (coverFile === undefined || !coverFile) {
    coverFile = path.join(path.dirname(movieFile), 'cover.jpg')
  }
  if (!fs.existsSync(coverFile)) {
    throw Error(`Could not find cover file at '${coverFile}', please manually specify with '--cover' `)
  }
  log('debug', `Using cover file ${coverFile}`)

  // TODO add year  / IDMB lookup for other info

  let mediaId = await generateId(true)
  let buildDir = path.join(os.tmpdir(), mediaId)
  await fs.ensureDir(buildDir)

  let webvttFile = null
  let subtitleLang = null
  let encryptedFiles = []
  let remoteSubPath = ''
  let subtitles = []

  let provider = getProvider()
  let storage = new provider()
  let key = crypto.randomBytes(16).toString('hex')
  let keyId = crypto.randomBytes(16).toString('hex')

  // TODO support multiple sub tracks
  if (cmd.subtitles) {
    if (!fs.existsSync(cmd.subtitles)) {
      throw Error(`Could not find subtitles file at '${cmd.subtitles}' `)
    }
    log('info', 'Encrypting Subtitles file')
    // TODO support more than SRT
    let subKey = crypto.randomBytes(16).toString('hex')
    let srtContent = await fs.readFile(cmd.subtitles, 'utf-8')
   // let webvtt = srt2webvtt(srtContent)
    subtitleLang = cmd.subtitlesLanguage || 'en'
    let subId = await generateId()
    let encryptedSubs = await encrypt(srtContent, subKey)
    webvttFile = path.join(buildDir, subId)
    remoteSubPath = `${mediaId}/files/${subId}`
    cleanupFiles.push(webvttFile)
    await fs.writeFile(webvttFile, encryptedSubs.encrypted)
    delete encryptedSubs.encrypted
    encryptedFiles.push({key: subKey, file: remoteSubPath, ...encryptedSubs})
    subtitles.push({file: remoteSubPath, language: subtitleLang})
  }

  // Make sure image is the right size
  let imageBuffer = await fs.readFile(coverFile)
  let metadata = sharp(imageBuffer).metadata()
  if (metadata.width !== 300) {
    log('info', 'Resizing cover file')
    imageBuffer = await sharp(imageBuffer).resize(300, 450).toBuffer()
  }

  // Convert and encrypt Movie

  if (movieFile.toLowerCase().endsWith(".mkv")){
    log('info', 'MKV detected, converting to mp4')
    movieFile = await convertVideo(movieFile, buildDir)
    cleanupFiles.push(movieFile)
  }
  log('info', 'Encrypting and converting movie')
  let outputDir = await prepareVideo(movieFile, keyId, key, mediaId, buildDir)
  let folderSize = await getSize(outputDir)

  // Encrypt Image
  log('info', 'encrypting image')
  let coverKey = crypto.randomBytes(16).toString('hex')
  let encryptedImage = await encrypt(imageBuffer, coverKey)
  let coverId = await generateId()
  let remoteCoverPath = `${mediaId}/files/${coverId}`
  let tmpCover = path.join(buildDir, coverId)
  cleanupFiles.push(tmpCover)
  await fs.writeFile(tmpCover, encryptedImage.encrypted)
  delete encryptedImage.encrypted
  encryptedFiles.push({key: coverKey, file: remoteCoverPath, ...encryptedImage})

  // Add to database
  log('info', 'adding object to database')
  let asset = await Asset.create({
    media_id: mediaId,
    media_name: movieName,
    media_type: mediaType,
    encryption: {key_id: keyId, key: key},
    cover: remoteCoverPath,
    size: folderSize,
    encrypted_files: encryptedFiles,
    subtitles: subtitles,
    series: series,
    episode: episode,
    season: season,
    auto_play_series: cmd.autoPlay || false,
    processing: true
  })

  // TODO if not jpg convert
  // Upload cover file
  log('info', 'uploading cover file')
  try {
    await storage.uploadFile(tmpCover, remoteCoverPath)
  } finally {
    if (!cmd.do_not_delete) {
      await fs.remove(tmpCover)
    }
  }

  if (remoteSubPath) {
    log('info', 'uploading subtitles')
    try {
      await storage.uploadFile(webvttFile, remoteSubPath)
    } finally {
      if (!cmd.do_not_delete) {
        await fs.remove(webvttFile)
      }
    }
  }

  // Upload Movie
  log('info', 'uploading MPEG-DASH files')
  let data
  try {
    data = await storage.uploadDirectory(outputDir, mediaId)
  } catch (err) {
    log('error', `Could not upload movie, removing details from database. ${err}`)
    throw err
  }
  if (data.not_complete.length){
    data.outputDir = outputDir
    data.mediaId = mediaId
    await fs.writeFile('zabava_issues', JSON.stringify(data, null, 2))
    log(`error`, `Could not upload all files, please fix any issues and run: zabava resume`)
    doNotDelete = true
  } else {
    if (!cmd.do_not_delete) {
      await fs.remove(outputDir)
    }
    asset.processing = false
    await asset.save()
    let totalTime = ((new Date().getTime() - startTime) / 1000).toFixed(2)
    log('info', `Adding media completed in ${totalTime} seconds`)
  }

}

const cleanup = async () => {
  for (let file of cleanupFiles) {
    await fs.remove(file)
  }
}

const upload = async (movieFile, cmd) => {
  try {
    await uploadVideo(movieFile, cmd)
    if (!cmd.do_not_delete && !doNotDelete) {
      await cleanup()
    }
    process.exit(0)
  } catch (err) {
    log('error', err.message)
    if (!cmd.do_not_delete && !doNotDelete) {
      await cleanup()
    }
    process.exit(1)
  }
}


const removeMedia = async (mediaId, cmd) => {
  await db()
  let asset = await Asset.findOne({media_id: mediaId})
  if (!asset) {
    throw Error('no movie with that name found!')
  }

  let provider = getProvider()
  let storage = new provider()

  log('info', 'Removing items from storage provider')
  try {
    await storage.deleteDirectory(asset.media_id)
  } catch (err) {
    log('warning', 'Could not delete items from storage provider!')
  }
  log('info', 'Removing item from database')
  try {
    await Asset.deleteOne({media_name: asset.media_name})
  } catch (err) {
    log('warning', 'Could not delete from the database')
  }
  log('info', 'Deletion complete')
}

const remove = async (mediaId, cmd) => {
  try {
    await removeMedia(mediaId, cmd)
    process.exit(0)
  } catch (err) {
    log('error', err.message)
    process.exit(1)
  }
}

const listMedia = async (cmd) => {
  await db()
  let assets = await Asset.find()
  for (let asset of assets) {
    let series = ""
    if (asset.series){
      series = `${asset.series}: Season ${asset.season} Episode ${asset.episode} -`
    }
    console.log(`${asset.media_id} ${series} ${asset.media_name}`)
  }
}

const printList = async (cmd) => {
  try {
    await listMedia(cmd)
    process.exit(0)
  } catch (err) {
    log('error', err.message)
    process.exit(1)
  }
}

const resume = async (cmd) => {
  let data = await fs.readFile('zabava_issues')
  data = JSON.parse(data)
  let provider = getProvider()
  let storage = new provider()
  let asset = Asset.find({media_id: data.mediaId})
  if (!asset){
    log('error', `Could not find record of asset ${data.mediaId}`)
  }
  // Upload Movie
  log('info', 'uploading MPEG-DASH files')
  let result
  try {
    result = await storage.uploadDirectory(data.outputDir, data.mediaId)
  } catch (err) {
    log('error', `Could not upload movie, removing details from database. ${err}`)
    throw err
  }

  if (result.not_complete.length){
    result.outputDir = data.outputDir
    result.mediaId = data.mediaId
    await fs.writeFile('zabava_issues', JSON.stringify(result, null, 2))
    log(`error`, `Could not upload all files, please fix any issues and run: zabava resume`)
    doNotDelete = true
  } else {
    await fs.remove('zabava_issues')
    asset.processing = false
    await asset.save()
    log('info', `Adding media completed`)
  }


}

// TODO IMPORTANT find way to recover failed upload


program
    .description('Zabava - Manage media files')
    .version('0.0.1', '-v, --version')
    .command('upload <movieFile>')
    .description('Upload, convert, and auto encrypt new media file')
    .option('-c, --cover [cover]', 'Cover file')
    .option('-n, --movie-name [movie]', 'Movie name (will use filename if omitted)')
    .option('-s, --subtitles [subtitles]', 'File for subtitles (srt format)')
    .option('-l, --subtitles-language [sub_language]', 'defaults to eng')
    .option('--do-not-delete', 'Leave all build files')
    .option('--verbose')
    .option('-t, --media-type [media type]', Object.keys(mediaTypes).join(", "))
    .option('--series [series]', 'name of series, must provide episode number')
    .option('--season [season]', 'Season number', parseInt)
    .option('--episode [number]', 'Episode number', parseInt)
    .option('-a, --auto-play', 'Autoplay the next item in the series')
    .action(upload)
program
    .command('delete <mediaId>')
    .description('Remove an item')
    .action(remove)
program
    .command('list')
    .description('View list of movies')
    .action(printList)
program
    .command('resume')
    .action(resume)

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}