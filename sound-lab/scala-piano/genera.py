"""Scala dal disagio alla quiete, solo pianoforte (cartella in prova).

Sette livelli: i modi della scala su Do, dal piu' scuro al piu' chiaro
(locrio, frigio, eolio, dorico, misolidio, ionio, pentatonica maggiore).
A ogni passo cambia una sola nota; il registro sale e il ritmo rallenta.
Schema preso da una chiacchierata con un'altra IA, non da un paper: tutto [S]/[H].

Unico strumento: campioni registrati del Salamander Grand Piano (Yamaha C5,
Alexander Holm, CC BY 3.0), copia MP3 di Tone.js. Niente sintesi, niente
saturazione, niente detune, niente riverbero aggiunto: il carattere cambia solo
con registro, tempo, articolazione (staccato/legato/pedale) e accordi.

Uso (dalla cartella sound-lab):
  .venv/bin/python scala-piano/genera.py
Scrive in scala-piano/clip/ (non in git):
  01_locrio.wav ... 07_pentatonica.wav  loop di ogni livello
  scala.wav        le sette scale in salita, una dopo l'altra
  scala_continua.wav  una sola salita da Do1 a Do8, un'ottava per modo, senza ripartenze
  esercizio.wav    i 43 tasti dell'immagine, da Do1 a Do7, crome a 100 bpm, legato
  transizione.wav  i sette livelli in fila, dissolvenza di 2 s
"""
import os
import sys
import urllib.request

import librosa
import numpy as np
import pyloudnorm
import soundfile as sf

QUI = os.path.dirname(os.path.abspath(__file__))
CAMPIONI = os.path.join(QUI, 'campioni')
USCITA = os.path.join(QUI, 'clip')
URL = 'https://tonejs.github.io/audio/salamander/{}.mp3'
SR = 44100
TONICA = 0  # 0 = Do, come nella proposta. I brani dell'app sono in re: 2 [S]
LUFS = -18.0  # come gli altri modi musicali (audio.md)
PICCO_DB = -1.0
SEME = 2026

# Campioni disponibili: una nota ogni terza minore (La, Do, Re#, Fa#), da A0 a A7.
# C8 escluso: misurato a 4409 Hz invece di 4186 (quasi un Do#8) e con un rimbombo a
# 124 Hz piu' forte della nota; il Do8 si ricava da A7 (+3 semitoni). A7 e' a +38
# centesimi, come di solito sono accordate le note acute del pianoforte.
NOMI = {0: 'C', 3: 'Ds', 6: 'Fs', 9: 'A'}
MIDI_CAMPIONI = [m for m in range(21, 106) if m % 12 in NOMI]


def nome_campione(midi):
    return f'{NOMI[midi % 12]}{midi // 12 - 1}'


def scarica():
    os.makedirs(CAMPIONI, exist_ok=True)
    for m in MIDI_CAMPIONI:
        f = os.path.join(CAMPIONI, nome_campione(m) + '.mp3')
        if not os.path.exists(f):
            print('scarico', os.path.basename(f))
            urllib.request.urlretrieve(URL.format(nome_campione(m)), f)


_cache = {}


def campione(midi):
    if midi not in _cache:
        y, _ = librosa.load(os.path.join(CAMPIONI, nome_campione(midi) + '.mp3'), sr=SR, mono=False)
        if y.ndim == 1:
            y = np.stack([y, y])
        _cache[midi] = y
    return _cache[midi]


def nota_piano(midi, durata, rilascio):
    """Una nota del piano: campione piu' vicino, spostato al massimo di 1,5 semitoni (3 solo per Do8).
    durata = quando il tasto si lascia (s); rilascio = quanto smorza lo smorzatore (s)."""
    base = min(MIDI_CAMPIONI, key=lambda m: abs(m - midi))
    y = campione(base)
    rapporto = 2 ** ((midi - base) / 12)
    n = int(min(y.shape[1] / rapporto, (durata + rilascio) * SR))
    x = np.arange(n) * rapporto
    out = np.stack([np.interp(x, np.arange(y.shape[1]), c) for c in y])
    inviluppo = np.ones(n)
    i0 = int(durata * SR)
    if i0 < n:
        inviluppo[i0:] = np.linspace(1, 0, n - i0) ** 2
    return out * inviluppo


