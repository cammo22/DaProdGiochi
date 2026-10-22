// Prova del controllo aggiornamenti periodico della suite, senza Electron e senza rete.
// Uso: pnpm --filter @daprod/shell build   (o: cd apps/shell && npx tsc -p tsconfig.main.json)
//      node scripts/prova-aggiornamenti.cjs
const Module = require("node:module");
const EventEmitter = require("node:events");
const path = require("node:path");

// electron e electron-updater finti: registro i controlli e decido se la «rete» c'è
const rete = { su: true, versione: "9.9.9", controlli: 0 };
const finto = new EventEmitter();
finto.autoDownload = false;
finto.autoInstallOnAppQuit = false;
finto.checkForUpdates = async () => {
  rete.controlli++;
  finto.emit("checking-for-update");
  if (!rete.su) { const e = new Error("net::ERR_INTERNET_DISCONNECTED"); finto.emit("error", e); throw e; }
  finto.emit("update-available", { version: rete.versione });
};
const origine = Module._load;
Module._load = function (richiesta, ...resto) {
  if (richiesta === "electron") return { app: { isPackaged: true, getVersion: () => "1.7.9" } };
  if (richiesta === "electron-updater") return { autoUpdater: finto };
  return origine.call(this, richiesta, ...resto);
};

// tempo finto
const timers = []; let ora = 0;
global.setInterval = (f, ms) => { const t = { f, ms, prossimo: ora + ms, unref() {} }; timers.push(t); return t; };
const avanza = async (ms) => {
  const fine = ora + ms;
  for (;;) {
    const t = timers.filter((x) => x.prossimo <= fine).sort((a, b) => a.prossimo - b.prossimo)[0];
    if (!t) break;
    ora = t.prossimo; t.prossimo += t.ms; t.f();
    await new Promise((r) => setImmediate(r));
  }
  ora = fine;
};

const { updater } = require(path.resolve(__dirname, "../apps/shell/out/main/updater.js"));
let ok = true;
const verifica = (nome, c) => { console.log((c ? "OK   " : "FAIL ") + nome); if (!c) ok = false; };

(async () => {
  await updater.check();
  verifica("all'avvio controlla (1) e trova " + rete.versione, rete.controlli === 1 && updater.getState().status === "disponibile" && updater.getState().availableVersion === "9.9.9");
  updater.startPeriodicCheck();
  updater.startPeriodicCheck();
  verifica("un solo timer anche chiamando due volte", timers.length === 1);
  await avanza(3 * 3600_000);
  verifica("dopo 3 ore non richiama", rete.controlli === 1);
  await avanza(1.1 * 3600_000);
  verifica("dopo 4 ore ricontrolla", rete.controlli === 2);
  rete.su = false;
  await avanza(4 * 3600_000);
  verifica("offline: nessuna eccezione, stato in-errore, riprovato", rete.controlli === 3 && updater.getState().status === "in-errore");
  rete.su = true;
  await avanza(4 * 3600_000);
  verifica("torna la rete: di nuovo disponibile", rete.controlli === 4 && updater.getState().status === "disponibile");
  finto.emit("download-progress", { percent: 40 });
  await avanza(4 * 3600_000);
  verifica("durante lo scaricamento non disturba", rete.controlli === 4);
  finto.emit("update-downloaded", { version: "9.9.9" });
  await avanza(8 * 3600_000);
  verifica("con la versione già pronta non ricontrolla", rete.controlli === 4);
  process.exit(ok ? 0 : 1);
})();
