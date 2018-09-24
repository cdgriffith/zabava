#!/usr/bin/env node
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
const winston = require('winston')
let program = require('commander')
const {promisify} = require('util')
const getSize = promisify(require('get-folder-size'))
const sharp = require('sharp')
const log = winston.log
const {srt2webvtt} = require('./subtitles')
const uuid = require('uuid')


winston.add(new winston.transports.Console({
  format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
  )
}))
winston.level = process.env.LOG_LEVEL || 'info'

let cleanupFiles = []

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

  let episode = cmd.episode || null
  let series = cmd.series || null
  let season = cmd.season || null
  let mediaType = cmd.media_type || 'movies'
  if (['movies', 'tv_show', 'anime'].indexOf(mediaType) === -1){
    throw Error(`Media type ${mediaType} is not supported`)
  }

  if (series && !episode){
    throw Error("A series must have an episode number")
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
    subtitleLang = cmd.subtitles_langauge || 'en'
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
  await Asset.create({
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
    auto_play_series: cmd.auto_play || false
  })

  // Upload Movie
  log('info', 'uploading MPEG-DASH files')
  try {
    await storage.uploadDirectory(outputDir, mediaId)
  } catch (err) {
    log('error', `Could not upload movie, removing details from database. ${err}`)
    await Asset.deleteOne({movie_name: movieName})
    await storage.deleteDirectory(`${mediaId}`)
    throw err
  } finally {
    if (!cmd.do_not_delete) {
      await fs.remove(outputDir)
    }
  }

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

  log('info', 'uploading subtitles')
  if (remoteSubPath) {
    try {
      await storage.uploadFile(webvttFile, remoteSubPath)
    } finally {
      if (!cmd.do_not_delete) {
        await fs.remove(webvttFile)
      }
    }

  }

  let totalTime = ((new Date().getTime() - startTime) / 1000).toFixed(2)
  log('info', `Adding media completed in ${totalTime} seconds`)

}

const cleanup = async () => {
  for (let file of cleanupFiles) {
    await fs.remove(file)
  }
}

const upload = async (movieFile, cmd) => {
  try {
    await uploadVideo(movieFile, cmd)
    if (!cmd.do_not_delete) {
      await cleanup()
    }
    process.exit(0)
  } catch (err) {
    log('error', err.message)
    if (!cmd.do_not_delete) {
      await cleanup()
    }
    process.exit(1)
  }
}


const removeMedia = async (movieName, cmd) => {
  await db()
  let asset = await Asset.findOne({media_name: movieName})
  if (!asset) {
    throw Error('no movie with that name found!')
  }

  let provider = getProvider()
  let storage = new provider()

  log('info', 'Removing items from storage provider')
  try {
    await storage.deleteDirectory(`${process.env.STORAGE_MPEG_DASH_FOLDER}/${asset.media_id}`)
  } catch (err) {
    log('warning', 'Could not delete items from storage provider!')
  }
  log('info', 'Removing item from database')
  try {
    await Asset.deleteOne({media_name: movieName})
  } catch (err) {
    log('warning', 'Could not delete from the database')
  }
  log('info', 'Deletion complete')
}

const remove = async (mediaName, cmd) => {
  try {
    await removeMedia(mediaName, cmd)
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
    console.log(asset.media_name)
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

// TODO IMPORTANT find way to recover failed upload


program
    .description('Zabava - Manage media files')
    .version('0.0.1', '-v, --version')
    .command('upload <movieFile>')
    .description('Upload, convert, and auto encrypt new media file')
    .option('-c, --cover [cover file]', 'Cover file')
    .option('-n, --movie-name [movie name]', 'Movie name (will use filename if omitted)')
    .option('-s, --subtitles [subtitles file]', 'File for subtitles (srt format)')
    .option('-l, --subtitles-language [subtitles language]', 'defaults to eng')
    .option('--do-not-delete', 'Leave all build files')
    .option('--verbose')
    .option('-t, --media-type [media type]', 'movies | tv_shows | anime | music | audiobook | xxx')
    .option('--series [series name]', 'name of series, must provide episode number')
    .option('--season [season number]', 'Season number', parseInt)
    .option('--episode [number]', 'Episode number', parseInt)
    .option('-a, --auto-play', 'Autoplay the next item in the series')
    .action(upload)
program
    .command('delete <mediaName>')
    .description('Remove an item')
    .action(remove)
program
    .command('list')
    .description('View list of movies')
    .action(printList)

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}