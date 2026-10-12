# Scala del disagio, solo pianoforte (cartella in prova)

Cartella nuova, **in prova**: non è collegata all'app e non è una decisione presa.
Si ascolta e si giudica prima di usarla.

Sette livelli, dal disagio alla quiete, tutti su Do: locrio, frigio, eolio,
dorico, misolidio, ionio, pentatonica maggiore. A ogni passo cambia una sola
nota, il registro sale e il ritmo rallenta. Lo schema viene da una conversazione
con un'altra IA, non da un paper: i parametri sono scelte nostre [S] o ipotesi [H].

Suona **solo un pianoforte vero**: campioni del Salamander Grand Piano
(Yamaha C5, Alexander Holm, CC BY 3.0, copia di Tone.js). Niente sintesi né effetti.
Se si usa nell'app va citato.

```bash
cd sound-lab && .venv/bin/python scala-piano/genera.py   # ~10 s
```

Scrive in `clip/` (fuori da git): `01_locrio.wav` … `07_pentatonica.wav` (loop),
`scala.wav` (le sette scale in salita), `scala_continua.wav` (una sola salita da Do1 a Do8, un’ottava per modo), `transizione.wav` (i sette livelli in fila).
