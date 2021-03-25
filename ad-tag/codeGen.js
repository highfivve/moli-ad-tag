const fs = require('fs');
const path = require('path');

// reads the package.json file and updates the version field
const packageJsonFile = fs.readFileSync('package.json');
const packageJson = JSON.parse(packageJsonFile);

console.log(packageJson.version);

const tsconfigJsonFile = fs.readFileSync('tsconfig.json');
const tsconfigJson = JSON.parse(tsconfigJsonFile);

const genCodeDirectory = path.join(tsconfigJson.compilerOptions.rootDir, 'gen');
fs.mkdirSync(genCodeDirectory);

const packageJsonTs = path.join(genCodeDirectory, 'packageJson.ts');

fs.writeFileSync(
  packageJsonTs,
  `export const packageJson = {
  version: '${packageJson.version}'
};
`
);
