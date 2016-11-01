const fs = require('fs');
const path = require('path');

const browserSync = require('browser-sync');
const gaze = require('gaze');
const globHash = require('glob-hash');

module.exports = function (opts) {
  opts = opts || {};

  var gitignore = '';
  var pkg;
  var pkgPath = path.join(opts.project.path, 'package.json');

  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath));
  } catch (e) {
  }

  try {
    gitignore = fs.readFileSync(path.join(opts.project.path, + '.gitignore')).toString();
  } catch (e) {
  }

  var filesGitignore = gitignore
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .split('\n');

  var filesWhitelist = [
    opts.project.path + '/**/*.{js,html,css,png,jpg,gif,svg,eot,otf,ttf,woff,woff2}',
  ];

  var filesBlacklist = [
    opts.project.path + '/sw.js',
    opts.project.path + '/node_modules/**',
  ];

  filesBlacklist = filesBlacklist.concat(filesGitignore);

  if (pkg && pkg.main) {
    filesBlacklist.push(pkg.main);
  }

  var globHashOptions = {
    include: filesWhitelist,
    exclude: filesBlacklist,
  };

  var filesToWatchGlobPattern = filesWhitelist.concat(filesBlacklist.map(function (fn) {
    // Prepend `!` to exclude the path.
    return '!' + fn;
  }));

  var writeHashToSW = function (hash) {
    console.log('updated static content hash:', hash);

    var swjs = path.join(opts.project.path, 'sw.js');
    fs.readFile(swjs, 'utf8', function (err, contents) {
      if (err) {
        console.error(err);
        throw err;
      }

      // Replace version on line with `// {STATIC_HASH}` comment.
      var output = contents.toString()
        .replace(/-v-(.+)(['"]\s*\/\/.*{STATIC_HASH})/g, '-v-' + hash + '$2');

      fs.writeFile(swjs, output, 'utf8', function (err) {
        if (err) {
          console.error(err);
          throw err;
        }
      });
    });
  };

  var staticSWHasher = module.exports.staticSWHasher = function () {
    return globHash(globHashOptions).then(function (hash) {
      writeHashToSW(hash);

      gaze(filesToWatchGlobPattern, function (err, watcher) {
        if (err) {
          console.error(err);
          throw err;
        }

        // Get object of all watched files.
        var watched = this.watched();

        // Build flat array of watched files.
        var watchedFiles = Object.keys(watched)
          .reduce(function (acc, key) {
            return acc.concat(watched[key]);
          }, [])
          .filter(function (fn) {
            // Workaround for bug in `globule` that returns directory name even if blacklisted.
            return fn[0] === '.' || fn.indexOf('/.') === -1;
          });

        console.log('static content watched:\n' + watchedFiles.join('\n'));

        // Update the hash whenever a file is changed, added, or deleted.
        this.on('all', function (event, fn) {
          console.log('static content modified:', fn);

          globHash(globHashOptions)
            .then(writeHashToSW)
            .catch(console.error.bind(console));
        });
      });
    }).catch(console.error.bind(console));
  };

  var isEnabled = function (base, key, default_) {
    if (!(key in base)) {
      return default_ || false;
    }
    var val = (base[key] || '').toString().trim();
    return val !== '' && val !== '0' && val !== 'false' && val !== 'off';
  };

  if (opts.browsersync) {
    browserSync({
      server: opts.browsersync.path || process.cwd(),
      files: opts.browsersync.files || [filesWhitelist],
      notify: isEnabled(opts.browsersync, 'notify'),
      open: isEnabled(opts.browsersync, 'open', true),
      tunnel: isEnabled(opts.browsersync, 'tunnel', true),
    });
  }

  if (opts.serviceworker) {
    staticSWHasher();
  }
};
