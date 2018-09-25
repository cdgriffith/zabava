let gulp = require('gulp')
let rename = require('gulp-rename')

gulp.task('link-dependencies', function () {
  gulp.src("./node_modules/bootstrap/dist/js/*")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/bootstrap/dist/css/*")
  .pipe(gulp.dest("./public/stylesheets/"))

  gulp.src("./node_modules/jquery/dist/jquery*")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/shaka-player/dist/shaka-player.compiled*")
      .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/iso-639-1/build/index.js")
      .pipe(rename('iso-639-1.js'))
      .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/iso-639-1/build/index.js.map")
      .pipe(rename('iso-639-1.js.map'))
      .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/open-iconic/font/css/open-iconic-bootstrap.min.css")
      .pipe(gulp.dest("./public/stylesheets/"))

  gulp.src("./node_modules/open-iconic/font/fonts/*")
      .pipe(gulp.dest("./public/fonts/"))
})

gulp.task('default', ['link-dependencies'])
