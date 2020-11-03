#!/usr/bin/env node
'use strict'

const program = require('commander');

const dircompare = require('dir-compare');
const inquirer = require('inquirer');
const path = require('path');
const readline = require('readline');
const fs = require('fs');
const fse = require('fs-extra');
const { exec } = require('child_process');

program
  .version('1.0.0')
  .description('Create a release for moli ad tag')
  .option('-D --dry', 'Dry run not creating a commit', false)
  .parse(process.argv);

const dryRun = program.dry;

// Parse releases.json (optional) and package.json (required)
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

//Workaround as coalescing operator doesn't properly work with yarn.
let versions;
if (releasesJson.versions) {
  versions = releasesJson.versions;
} else {
  versions = [];
}

const packageJsonVersion = packageJson.version;
let version = Number(packageJsonVersion.split('.')[0]) + 1;


const refs = '%D';
const authorName = '%an';
const authorEmail = '%ae';
const subject = '%s';
const body = '%b';
const defaultFormat = {refs, subject, body, author: {name: authorName, email: authorEmail}};

const moliReleaseFolder = path.resolve(__dirname, 'bin');
const projectReleaseFolder = path.resolve(process.cwd(), 'releases');

(async () => {
  const res = dircompare.compareSync(moliReleaseFolder, projectReleaseFolder, { compareContent: true });

  let questions = [
    {
      type: 'number',
      name: 'version',
      message: 'Please enter the new version:',
      default: version
    }
  ]

  if(!res.same) {
    questions.unshift(
      {
        type: 'confirm',
        name: 'updateOverview',
        message: 'New version found for overview.hbs. Do you want to update?',
        default: true
      }
    );
  }

  await inquirer.prompt(questions).then((answers) => {
    if(answers.updateOverview && !dryRun) {
      fse.copySync(moliReleaseFolder, projectReleaseFolder);
    }

    version = answers.version;
    if(!dryRun) {
      packageJson.version = answers.version + '.0.0';

      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    }
  });

  const changes = await getGitCommits();
  //TODO Create changelog questions

})();

async function getGitCommits() {
  return new Promise((resolve, reject) => {
    exec(`git log -n 10 --pretty=format:'${JSON.stringify(defaultFormat)},'`, (err, stdout, stderr) => {
      if (err) reject(err);
      if (stderr) reject(stderr);
      stdout = stdout.replace(/\n/g, ' ');
      const consoleOutput = `[${stdout.slice(0, -1)}]`;

      //This regex escapes double quotes in the console output:
      //https://stackoverflow.com/questions/31195085/json-string-with-elements-containing-unescaped-double-quotes
      //This appears when a commit is reverted as the commit is: 'Revert: "COMMIT_MESSAGE"'
      const json = JSON.parse(consoleOutput.replace(new RegExp('(?<![\[\:\{\,])\"(?![\:\}\,])', 'g'), '\\\"'));


      // Get all git commits until the next tag
      let changes = [];

      for (let i = 0; i < json.length; i++) {
        const entry = json[i];
        if (!entry.refs.includes('tag')) {
          changes.push(entry);
        } else {
          break;
        }
      }

      resolve(changes);
    });
  });
}
