const fs = require('fs');
const path = require('path');

// Read the file
function fixFile(filePath) {
  console.log(`Fixing file: ${filePath}`);
  
  // Read the file content
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix console.log statements with string literals
  content = content.replace(/console\.log\("([^"]*)\$\{([^}]*)\}([^"]*)"\)/g, 'console.log(`$1${$2}$3`)');
  
  // Fix other template literals in the files
  // Fix the ending quotation marks in template literals (where `..."); is used)
  content = content.replace(/(`[^`]*)\");/g, '$1`);');
  
  // Write the file back
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${filePath}`);
}

// Paths to fix
const filesToFix = [
  'src/openShadowDiffCommand.ts',
  'src/workingDiffCommand.ts'
];

// Fix each file
filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixFile(fullPath);
  } else {
    console.error(`File not found: ${fullPath}`);
  }
});
