import { Lang } from './Lang.js';

const cmd = process.argv[2];
const lang = process.argv[3] ?? 'en';

langProcess(cmd, lang)
  .then(() => console.log('complete'));

async function langProcess(cmd, lang) {
  switch (cmd) {
    case 'exportLetterTree':
      await Lang.exportLetterTree(lang);
      break;

    case undefined:
      console.log(`Usage: ${process.argv[1]}' <cmd> [language-code (default en)]`);
      break;

    default:
      console.log(`Unknown command '${cmd}'`);
  }
}

