'use strict';

import program = require('commander');

import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs';
import * as child from 'child_process';
import { IPackageJson } from './types/packageJson';
import { IAdTagRelease, IReleasesJson } from './types/releasesJson';
import { gitLogFormat, IGitJsonLog } from './types/gitJson';

import { sendSlackMessage } from '@highfivve/utils-send-slack-message';

const CYAN_ESC = '\x1b[36m%s\x1b[0m';

program
  .version('1.1.0')
  .description('Create a release for moli ad tag')
  .option('-D, --dry', 'Dry run not creating a commit', false)
  .option('-P, --publishername [publishername]', 'Publisher name')
  .option('-S, --slack [channel name]', 'Name of the slack channel with the publisher')
  .parse(process.argv);

const options = program.opts();
const dryRun: boolean = options.dry;
const publisherNameFromArgs: string | undefined = options.publishername;
const slackChannelFromArgs: string | undefined = options.slack;

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
    publisherName: '',
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

(async () => {
  let commitMessages: string[] = await getGitCommitMessages();

  // If more than 10 commit messages were found and no tag was assigned to one of these, we ask the user how many commits he wants to check.
  if (commitMessages.length >= 10) {
    await inquirer
      .prompt([
        {
          type: 'number',
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

  // If the publisherName in the releases.json isn't defined yet, we'll ask the user here.
  if (releasesJson.publisherName === '' || !releasesJson.publisherName) {
    const publisher: string =
      publisherNameFromArgs ||
      (await inquirer
        .prompt([
          {
            type: 'input',
            name: 'publisher',
            message: 'What is the name of the publisher in this project?'
          }
        ])
        .then((answers: { publisher: string }) => answers.publisher));

    releasesJson = {
      ...releasesJson,
      publisherName: publisher
    };
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
    }
  ];

  // on dry runs, we don't push anyways
  if (!dryRun) {
    questions.push({
      type: 'confirm',
      name: 'push',
      message: 'Do you want to push your changes?',
      default: false as any
    });
  }

  await inquirer
    .prompt(questions)
    .then(async (answers: { version: number; changes: string; push: any }) => {
      version = answers.version;

      // run lint before releasing
      child.execSync('yarn lint');

      // run build to generate manifest.json and check if build works
      child.execSync('yarn build');

      // Create the name of the moli.js file (this contains a random hash to ensure an immutable tag when a tag gets deleted)
      const manifestPath = path.join(process.cwd(), 'dist', 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return Promise.reject(`${manifestPath} file does not exist!`);
      }
      const manifestFile = fs.readFileSync(manifestPath);
      const manifestJson = JSON.parse(manifestFile as any); // yes, we can
      const filename = manifestJson.moli; // moli is the ad tag name by convention

      const manifestPathEs5 = path.join(process.cwd(), 'dist', 'manifest.es5.json');

      const manifestFileEs5: Buffer | undefined = fs.existsSync(manifestPathEs5)
        ? fs.readFileSync(manifestPathEs5)
        : undefined;
      const manifestJsonEs5: { moli_es5: string } | undefined = manifestFileEs5
        ? JSON.parse(manifestFileEs5.toString())
        : undefined; // yes, we can
      const filenameEs5 = manifestJsonEs5?.moli_es5; // moli_es5 is the ES5 ad tag name by convention

      const change: IAdTagRelease = {
        version: version,
        filename: filename,
        filenameEs5: filenameEs5,
        changelog: answers.changes.split('\n').filter(element => element !== '')
      };

      versions.unshift(change);

      const releasesJsonContent: IReleasesJson = {
        currentVersion: version,
        currentFilename: filename,
        currentFilenameEs5: filenameEs5,
        publisherName: releasesJson.publisherName,
        versions: versions
      };

      packageJson.version = version + '.0.0';

      const packageJsonNewContents = JSON.stringify(packageJson, null, 2);
      const releasesJsonNewContents = JSON.stringify(releasesJsonContent, null, 2);
      const versionJsonNewContents = JSON.stringify({ currentVersion: version }, null, 2);

      // The tagName for the commit including the name of the publisher and the version.
      const tagName: string = `${releasesJsonContent.publisherName}-v${version}`;

      if (dryRun) {
        console.log(CYAN_ESC, '>>> DRY RUN <<<');
        console.log(CYAN_ESC, 'Projected package.json contents:');
        console.log(packageJsonNewContents);
        console.log(CYAN_ESC, 'Projected releases.json contents:');
        console.log(releasesJsonNewContents);
        console.log(CYAN_ESC, 'Projected version.json contents:');
        console.log(versionJsonNewContents);
        console.log(CYAN_ESC, 'Projected git tag name:');
        console.log(tagName);
        console.log(CYAN_ESC, '>>> DRY RUN FINISHED <<<');
      } else {
        fs.writeFileSync('package.json', packageJsonNewContents);
        fs.writeFileSync('releases.json', releasesJsonNewContents);
        fs.writeFileSync('version.json', versionJsonNewContents);

        const pushString: string = answers.push ? `&& git push && git push origin ${tagName}` : '';

        await child.exec(
          `git add package.json releases.json version.json && git commit -m 'v${version}' && git tag -a ${tagName} -m ${tagName} ${pushString}`,
          async (err, _stdout, _stderr) => {
            if (err) {
              console.log(err);
            } else {
              await sendSlackMessage({
                release: change,
                publisherName: releasesJson.publisherName,
                slackChannel: slackChannelFromArgs
              });
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
        stdout = stdout.replace(/(\r\n|\r|\n|\t)/g, ' ');
        const consoleOutput = `[${stdout.slice(0, -1)}]`;

        // This regex escapes double quotes in the console output:
        // https://stackoverflow.com/questions/31195085/json-string-with-elements-containing-unescaped-double-quotes
        // This appears when a commit is reverted as the commit is: 'Revert: "COMMIT_MESSAGE"'
        const json = JSON.parse(
          consoleOutput.replace(new RegExp('(?<![[:{,])"(?![:},])', 'g'), '\\"')
        );

        // Get all git commit messages until the last tag
        const commits = Array.from<IGitJsonLog>(json);
        const changes: string[] = [];

        // This is basically a takeWhile functionality since we break the for-loop when the first tag appears.
        for (let { refs, subject } of commits) {
          if (!refs.includes('tag')) {
            changes.push(subject);
          } else {
            break;
          }
        }

        resolve(changes);
      }
    );
  });
}
