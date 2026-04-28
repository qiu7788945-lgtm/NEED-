const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('如果你现在正在看方案，也可以先把你最担心的执行问题发过来。先把流程、风险和落地方式讲清楚，通常比最后在现场补锅更值。`')) {
    startIndex = i + 2; // lines[i] is line 830. lines[i+1] is `  }`, lines[i+2] is `];...`
    break;
  }
}

for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes('export const chooseBetweenTwoArticlesData = [')) {
    for (let j = i - 1; j >= startIndex; j--) {
      // Find the last exact match or closest to `];`
      if (lines[j].trim() === '];') {
        endIndex = j;
        break;
      }
    }
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  console.log('Fixing between indices', startIndex, endIndex);
  
  lines[startIndex] = '];';
  
  lines.splice(startIndex + 1, endIndex - startIndex);
  
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
  console.log('Done.');
} else {
  console.log('Failed to find indices', { startIndex, endIndex });
}
