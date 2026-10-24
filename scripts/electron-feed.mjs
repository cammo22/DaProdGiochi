import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compatibilità per le installazioni Electron 1.x, anche dopo la rinomina del repo.
export async function createFeed(installer, destination, version) {
  if (!version) version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Versione non valida');
  const file=await readFile(installer);
  if (!installer.endsWith('.exe') || file.subarray(0,2).toString()!=='MZ') throw Error('Serve un installer Windows valido');
  const name=basename(installer),sha512=createHash('sha512').update(file).digest('base64');
  const info=await stat(installer);
  const body=`version: ${JSON.stringify(version)}\nfiles:\n  - url: ${JSON.stringify(name)}\n    sha512: ${sha512}\n    size: ${info.size}\npath: ${JSON.stringify(name)}\nsha512: ${sha512}\nreleaseDate: ${JSON.stringify(info.mtime.toISOString())}\nreleaseNotes: "DaProdGiochi sostituisce la Suite: completa l'installer e avvia DaProdGiochi dal nuovo collegamento. I dati della Suite restano disponibili per l'importazione."\n`;
  await writeFile(destination,body);
  return {version,name,sha512,size:info.size};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]||!process.argv[3]) throw Error('Uso: node scripts/electron-feed.mjs installer.exe latest.yml [versione]');
  console.log(await createFeed(process.argv[2],process.argv[3],process.argv[4]));
}
