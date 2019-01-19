require('dotenv').config()
const createError = require('http-errors')
const express = require('express')
require('express-async-errors')
const path = require('path')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const jwt = require('express-jwt')
const winston = require('winston')
const indexRouter = require('./routes/index')
const apiRouter = require('./routes/api')
const {getToken} = require('./lib/auth')
const fileUpload = require('express-fileupload')
const favicon = require('serve-favicon')

winston.add(new winston.transports.Console({
  format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.simple()
  )
}))
winston.level = process.env.LOG_LEVEL || 'debug'

winston.stream = {
  write: function (message, encoding) {
    winston.info(message.trim())
  }
}

let app = express()

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(morgan('combined', {stream: winston.stream}))
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use(cookieParser(process.env.COOKIE_SECRET))
app.use(express.static(path.join(__dirname, 'public')))
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')))
app.use(jwt({
  secret: process.env.JWT_SECRET,
  getToken: getToken
}).unless({path: ['/', '/favicon.ico']}))
app.use(fileUpload())


app.use('/', indexRouter)
app.use('/api', apiRouter)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  if(err.status === 401) {
    res.redirect('/')
  }

  // set locals, only providing error in development

  if (err.status === 401){
    res.clearCookie('token')
    return res.redirect("/")
  }

  if (err.status === 404){
    return res.status(404).render('not_found')
  }

  winston.log('error', `Error for ${req.originalUrl} - ${err}`)

  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app
