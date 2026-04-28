const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === 'function HowToChoosePage() {') {
    // found the first one at 861.
    // keep iterating.
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] === 'function HowToChoosePage() {') {
        startIndex = j;
        break;
      }
    }
    break;
  }
}

if (startIndex !== -1) {
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i] === 'function ChooseArticlePage() {') {
      endIndex = i - 1; // remove blank line before it maybe. The '}' is around i - 2.
      break;
    }
  }
}

// And also let's just grep for SolutionsPage route and remove it
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<Route path="/solutions" element={<SolutionsPage />} />')) {
    lines.splice(i, 1);
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  console.log('Fixing second HowToChoosePage between indices', startIndex, endIndex);
  lines.splice(startIndex, endIndex - startIndex);
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
  console.log('Done.');
} else {
  console.log('Failed to find indices', { startIndex, endIndex });
}
