// Lista degli eventi di Sottotraccia per lo strumento di prova (genera.py la chiama):
//   echo '{"seme":2026,"durata":20,"fotogrammi":[{"t":0,"X":1,"Y":1,"H":0,"I":0}]}' | node sound-lab/sottotraccia/eventi.mjs
// Stesse regole e stesso pianificatore dell'app (src/audio/sottotraccia-eventi.js): una sola fonte.
// Con più fotogrammi, gli ingressi sono interpolati linearmente nel tempo.
import { Pianificatore, ingressiAl } from '../../src/audio/sottotraccia-eventi.js';

let input = '';
for await (const pezzo of process.stdin) input += pezzo;
const { seme, durata, fotogrammi } = JSON.parse(input);

const pianificatore = new Pianificatore({
    seme,
    ingressi: fotogrammi[0],
    obiettivoA: t => ingressiAl(t, fotogrammi),
});
const eventi = pianificatore.avanza(durata).filter(e => e.t < durata);
process.stdout.write(JSON.stringify(eventi));
