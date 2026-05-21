const fs = require('fs');
const path = require('path');

const mapping = {
  'bg-zinc-950': 'bg-background',
  'bg-zinc-900': 'bg-card',
  'bg-zinc-800/50': 'bg-muted/50',
  'bg-zinc-800': 'bg-muted',
  'bg-zinc-100': 'bg-primary',
  'border-zinc-800': 'border-border',
  'border-zinc-700': 'border-border',
  'text-zinc-100': 'text-foreground',
  'text-zinc-300': 'text-muted-foreground',
  'text-zinc-400': 'text-muted-foreground',
  'text-zinc-500': 'text-muted-foreground',
  'text-zinc-600': 'text-muted-foreground',
  'text-zinc-900': 'text-primary-foreground',
  'hover:bg-zinc-800/50': 'hover:bg-muted/50',
  'hover:bg-zinc-800': 'hover:bg-accent',
  'hover:bg-zinc-700': 'hover:bg-accent',
  'hover:bg-zinc-300': 'hover:bg-primary/90',
  'hover:text-white': 'hover:text-accent-foreground',
  'focus-visible:ring-zinc-700': 'focus-visible:ring-ring',
  'stroke-zinc-800': 'stroke-border',
  'bg-[#1c1c1e]': 'bg-background',
  'text-neutral-50': 'text-foreground'
};

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = dir + '/' + file;
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const [zinc, semantic] of Object.entries(mapping)) {
        // Regex to match whole words/classes but carefully handle special chars
        const escapedZinc = zinc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<=\\s|["'\`])${escapedZinc}(?=\\s|["'\`])`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, semantic);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('app');
processDir('components');
