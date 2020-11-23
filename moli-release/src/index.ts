'use strict';

import program = require('commander');

import * as dircompare from 'dir-compare';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as child from 'child_process';
import * as crypto from 'crypto';
import { IPackageJson } from './types/packageJson';
import { IAdTagRelease, IReleasesJson } from './types/releasesJson';
import { Result } from 'dir-compare';
import { gitLogFormat, IGitJsonLog } from './types/gitJson';

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
  console.error(
    `Failed to read releases.json. If the file doesn't exist yet, you can ignore this message.`
  );

  releasesJson = {
    currentVersion: 0,
    currentFilename: '',
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
const versions: IAdTagRelease[] = releasesJson.versions ? releasesJson.versions : [];

const packageJsonVersion: string = packageJson.version;
let version = Number(packageJsonVersion.split('.')[0]) + 1;

const moliReleaseFolder: string = path.resolve(__dirname, '..', 'releases');
const projectReleaseFolder: string = path.resolve(process.cwd(), 'releases');

(async () => {
  const res: Result = dircompare.compareSync(moliReleaseFolder, projectReleaseFolder, {
    compareContent: true
  });

  let commitMessages: string[] = await getGitCommitMessages();

  // If more than 10 commit messages were found and no tag was assigned to one of these, we ask the user how many commits he wants to check.
  if (commitMessages.length >= 10) {
    await inquirer
      .prompt([
        {
          type: 'confirm',
          name: 'commit',
          message:
            'How many commit messages do you want to check until the last tag? (There were at least 10 commits and no tag was found)',
          default: 10
        }
      ])
      .then(async (answers: { commit: number }) => {
        commitMessages = await getGitCommitMessages(answers.commit);
      });
  }

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

      // Create the name of the moli.js file (this contains a random hash to ensure an immutable tag when a tag gets deleted)
      const hash = crypto.randomBytes(20).toString('hex');
      const filename = `moli_${hash}.js`;

      const change: IAdTagRelease = {
        version: version,
        filename: filename,
        changelog: answers.changes.split('\n')
      };

      versions.unshift(change);

      const releasesJsonContent: IReleasesJson = {
        currentVersion: version,
        currentFilename: filename,
        versions: versions
      };

      if (!dryRun) {
        packageJson.version = answers.version + '.0.0';
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

        fs.writeFileSync('releases.json', JSON.stringify(releasesJsonContent, null, 2));

        const pushString: string = answers.push ? `&& git push && git push origin v${version}` : '';

        child.exec(
          `git add package.json releases.json && git commit -m 'v${version}' && git tag -a v${version} -m v${version} ${pushString}`,
          (err, _stdout, _stderr) => {
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
 * @param numberOfCommits The number of commits we check for to find the last tag.
 */
async function getGitCommitMessages(numberOfCommits: number = 10): Promise<string[]> {
  return new Promise((resolve, reject) => {
    child.exec(
      `git log -n ${numberOfCommits} --pretty=format:'${JSON.stringify(gitLogFormat)},'`,
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

        // Get all git commit messages until the last tag
        const changes: string[] = Array.from<IGitJsonLog>(json)
          .filter(({ refs }) => !refs.includes('tag'))
          .map(({ subject }) => subject);

        resolve(changes);
      }
    );
  });
}
