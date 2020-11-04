'use strict';

import program = require('commander');

import * as dircompare from 'dir-compare';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as child from 'child_process';
import { IPackageJson } from './types/packageJson';
import { IAdTagRelease, IReleasesJson } from './types/releasesJson';
import { Result } from 'dir-compare';

program
  .version('1.0.0')
  .description('Create a release for moli ad tag')
  .option('-D --dry', 'Dry run not creating a commit', false)
  .parse(process.argv);

const dryRun: boolean = program.dry;

// Parse releases.json (optional) and package.json (required)
let releasesJson: IReleasesJson;
let packageJson: IPackageJson;

try {
  releasesJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'releases.json')).toString()
  );
} catch (err) {
  releasesJson = {
    currentVersion: 0,
    versions: []
  };
}

try {
  packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json')).toString());
} catch (err) {
  console.error('package.json required to create moli ad tag release');
  throw err;
}

// Workaround as coalescing operator doesn't properly work with yarn.
let versions: IAdTagRelease[];
if (releasesJson.versions) {
  versions = releasesJson.versions;
} else {
  versions = [];
}

const packageJsonVersion: string = packageJson.version;
let version = Number(packageJsonVersion.split('.')[0]) + 1;

const refs = '%D';
const authorName = '%an';
const authorEmail = '%ae';
const subject = '%s';
const body = '%b';
const defaultFormat = { refs, subject, body, author: { name: authorName, email: authorEmail } };

const moliReleaseFolder: string = path.resolve(__dirname, '..', 'releases');
const projectReleaseFolder: string = path.resolve(process.cwd(), 'releases');

(async () => {
  const res: Result = dircompare.compareSync(moliReleaseFolder, projectReleaseFolder, {
    compareContent: true
  });

  const commitMessages: string[] = await getGitCommitMessages();

  let questions = [
    {
      type: 'number',
      name: 'version',
      message: 'Please enter the new version:',
      default: version
    },
    {
      type: 'editor',
      name: 'changes',
      message: 'Please enter your changes:',
      default: commitMessages.join('\n'),
      validate: (text: string) => {
        if (text.split('\n').length === 0) {
          return 'Please enter at least one change';
        }

        return true;
      }
    },
    {
      type: 'confirm',
      name: 'push',
      message: 'Do you want to push your changes?',
      default: false
    }
  ];

  if (!res.same) {
    questions.unshift({
      type: 'confirm',
      name: 'updateOverview',
      message: 'New version found for overview.hbs. Do you want to update?',
      default: true
    });
  }

  await inquirer
    .prompt(questions)
    .then((answers: { updateOverview: any; version: number; changes: string; push: any }) => {
      if (answers.updateOverview && !dryRun) {
        fse.copySync(moliReleaseFolder, projectReleaseFolder);
      }

      version = answers.version;

      const change: IAdTagRelease = {
        version: version,
        changelog: answers.changes.split('\n')
      };

      versions.unshift(change);

      const releasesJsonContent = {
        currentVersion: version,
        versions: versions
      };

      if (!dryRun) {
        packageJson.version = answers.version + '.0.0';
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

        fs.writeFileSync('releases.json', JSON.stringify(releasesJsonContent, null, 2));

        const pushString: string = answers.push ? `&& git push && git push origin v${version}` : '';

        child.exec(
          `git add package.json releases.json && git commit -m 'v${version}' && git tag -a v${version} -m v${version} ${pushString}`,
          (err, stdout, stderr) => {
            if (err) {
              console.log(err);
            } else {
              console.log('Successfully released new version');
            }
          }
        );
      }
    })
    .catch(error => {
      console.error(error);
    });
})();

/**
 * Returns a list of max. 10 git commit messages until the last tag that was pushed.
 */
async function getGitCommitMessages(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    child.exec(
      `git log -n 10 --pretty=format:'${JSON.stringify(defaultFormat)},'`,
      (err, stdout, stderr) => {
        if (err) {
          reject(err);
        }
        if (stderr) {
          reject(stderr);
        }
        stdout = stdout.replace(/\n/g, ' ');
        const consoleOutput = `[${stdout.slice(0, -1)}]`;

        // This regex escapes double quotes in the console output:
        // https://stackoverflow.com/questions/31195085/json-string-with-elements-containing-unescaped-double-quotes
        // This appears when a commit is reverted as the commit is: 'Revert: "COMMIT_MESSAGE"'
        const json = JSON.parse(
          consoleOutput.replace(new RegExp('(?<![[:{,])"(?![:},])', 'g'), '\\"')
        );

        // Get all git commit messages until the next tag
        let changes: string[] = [];

        for (let i = 0; i < json.length; i++) {
          const entry = json[i];
          if (!entry.refs.includes('tag')) {
            changes.push(entry.subject);
          } else {
            break;
          }
        }

        resolve(changes);
      }
    );
  });
}