# I sette livelli. intervalli in semitoni dalla tonica; ottava = MIDI della tonica
# del registro (36 = Do2). passo = durata di una nota in battiti; tenuta = parte
# del passo col tasto giu'; rilascio in s; accordo suonato a ogni battuta. [S]
LIVELLI = [
    dict(nome='01_locrio', modo='Do locrio', intervalli=[0, 1, 3, 5, 6, 8, 10], ottava=36, estensione=1,
         bpm=120, passo=0.5, tenuta=0.45, rilascio=0.06, forza=1.0,
         cellula=[0, 1, 0, 4, 0, 1, 2, 4],  # Do Reb Do Solb: semitono e tritono in basso
         accordo=[0, 3, 6, 13], accordo_ottava=36),
    dict(nome='02_frigio', modo='Do frigio', intervalli=[0, 1, 3, 5, 7, 8, 10], ottava=36, estensione=2,
         bpm=100, passo=0.5, tenuta=0.6, rilascio=0.1, forza=0.9,
         cellula=[0, 1, 2, 1, 0, 5, 4, 1],
         accordo=[0, 3, 7], accordo_ottava=36),
    dict(nome='03_eolio', modo='Do eolio (minore naturale)', intervalli=[0, 2, 3, 5, 7, 8, 10], ottava=48,
         estensione=1, bpm=85, passo=0.5, tenuta=0.8, rilascio=0.2, forza=0.8,
         cellula=None, accordo=[0, 3, 7], accordo_ottava=36),
    dict(nome='04_dorico', modo='Do dorico', intervalli=[0, 2, 3, 5, 7, 9, 10], ottava=48, estensione=2,
         bpm=70, passo=1, tenuta=0.9, rilascio=0.4, forza=0.7,
         cellula=None, accordo=[0, 3, 7], accordo_ottava=48),
    dict(nome='05_misolidio', modo='Do misolidio', intervalli=[0, 2, 4, 5, 7, 9, 10], ottava=60, estensione=1,
         bpm=60, passo=1, tenuta=1.0, rilascio=1.0, forza=0.6,
         cellula=None, accordo=[0, 4, 7], accordo_ottava=48),
    dict(nome='06_ionio', modo='Do ionio (maggiore)', intervalli=[0, 2, 4, 5, 7, 9, 11], ottava=60, estensione=2,
         bpm=50, passo=2, tenuta=1.0, rilascio=2.0, forza=0.5,
         cellula=None, accordo=[0, 4, 7], accordo_ottava=60),
    dict(nome='07_pentatonica', modo='Do pentatonica maggiore', intervalli=[0, 2, 4, 7, 9], ottava=72,
         estensione=1, bpm=None, passo=None, tenuta=None, rilascio=4.0, forza=0.45,
         cellula=None, accordo=[0, 7, 14, 16], accordo_ottava=60),  # Do Sol Re Mi aperto (add9)
]
BATTUTE = 8  # 4/4


def gradi(liv):
    """Note MIDI della scala nel registro del livello."""
    out = []
    for o in range(liv['estensione']):
        out += [TONICA + liv['ottava'] + 12 * o + i for i in liv['intervalli']]
    return out + [TONICA + liv['ottava'] + 12 * liv['estensione']]


def eventi(liv, rng):
    """Lista di (tempo s, midi, durata s, rilascio s, guadagno) e lunghezza del loop in s."""
    ev = []
    scala = gradi(liv)
    if liv['bpm'] is None:  # livello 7: niente pulsazione, note lunghe a tempi irregolari
        lunghezza = 32.0
        accordo = [TONICA + liv['accordo_ottava'] + i for i in liv['accordo']]
        for k, m in enumerate(accordo):
            ev.append((k * 0.12, m, 6.0, liv['rilascio'], 0.5 * liv['forza']))
        t = 2.5
        while t < lunghezza - 2:
            ev.append((t, int(rng.choice(scala)), 3.0, liv['rilascio'], liv['forza']))
            t += rng.uniform(2.0, 4.5)
        return ev, lunghezza
    battito = 60 / liv['bpm']
    lunghezza = BATTUTE * 4 * battito
    passo = liv['passo'] * battito
    n = int(round(lunghezza / passo))
    accordo = [TONICA + liv['accordo_ottava'] + i for i in liv['accordo']]
    for b in range(BATTUTE):
        for m in accordo:
            ev.append((b * 4 * battito, m, 4 * battito * 0.9, liv['rilascio'], 0.55 * liv['forza']))
    grado = 0
    for k in range(n):
        if liv['cellula'] is not None:  # ostinato: la stessa cellula che gira
            g = liv['cellula'][k % len(liv['cellula'])]
        else:  # passeggiata sui gradi, passi piccoli
            grado = int(np.clip(grado + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(scala) - 1))
            g = grado
        accento = 1.0 if k % int(round(4 / liv['passo'])) == 0 else 0.8
        ev.append((k * passo, scala[g], passo * liv['tenuta'], liv['rilascio'], liv['forza'] * accento))
    return ev, lunghezza


def suona(ev, lunghezza, loop=True):
    coda = 8.0
    out = np.zeros((2, int((lunghezza + coda) * SR)))
    for t, m, d, r, g in ev:
        x = nota_piano(m, d, r) * g
        i = int(t * SR)
        out[:, i:i + x.shape[1]] += x[:, :out.shape[1] - i]
    if not loop:
        return out
    n = int(lunghezza * SR)  # la coda oltre la fine rientra all'inizio: loop senza scalino
    giro = out[:, :n].copy()
    resto = out[:, n:]
    giro[:, :resto.shape[1]] += resto[:, :n]
    return giro


