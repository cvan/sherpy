#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var meow = require('meow');

var sherpy = require('./');

var usage = fs.readFileSync(path.join(__dirname, 'usage.txt')).toString();

var cli = meow(usage, {
  help: usage,
  alias: {
    p: 'path',
    b: 'browsersync',
    s: 'serviceworker',
    n: 'notify',
    o: 'open',
    t: 'tunnel',
    h: 'help'
  }
});

var projectPath = cli.flags.path || cli.input[0];

var opts = {
  project: {
    path: projectPath || process.cwd()
  },
  browsersync: {
    path: projectPath,
    notify: cli.flags.notify,
    open: cli.flags.open,
    tunnel: cli.flags.tunnel
  },
  serviceworker: {
    path: projectPath || process.cwd()
  }
};

if (cli.flags.browsersync === false) {
  opts.browsersync = false;
}

if (!cli.flags.serviceworker === false) {
  opts.serviceworker = false;
}

sherpy(opts);
