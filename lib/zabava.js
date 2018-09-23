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
winston.level = process.env.LOG_LEVEL || 'debug'

let cleanupFiles = []


const uploadVideo = async (movieFile, cmd) => {
  let startTime = new Date().getTime()
  await db()

  if (!fs.existsSync(movieFile)) {
    throw Error(`Movie file doesn't exist`)
  }
  // TODO check movie type

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

  let webvttFile = null
  let subtitleLang = null

  if (cmd.subtitles) {
    if (!fs.existsSync(cmd.subtitles)) {
      throw Error(`Could not find subtitles file at '${cmd.subtitles}' `)
    }
    // TODO support more than SRT
    let srtContent = await fs.readFile(cmd.subtitles, 'utf-8')
    let webvtt = srt2webvtt(srtContent)
    subtitleLang = cmd.subtitles_langauge || 'eng'
    webvttFile = path.join(os.tmpdir(), `${uuid.v4()}`)
    cleanupFiles.push(webvttFile)
    await fs.writeFile(webvttFile, webvtt)
  }

  let provider = getProvider()
  let storage = new provider()
  let key = crypto.randomBytes(16).toString('hex')
  let keyId = crypto.randomBytes(16).toString('hex')
  let coverKey = crypto.randomBytes(16).toString('hex')

  // Make sure image is the right size
  let imageBuffer = await fs.readFile(coverFile)
  let metadata = sharp(imageBuffer).metadata()
  if (metadata.width !== 300) {
    log('debug', 'Resizing cover file')
    imageBuffer = await sharp(imageBuffer).resize(300, 450).toBuffer()
  }

  // Convert and encrypt Movie
  let {videoId, outputDir} = await prepareVideo(movieFile, keyId, key, webvttFile, subtitleLang)
  let folderSize = await getSize(outputDir)

  // Encrypt Image
  let encryptedImage = await encrypt(imageBuffer, coverKey)
  let tmpCover = path.join(os.tmpdir(), `${videoId}.jpg`)
  cleanupFiles.push(tmpCover)
  await fs.writeFile(tmpCover, encryptedImage.encrypted)

  // Add to database
  let coverData = {
    key: coverKey,
    iv: encryptedImage.iv,
    tag: encryptedImage.tag,
    salt: encryptedImage.salt
  }

  await Asset.create({
    media_id: videoId,
    media_name: movieName,
    media_type: 'movies',
    encryption: {key_id: keyId, key: key},
    cover: coverData,
    size: folderSize
  })

  // Upload Movie
  try {
    await storage.uploadDirectory(outputDir, `${process.env.STORAGE_MPEG_DASH_FOLDER}/${videoId}`)
  } catch (err) {
    log('error', `Could not upload movie, removing details from database. ${err}`)
    await Asset.deleteOne({movie_name: movieName})
    await storage.deleteDirectory(`${process.env.STORAGE_MPEG_DASH_FOLDER}/${videoId}`)
    throw err
  } finally {
    if (!cmd.do_not_delete) {
      await fs.remove(outputDir)
    }
  }

  // TODO if not jpg convert
  // Upload cover file
  try {
    await storage.uploadFile(tmpCover, `${process.env.STORAGE_COVER_FOLDER}/${videoId}.jpg`)
  } finally {
    if (!cmd.do_not_delete) {
      await fs.remove(tmpCover)
    }
  }

  let totalTime = ((new Date().getTime() - startTime) / 1000).toFixed(2)
  log('info', `Upload completed in ${totalTime} seconds`)

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
    log('error', err)
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

  try {
    await storage.deleteDirectory(`${process.env.STORAGE_MPEG_DASH_FOLDER}/${asset.media_id}`)
  } catch (err) {
    log('warning', 'Could not delete source video')
  }
  try {
    await storage.deleteFile(`${process.env.STORAGE_COVER_FOLDER}/${asset.media_id}.jpg`)
  } catch (err) {
    log('warning', 'Could not delete cover file')
  }
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
    log('error', err)
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
    log('error', err)
    process.exit(1)
  }
}

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