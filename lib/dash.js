'use strict'
const {promisify} = require('util')
const fs = require('fs')
const uuid = require('uuid')
const path = require('path')
const {log} = require('winston')
const os = require('os')
const exec = promisify(require('child_process').exec)

const unlink = promisify(fs.unlink)
const mkdir = promisify(fs.mkdir)

let mp4fragment = process.env.MP4_FRAGMENT || 'mp4fragment'
let mp4dash = process.env.MP4_DASH || 'mp4dash'

const prepareVideo = async (sourceVideo, encryptionKeyId, encryptionKey, videoId, buildDir) => {
  if (!fs.existsSync(buildDir)) {
    await mkdir(buildDir)
  }

  let fragmented = path.join(buildDir, `${videoId}.mp4`)
  let outputDir = path.join(buildDir, 'media')
  log('debug', `About to convert video to Dash, will output result at '${outputDir}'.`)

  try {
    await exec(`"${mp4fragment}" --fragment-duration 100000 "${sourceVideo}" "${fragmented}"`)
  } catch (err) {
    log('error', `Could not fragment video: ${err}`)
    throw err
  }

  try {

    let result = await exec(`"${mp4dash}" --subtitles --encryption-key=${encryptionKeyId}:${encryptionKey} "${fragmented}" --output-dir="${outputDir}"`)
    if (result.stderr) {
      log('error', `Error occurred while converting: ${result.stderr}`)
    }
  } catch (err) {
    log('error', `Could not convert video: ${err}`)
    throw err
  } finally {
    await unlink(fragmented)
  }

  return outputDir
}

module.exports = {prepareVideo}
