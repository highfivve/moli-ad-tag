import browserEnv = require('browser-env');

// shared behaviour so it only gets applied once
browserEnv([ 'window', 'document' ]);
