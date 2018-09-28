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

const convertVideo = async (sourceVideo, buildDir, videoCopy = true) => {
  // TODO detect if can just copy or if needs full conversion
  let ffmpeg = process.env.FFMPEG || 'ffmpeg'
  let videoCmd = '-codec:v copy'
  if (!videoCopy) {
    // let videoSize = await getSize(sourceVideo)
    videoCmd = '-codec:v libx264 -crf 18'
    // if (videoSize.width <= 400){
    //   videoCmd = `-codec:v libx264 -pix_fmt yuv420p -b:v 750k -minrate 400k -maxrate 1000k -bufsize 1500k`
    // } else if (videoSize.width <= 500){
    //   videoCmd = `-codec:v libx264 -pix_fmt yuv420p -b:v 1000k -minrate 500k -maxrate 2000k -bufsize 2000k`
    // } else if (videoSize.width <= 800){
    //   videoCmd = `-codec:v libx264 -pix_fmt yuv420p -b:v 2500k -minrate 1500k -maxrate 4000k -bufsize 5000k`
    // }
  }

  let tmpFile = path.join(buildDir, `${uuid.v4()}.mp4`)
  await exec(`"${ffmpeg}" -i "${sourceVideo}" -preset veryslow -codec:a libfdk_aac -b:a 128k ${videoCmd} "${tmpFile}"`)

  return tmpFile
}


const getSize = async (filename) => {
  const assert = require('assert')
  let ffprobe = process.env.FFPROBE || 'ffprobe'
  let resp = await exec(`"${ffprobe}" -v error -of flat=s=_ -select_streams v:0 -show_entries stream=height,width "${filename}"`)
  let width = /width=(\d+)/.exec(resp.stdout)
  let height = /height=(\d+)/.exec(resp.stdout)
  assert(width && height, 'No dimensions found!')
  return {
    width: parseInt(width[1]),
    height: parseInt(height[1])
  }
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
    await exec(`"${mp4fragment}" --index --fragment-duration 30000 "${sourceVideo}" "${fragmented}"`)
  } catch (err) {
    log('error', `Could not fragment video: ${err}`)
    throw err
  }

  try {

    let result = await exec(`"${mp4dash}" --subtitles --use-segment-timeline --encryption-key=${encryptionKeyId}:${encryptionKey} "${fragmented}" --output-dir="${outputDir}"`)
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