def normalizza(x):
    misura = pyloudnorm.Meter(SR)
    lufs = misura.integrated_loudness(x.T)
    x = x * 10 ** ((LUFS - lufs) / 20)
    picco = np.max(np.abs(x))
    tetto = 10 ** (PICCO_DB / 20)
    if picco > tetto:
        x = x * tetto / picco
    return x, misura.integrated_loudness(x.T), 20 * np.log10(np.max(np.abs(x)))


def scrivi(nome, x):
    x, lufs, picco = normalizza(x)
    sf.write(os.path.join(USCITA, nome + '.wav'), x.T, SR, subtype='PCM_16')
    print(f'{nome:16s} {x.shape[1] / SR:5.1f} s  {lufs:6.1f} LUFS  picco {picco:5.1f} dBFS')
    return x


def main():
    scarica()
    os.makedirs(USCITA, exist_ok=True)
    loops = []
    for i, liv in enumerate(LIVELLI):
        ev, lunghezza = eventi(liv, np.random.default_rng(SEME + i))
        loops.append(scrivi(liv['nome'], suona(ev, lunghezza)))

    # scala.wav: le sette scale in salita, ognuna nel suo registro e al suo tempo
    ev, t = [], 0.0
    for liv in LIVELLI:
        passo = 60 / liv['bpm'] * min(liv['passo'], 1) if liv['bpm'] else 1.4
        for m in gradi(liv)[:len(liv['intervalli']) + 1]:
            ev.append((t, m, passo * (liv['tenuta'] or 1), liv['rilascio'], liv['forza']))
            t += passo
        t += 1.5
    scrivi('scala', suona(ev, t, loop=False)[:, :int((t + 3) * SR)])

    # scala_continua.wav: una sola salita senza ripartenze. Ogni modo ha un'ottava sua,
    # da Do1 (locrio) a Do8 (fine della pentatonica): tutta la tastiera. La nota d'arrivo
    # di un modo e' la partenza del successivo, suonata una volta. Durata, tenuta,
    # rilascio e forza scorrono nota per nota (geometrici) dal livello 1 al 7. [S]
    note = [TONICA + 24]
    for o, liv in enumerate(LIVELLI):
        note += [TONICA + 24 + 12 * o + i for i in liv['intervalli'][1:]] + [TONICA + 36 + 12 * o]
    primo, ultimo = LIVELLI[0], LIVELLI[-1]
    passo0, passo1 = 60 / primo['bpm'] * primo['passo'], 1.4
    ev, t = [], 0.0
    for k, m in enumerate(note):
        f = k / (len(note) - 1)
        geo = lambda a, b: a * (b / a) ** f
        passo = geo(passo0, passo1)
        ev.append((t, m, passo * geo(primo['tenuta'], 1.0), geo(primo['rilascio'], ultimo['rilascio']),
                   geo(primo['forza'], ultimo['forza'])))
        t += passo
    scrivi('scala_continua', suona(ev, t, loop=False)[:, :int((t + 4) * SR)])

    # esercizio.wav: i 43 tasti col pallino rosso nell'immagine dell'utente (2026-10-11),
    # letti pixel per pixel: da Do1 a Do7, sei modi un'ottava ciascuno (locrio -> ionio).
    # Come un esercizio fatto bene: tempo fisso, stesso tocco, legato (il tasto si lascia
    # 40 ms dopo aver premuto il successivo), ultima nota tenuta 2,5 s. [S]
    esercizio = [24, 25, 27, 29, 30, 32, 34, 36, 37, 39, 41, 43, 44, 46, 48, 50, 51, 53, 55, 56, 58,
                 60, 62, 63, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86, 88, 89, 91, 93, 95, 96]
    passo = 60 / 100 / 2  # crome a 100 bpm
    ev = [(k * passo, m, passo + 0.04 if k < len(esercizio) - 1 else 2.5, 0.12, 0.8)
          for k, m in enumerate(esercizio)]
    t = len(esercizio) * passo + 2.5
    scrivi('esercizio', suona(ev, t, loop=False)[:, :int((t + 0.5) * SR)])

    # transizione.wav: 12 s per livello, dissolvenza a potenza costante di 2 s
    tratto, dissolvenza = int(12 * SR), int(2 * SR)
    a = np.linspace(0, np.pi / 2, dissolvenza)
    out = np.tile(loops[0], 2)[:, :tratto]
    for x in loops[1:]:
        x = np.tile(x, 1 + tratto // x.shape[1])[:, :tratto]
        out[:, -dissolvenza:] = out[:, -dissolvenza:] * np.cos(a) + x[:, :dissolvenza] * np.sin(a)
        out = np.concatenate([out, x[:, dissolvenza:]], axis=1)
    scrivi('transizione', out)


if __name__ == '__main__':
    sys.exit(main())
