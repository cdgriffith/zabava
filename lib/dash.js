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

const prepareVideo = async (sourceVideo, encryptionKeyId, encryptionKey, buildDir = path.join(os.tmpdir(), 'dash_build')) => {
  if (!fs.existsSync(buildDir)) {
    await mkdir(buildDir)
  }
  let videoId = uuid.v4()
  let fragmented = path.join(buildDir, `${videoId}.mp4`)
  let outputDir = path.join(buildDir, videoId)
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

  return {outputDir, videoId}
}

module.exports = {prepareVideo}


// Shamelessly stolen from https://github.com/silviapfeiffer/silviapfeiffer.github.io
function srt2webvtt(data) {
  // remove dos newlines
  let srt = data.replace(/\r+/g, '')
  // trim white space start and end
  srt = srt.replace(/^\s+|\s+$/g, '')

  // get cues
  let cuelist = srt.split('\n\n')
  let result = ""

  if (cuelist.length > 0) {
    result += "WEBVTT\n\n"
    for (let i = 0; i < cuelist.length; i = i + 1) {
      result += convertSrtCue(cuelist[i])
    }
  }

  return result
}

function convertSrtCue(caption) {
  // remove all html tags for security reasons
  //srt = srt.replace(/<[a-zA-Z\/][^>]*>/g, '');

  let cue = ""
  let s = caption.split(/\n/)

  // concatenate muilt-line string separated in array into one
  while (s.length > 3) {
    for (let i = 3; i < s.length; i++) {
      s[2] += "\n" + s[i]
    }
    s.splice(3, s.length - 3)
  }

  let line = 0

  // detect identifier
  if (!s[0].match(/\d+:\d+:\d+/) && s[1].match(/\d+:\d+:\d+/)) {
    cue += s[0].match(/\w+/) + "\n"
    line += 1
  }

  // get time strings
  if (s[line].match(/\d+:\d+:\d+/)) {
    // convert time string
    let m = s[1].match(/(\d+):(\d+):(\d+)(?:,(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:,(\d+))?/)
    if (m) {
      cue += m[1] + ":" + m[2] + ":" + m[3] + "." + m[4] + " --> "
          + m[5] + ":" + m[6] + ":" + m[7] + "." + m[8] + "\n"
      line += 1
    } else {
      // Unrecognized timestring
      return ""
    }
  } else {
    // file format error or comment lines
    return ""
  }

  // get cue text
  if (s[line]) {
    cue += s[line] + "\n\n"
  }

  return cue
}