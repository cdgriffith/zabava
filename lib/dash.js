'use strict'
const {promisify} = require('util')
const fs = require('fs')
const path = require('path')
const {log} = require('winston')
const exec = promisify(require('child_process').exec)
const uuid = require('uuid')

const unlink = promisify(fs.unlink)
const mkdir = promisify(fs.mkdir)

//ffmpeg -i "Ep. 01 - The Boy in the Iceberg-[720p].mkv" -c copy ep1.mp4

// https://gist.github.com/dvlden/b9d923cb31775f92fa54eb8c39ccd5a9

const convertVideo = async (sourceVideo, buildDir) => {
  // TODO detect if can just copy or if needs full conversion
  let ffmpeg = process.env.FFMPEG || 'ffmpeg'

  let tmpFile = path.join(buildDir, `${uuid.v4()}.mp4`)
  await exec(`"${ffmpeg}" -i "${sourceVideo}"  -c copy "${tmpFile}"`)

  return tmpFile
}

const prepareVideo = async (sourceVideo, encryptionKeyId, encryptionKey, videoId, buildDir) => {
  let mp4fragment = process.env.MP4_FRAGMENT || 'mp4fragment'
  let mp4dash = process.env.MP4_DASH || 'mp4dash'

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

module.exports = {prepareVideo, convertVideo}
