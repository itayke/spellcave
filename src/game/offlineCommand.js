import { LanguageTree } from './LanguageTree.js';

const cmd = process.argv[2];
const lang = process.argv[3] ?? 'en';

const startTime = performance.now();
offlineCommand(cmd, lang)
  .then(() => console.log(`Command complete in ${((performance.now() - startTime) / 1000).toFixed(3)}s`));

async function offlineCommand(cmd, lang) {
  switch (cmd) {
    case 'exportTree':
    case 'testTree':
      await LanguageTree[cmd](lang);
      break;

    case undefined:
      console.log(`Usage: ${process.argv[1]}' <cmd> [language-code (default en)]`);
      break;

    default:
      console.log(`Unknown command '${cmd}'`);
  }
}

