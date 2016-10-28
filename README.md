# sherpy

A command-line tool to easily develop using [Browsersync](https://browsersync.io) (local dev server, live reloading, remote tunneling) and an offline-first Service Worker for static assets.

The Service Worker is versioned based on a hash of the static content of the working directory.

## Requirements

Must have a file called `sw.js` in the root of your project containing a line like this one:

```js
var CURRENT_CACHES = {
  static: 'static-cache-v-98f2739d'  // {STATIC_HASH}
};
```

## CLI Usage

```sh
Usage
  $ sherpy

Options
  -t, --tunnel  Tunnel
  -h, --help    Show help

Examples
  $ sherpy
```


## License

[MIT](LICENSE.md)
