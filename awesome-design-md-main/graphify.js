const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const dirPath = path.join(__dirname, 'design-md');

function sanitize(text) {
  if (!text) return 'Item';
  return `"${text.replace(/"/g, "'")}"`;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    console.log(`Skipping ${filePath}, no frontmatter found.`);
    return;
  }

  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    console.log(`Skipping ${filePath}, no end of frontmatter found.`);
    return;
  }

  const frontmatterRaw = content.substring(4, endIdx);
  const markdownBody = content.substring(endIdx + 4).trim();
  
  let data;
  try {
    data = yaml.load(frontmatterRaw);
  } catch (e) {
    console.error(`Error parsing YAML in ${filePath}:`, e.message);
    return;
  }

  const name = data.name || 'Design System';
  
  let mermaid = `\`\`\`mermaid\nmindmap\n  root((${sanitize(name)}))\n`;
  
  if (data.colors && Object.keys(data.colors).length > 0) {
    mermaid += `    Colors\n`;
    Object.keys(data.colors).slice(0, 10).forEach(key => {
      mermaid += `      (${sanitize(key)})\n`;
    });
    if (Object.keys(data.colors).length > 10) mermaid += `      (And more...)\n`;
  }
  
  if (data.typography && Object.keys(data.typography).length > 0) {
    mermaid += `    Typography\n`;
    Object.keys(data.typography).slice(0, 10).forEach(key => {
      mermaid += `      (${sanitize(key)})\n`;
    });
    if (Object.keys(data.typography).length > 10) mermaid += `      (And more...)\n`;
  }

  if (data.components && Object.keys(data.components).length > 0) {
    mermaid += `    Components\n`;
    Object.keys(data.components).slice(0, 10).forEach(key => {
      mermaid += `      (${sanitize(key)})\n`;
    });
    if (Object.keys(data.components).length > 10) mermaid += `      (And more...)\n`;
  }
  mermaid += `\`\`\``;

  // Reconstruct file
  let newMarkdown = markdownBody;
  
  // Remove existing Title if it exists to replace with a standard one
  newMarkdown = newMarkdown.replace(/^#\s+.*?\n+/, '');

  const newContent = `---
${frontmatterRaw.trim()}
---

# ${name}

## System Architecture
${mermaid}

${newMarkdown}
`;

  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`Processed ${filePath}`);
}

const folders = fs.readdirSync(dirPath, { withFileTypes: true });

folders.forEach(folder => {
  if (folder.isDirectory()) {
    const filePath = path.join(dirPath, folder.name, 'DESIGN.md');
    if (fs.existsSync(filePath)) {
      processFile(filePath);
    }
  }
});

console.log('All done!');
