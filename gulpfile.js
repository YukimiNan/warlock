const gulp = require('gulp');
const runSequence = require('run-sequence');
const pump = require('pump');
const del = require('del');
const webpack = require('webpack-stream');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const watch = require('gulp-watch');

const c = {
    src: './client/src',
    dist: './client/dist'
};

gulp.task('clean', () => del(`${c.dist}/*`));

gulp.task('css', (cb) => {
    pump([
        gulp.src(`${c.src}/css/**/*.css`),
        gulp.dest(`${c.dist}/css`)
    ], cb);
});

gulp.task('js', (cb) => {
    pump([
        webpack({
            entry: `${c.src}/js/app.js`,
            output: { filename: 'app.bundle.js' },
            devtool: 'inline-source-map'
        }),
        sourcemaps.init(),
        babel(),
        uglify(),
        sourcemaps.write('.'),
        gulp.dest(`${c.dist}/js`)
    ], cb);
});

gulp.task('html', (cb) => {
    pump([
        gulp.src(`${c.src}/*.html`),
        gulp.dest(`${c.dist}`)
    ], cb);
});

gulp.task('build', ['clean'], (cb) => {
    runSequence(['css', 'js'], 'html', cb);
});

gulp.task('watch', ['build'], (cb) => {
    watch(`${c.src}/css/**/*.css`, () => { runSequence('css'); });
    watch(`${c.src}/js/**/*.js`, () => { runSequence('js'); });
    watch(`${c.src}/*.html`, () => { runSequence('html'); });
    cb();
});

gulp.task('default', ['build'], (cb) => { cb(); });
