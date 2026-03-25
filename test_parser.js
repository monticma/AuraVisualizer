import { CParser } from './analyzer/parsers/c-parser.js';
import fs from 'fs';

const parser = new CParser();
const path = '/Users/max/dev/ThorDev/ThorV2/Backup/deadcode_2-6/ThorPrimitiveBindings.c';
try {
    const file = { path: path, content: fs.readFileSync(path, 'utf8') };
    const symbols = parser.extractSymbols(file);

    const functions = symbols.functions.map(f => f.name);
    console.log("Functions found:", functions.length);
    
    const badNames = ['if', 'for', 'while', 'return', 'switch'];
    let failed = false;
    for (const bad of badNames) {
        if (functions.includes(bad)) {
            console.error(`FAIL: found '${bad}' as function`);
            failed = true;
        }
    }
    
    // Also check for 1-character names that might be false positives
    const shortNames = functions.filter(f => f.length === 1);
    console.log("1-char functions:", shortNames.join(', '));
    
    if (!failed) {
        console.log("SUCCESS: Builtin keywords not found in functions array.");
    }
} catch (err) {
    console.error("Error reading test file:", err.message);
}
