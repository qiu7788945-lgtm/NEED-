const fs = require('fs');
const path = require('path');

const publicDir = '/app/applet/public';
const appTsxPath = '/app/applet/src/App.tsx';

const files = fs.readdirSync(publicDir);

const articleTitles = [
  '一家案例更大，一家更贴需求，该怎么选.md',
  '一家创意更强，一家执行更稳，怎么判断更适合你.md',
  '一家报价更高，一家报价更低，真正该比什么.md',
  '两家活动公司都不错，最后到底该怎么做决定.md'
];

let generatedCode = 'export const chooseBetweenTwoArticlesData = [\n';

articleTitles.forEach((filename, index) => {
  const title = filename.replace('.md', '');
  const content = fs.readFileSync(path.join(publicDir, filename), 'utf8');
  
  // Extract excerpt: find first non-heading paragraph
  const lines = content.split('\n');
  let excerpt = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
      excerpt = trimmed;
      break;
    }
  }

  generatedCode += `  {
    id: '0${index + 1}',
    title: '${title}',
    excerpt: '${excerpt.replace(/'/g, "\\'")}',
    content: \`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`
  }${index < 3 ? ',' : ''}\n`;
});

generatedCode += '];\n';

let appTsx = fs.readFileSync(appTsxPath, 'utf8');

const startIndex = appTsx.indexOf('export const chooseBetweenTwoArticlesData = [');
const endIndex = appTsx.indexOf('];', startIndex) + 2;

if (startIndex !== -1 && endIndex !== -1) {
  appTsx = appTsx.slice(0, startIndex) + generatedCode + appTsx.slice(endIndex);
  fs.writeFileSync(appTsxPath, appTsx);
  console.log('Successfully updated chooseBetweenTwoArticlesData in App.tsx');
} else {
  console.log('Could not find chooseBetweenTwoArticlesData block in App.tsx');
}

// Ensure the routes are also correct. The user said: "二选一怎么选的二级页面和三级页面"
// This means "How to Choose Between Two" secondary page, and tertiary pages for these articles.
