const fs = require('fs');
const path = require('path');

const electricity = require('electricity');
const express = require('express');
const gaze = require('gaze');
const globHash = require('glob-hash');
const internalIp = require('internal-ip');
const posthtmlrc = require('posthtml-load-config');
const tinylr = require('tiny-lr');
const yonder = require('yonder');

var app = express();

const IS_DEV = app.get('env') === 'development';
const PORT_LR = process.env.SHERPY_LR_PORT || process.env.LR_PORT || process.env.PORT || 35729;
const PORT_SERVER = process.env.SHERPY_PORT || process.env.PORT || 3000;
const POSTHTML_EXT = '.html';
const PUBLIC_DIR = path.join(__dirname, IS_DEV ? 'public' : '_prod');
const ROUTER_PATH = path.join(PUBLIC_DIR, 'ROUTER');


module.exports = function (opts) {
  opts = opts || {};

  var gitignore;
  var pkg;
  var pkgPath = path.join(opts.project.path, '/package.json');

  try {
    pkg = fs.readFileSync(pkgPath);
  } catch (e) {
  }
  if (pkg) {
    try {
      pkg = JSON.parse(pkg);
    } catch (e) {
    }
  }

  try {
    gitignore = fs.readFileSync(path.join(opts.project.path + '/.gitignore'));
  } catch (e) {
  }

  var filesGitignore = (gitignore.toString() || '')
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .split('\n');

  var filesWhitelist = [
    opts.project.path + '/**/*.{js,html,css,png,jpg,gif,svg,eot,otf,ttf,woff,woff2}'
  ];

  var filesBlacklist = [
    opts.project.path + '/sw.js',
    opts.project.path + '/node_modules/**'
  ];

  filesBlacklist = filesBlacklist.concat(filesGitignore);

  if (pkg && pkg.main) {
    filesBlacklist.push(pkg.main);
  }

  var globHashOptions = {
    include: filesWhitelist,
    exclude: filesBlacklist
  };

  var filesToWatchGlobPattern = filesWhitelist.concat(filesBlacklist.map(function (fn) {
    // Prepend `!` to exclude the path.
    return '!' + fn;
  }));

  var writeHashToSW = function (hash) {
    console.log('updated static content hash:', hash);

    fs.readFile(opts.project.path + '/sw.js', 'utf8', function (err, contents) {
      if (err) {
        console.error(err);
        throw err;
      }

      // Replace version on line with `// {STATIC_HASH}` comment.
      var output = contents
        .replace(/-v-(.+)(['"]\s*\/\/.*{STATIC_HASH})/g, '-v-' + hash + '$2');

      fs.writeFile(opts.project.path + '/sw.js', output, 'utf8', function (err) {
        if (err) {
          console.error(err);
          throw err;
        }
      });
    });
  };

  var staticSWHasher = module.exports.staticSWHasher = function () {
    return globHash(globHashOptions)
    .then(function (hash) {
      writeHashToSW(hash);

      gaze(filesToWatchGlobPattern, function (err, watcher) {
        if (err) {
          console.error(err);
          throw err;
        }

        // Get object of all watched files.
        var watched = this.watched();

        // Build flat array of watched files.
        var watchedFiles = [];
        Object.keys(watched).forEach(function (key) {
          watchedFiles = watchedFiles.concat(watched[key]);
        });
        watchedFiles = watchedFiles.filter(function (fn) {
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

  var isEnabled = function (val) {
    val = (val || '').toString().trim();
    return val !== '' && val !== '0' && val !== 'false' && val !== 'off';
  };

  // Live-reloading (for local development).
  // See https://github.com/mklabs/tiny-lr for usage.
  if (IS_DEV) {
    app.use(tinylr.middleware({app: app, dashboard: true}));
  }
  app.initServer = function () {
    // Serve static files (very similar to how Surge and GitHub Pages do).
    // See http://expressjs.com/en/starter/static-files.html for usage.
    return posthtmlrc({ext: POSTHTML_EXT}).then(({plugins, options}) => {
      var electricityOptions = {
        'hashify': false,
        'headers': {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
        }
      };
      if (IS_DEV) {
        electricityOptions.livereload = {
          'enabled': true,
          'listener': tinylr
        };
        electricityOptions.posthtml = {
          'enabled': true,
          'plugins': plugins,
          'options': options
        };
      }
      // NOTE: These headers disable the aggressive caching set by `electricity`
      // (since this server should never run in production anyway).
      electricityOptions.headers['Cache-Control'] = 'max-age=-1';
      electricityOptions.headers['Expires'] = '0';

      var serveStatic = electricity.static(PUBLIC_DIR, electricityOptions);
      app.use(serveStatic);

      // Create server-side redirects (defined in the `ROUTER` file).
      // See https://github.com/sintaxi/yonder#readme for usage.
      if (fs.existsSync(ROUTER_PATH)) {
        app.use(yonder.middleware(ROUTER_PATH));
      }

      app.use(function (req, res, next) {
        res.status(404);

        if (req.accepts('html')) {
          res.sendFile('404.html', {root: PUBLIC_DIR});
          return;
        }

        res.type('txt').send('Not found');
      });

      if (!module.parent) {
        let listener = app.listen(PORT_SERVER, function () {
          console.log('Listening on port http://%s:%s', internalIp.v4(), listener.address().port);
        });
      }

      return app;
    }).catch(console.error.bind(console));
  };

  app.initServer();

  if (opts.serviceworker) {
    staticSWHasher();
  }
};
