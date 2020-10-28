#!/usr/bin/env node
'use strict'

const path = require('path');
const readline = require('readline');
const fs = require('fs');
const { exec } = require('child_process');

let releasesJson;
let packageJson;

try {
  releasesJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'releases.json')));
} catch (err) {
  releasesJson = {}
}

try {
  packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json')));
} catch (err) {
  console.error('package.json required to create moli ad tag release');
  throw err;
}

const packageJsonVersion = packageJson.version;
const versions = releasesJson.versions ?? [];

const majorVersionNumber = Number(packageJsonVersion.split('.')[0]);
const version = (majorVersionNumber + 1) + '.0.0';

packageJson.version = version;

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

enterChanges(rl, function (changelog) {
  const change = {
    'version': version,
    'changelog': changelog
  };
  versions.push(change);

  let releasesJsonContent = {
    'currentVersion': version,
    'versions': versions
  };

  fs.writeFileSync('releases.json', JSON.stringify(releasesJsonContent, null, 2));

  console.log('Successfully created release ' + version);
});

rl.on('close', function () {
  setTimeout(() => {
    exec(`git add package.json releases.json && git commit -m 'v${version}' && git tag -a v${version} -m v${version} && git push && git push origin v${version}`, (err, stdout, stderr) => {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully pushed new version');
      }
      process.exit(0);
    });
  }, 1000);
});

/**
 * Recursive function that waits for user input to create a changelog.
 * @param rl The readline object
 * @param callback The callback which returns the changelog array.
 * @param changelog The initial changelog. (works as accumulator)
 */
function enterChanges(rl, callback, changelog = []) {
  rl.question('Please enter your changes: (leave empty for submission): ', function (change) {
    //user leaves empty, so we can return
    if (change == null || change === '') {
      callback(changelog);
      rl.close();
      return;
    }

    // recursively call this function until the user leaves the input empty
    changelog.push(change);
    enterChanges(rl, callback, changelog);
  });
}
