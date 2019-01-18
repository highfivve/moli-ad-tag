#!/usr/bin/node

// this script should always be executed in the 'postinstall' step

// Replace the globalVarName in the package.json to avoid name collisions
// on publisher sites that already use prebid.
// The globalVar will be `moliPbjs` if you run this script. The moli implementation
// can only handle `pbjs` and `moliPbjs`.

// Parameters:
//   (optional) - true / false . true will change the name, while false or none will keep as is
// Example call:
// ./prebid/change-global-var.js foo

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const log = console.log;

// access the prebid.js package.json in the node_modules directory
const packageJson = path.join(process.cwd(), 'node_modules', 'prebid.js', 'package.json');

log(`Changing the ${chalk.blue('globalVarName')} variable in the prebid ${chalk.blue('package.json')}`);
log(`Looking for package.json here ${chalk.italic(packageJson)}`);

if (!fs.existsSync(packageJson)) {
  console.error('package.json not found!');
  process.exit(1);
}

// read the package.json and change the name
const content = fs.readFileSync(packageJson);
const packageJsonObj = JSON.parse(content);

// this variable is fixed! The moli implementation can only handle
// `pbjs` and `moliPbjs`.
const globalVarName = process.argv[2] && process.argv[2] === 'true' ? 'moliPbjs' : 'pbjs';

if (packageJsonObj.globalVarName !== globalVarName) {
  log(`Change ${chalk.yellow(packageJsonObj.globalVarName)} to ${chalk.green(globalVarName)}`);
  packageJsonObj.globalVarName = globalVarName;
  fs.writeFileSync(packageJson, JSON.stringify(packageJsonObj, null, 2));

  log(`${chalk.green(globalVarName)} is the new global prebid variable`)
}

process.exit(0);