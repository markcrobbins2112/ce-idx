const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const prefix = process.argv[2];

if (!prefix) {
    console.error('Usage: node unzip-latest.js <prefix>');
    process.exit(1);
}

const files = fs.readdirSync('.')
    .filter(file => file.startsWith(prefix) && file.endsWith('.zip'))
    .map(file => ({
        name: file,
        time: fs.statSync(file).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

if (files.length === 0) {
    console.error(`No zip files found starting with "${prefix}"`);
    process.exit(1);
}

const latestFile = files[0].name;
const fullPath = path.resolve(latestFile);

console.log(`Most recent file: ${latestFile}`);
console.log(`Unzipping to current directory: ${process.cwd()}`);

try {
    const zip = new AdmZip(fullPath);
    zip.extractAllTo('.', true);
    console.log('Successfully unzipped and overwrote files.');
    fs.unlinkSync(fullPath);
    console.log(`Deleted zip file: ${latestFile}`);
} catch (error) {
    console.error('Error unzipping file:', error.message);
    process.exit(1);
}
