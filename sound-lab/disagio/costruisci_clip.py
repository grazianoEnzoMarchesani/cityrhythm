# Clip di test per la mappa sonora: 9 stati x 2 versioni, 20 s ciascuna, codici casuali (chiave a parte).
# A = sistema attuale con musica classica: il brano dello stato + gli effetti come in sound-lab/mix.json.
# B = un solo brano (Menuetto di Haydn, come Routine) per tutti gli stati, con le sole leve del disagio,
#     ESAGERATE apposta. Le quantità in dB di B sono scelte nostre per un test estremo: non vengono dalla
#     letteratura. Fanno eccezione il 100% di modulazione a 70 Hz (riferimento di Fastl: 1 asper) e
#     la zona 30-80 Hz (Arnal 2015; Fastl cap. 11).
# Uso (dalla cartella sound-lab):  .venv/bin/python disagio/costruisci_clip.py
import glob, json, os, subprocess
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import lfilter, resample_poly

SR = 44100
DUR = 20.0
N = int(SR * DUR)
XF = 1.0            # dissolvenza incrociata fra due effetti (s), come in app
MUSICA_LUFS = -18.0
BASE = 'routine'    # brano comune a tutte le B: Menuetto di Haydn
SEED = 2026

HERE = os.path.dirname(os.path.abspath(__file__))
CLASSICA = os.path.join(HERE, '..', '..', 'public', 'audio', 'classica')
SFX = os.path.join(HERE, '..', 'sfx')
OUT = os.path.join(HERE, 'clip')
mix = json.load(open(os.path.join(HERE, '..', 'mix.json')))
meter = pyln.Meter(SR)

STATI = ['rifugio', 'passeggiata', 'festa', 'attesa', 'routine',
         'corrente', 'afa', 'fatica', 'calca', 'notte']

GRUPPO = {'folla-leggera': 'folla-leggera-*.mp3', 'folla-densa': 'folla-densa-*.mp3',
          'traffico': 'traffico-*.mp3', 'parco': 'parco-*.mp3',
          'cicale': 'cicale-*.mp3', 'grilli': 'grilli-*.mp3'}

# Versione B: livelli in dB rispetto alla musica di B (scelte nostre, esagerate).
#   musica:  guadagno del brano comune
#   livelli: gruppi di effetti e il loro livello rispetto alla musica
#   rumore:  (banda bassa Hz, banda alta Hz, livello rispetto alla musica): ronzio fermo, senza eventi
#   acuti:   dB di esaltazione sopra 3 kHz (nitidezza, Fastl cap. 9)
#   ruvido:  profondità della modulazione a 70 Hz (1,0 = 100% = 1 asper, riferimento di Fastl)
B = {
    'rifugio':     dict(musica=0,   livelli={'parco': -12}),
    'passeggiata': dict(musica=0,   livelli={'folla-leggera': -10, 'parco': -12}),
    'festa':       dict(musica=0,   livelli={'folla-densa': -6, 'folla-leggera': -10}),
    'attesa':      dict(musica=-3,  livelli={'traffico': -20}),
    'routine':     dict(musica=0,   livelli={}),
    'corrente':    dict(musica=0,   livelli={'folla-densa': -3, 'traffico': -6}),
    'afa':         dict(musica=-6,  livelli={'cicale': -6}, rumore=(2500, 3500, -8)),
    'fatica':      dict(musica=-3,  livelli={'folla-leggera': -6, 'traffico': -9}, acuti=9),
    'calca':       dict(musica=0,   livelli={'folla-densa': 6, 'traffico': -3}, acuti=6, ruvido=1.0),
    'notte':       dict(musica=-12, livelli={'grilli': -6, 'traffico': -20}),
}


def carica(path):
    x, sr = sf.read(path, dtype='float64', always_2d=True)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    return x[:, :2]


def to_lufs(x, target):
    return x * 10 ** ((target - meter.integrated_loudness(x)) / 20)


def fade(x, fin=0.3, fout=0.5):
    g = np.ones(len(x))
    a, b = int(fin * SR), int(fout * SR)
    g[:a] = np.linspace(0, 1, a)
    g[-b:] = np.linspace(1, 0, b)
    return x * g[:, None]


def tile(varianti, xf=XF):
    # Alterna le varianti di un effetto (in ordine ciclico) con dissolvenza a potenza costante.
    xs = int(xf * SR)
    out = np.zeros((N + 10 * SR, 2))
    fin = np.sin(np.linspace(0, np.pi / 2, xs))[:, None]
    fout = np.cos(np.linspace(0, np.pi / 2, xs))[:, None]
    s, k = 0, 0
    while s < N:
        v = varianti[k % len(varianti)].copy()
        k += 1
        v[:xs] *= fin
        v[-xs:] *= fout
        out[s:s + len(v)] += v
        s += len(v) - xs
    return out[:N]


def varianti(gruppo, target):
    files = sorted(glob.glob(os.path.join(SFX, GRUPPO[gruppo])))
    return [to_lufs(carica(f), target) for f in files]


def band_noise(lo, hi, seed):
    r = np.random.default_rng(seed)
    f = np.fft.rfftfreq(N, 1 / SR)
    spec = np.fft.rfft(r.standard_normal(N)) * ((f >= lo) & (f <= hi))
    y = np.fft.irfft(spec, n=N)
    return np.repeat(y[:, None], 2, axis=1)


def high_shelf(x, fc=3000.0, gain_db=6.0):
    # Esaltazione degli acuti (cookbook RBJ, pendenza 1)
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    alpha = np.sin(w0) / 2 * np.sqrt(2)
    c = np.cos(w0)
    b = np.array([A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * alpha),
                  -2 * A * ((A - 1) + (A + 1) * c),
                  A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * alpha)])
    a = np.array([(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * alpha,
                  2 * ((A - 1) - (A + 1) * c),
                  (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * alpha])
    return lfilter(b / a[0], a / a[0], x, axis=0)


def am(x, f=70.0, m=1.0):
    # Modulazione d'ampiezza: m = 1 è il 100% (riferimento di Fastl, 1 asper)
    t = np.arange(len(x)) / SR
    return x * ((1 + m * np.sin(2 * np.pi * f * t)) / (1 + m))[:, None]


def clip_A(stato):
    musica = fade(to_lufs(carica(os.path.join(CLASSICA, stato + '.mp3'))[:N], MUSICA_LUFS))
    strati, dettagli = [musica], []
    for gruppo, presenza in mix['scene'][stato].items():
        target = MUSICA_LUFS - mix['sotto_musica_db'][gruppo] + 20 * np.log10(presenza)
        strati.append(tile(varianti(gruppo, target)))
        dettagli.append({'gruppo': gruppo, 'presenza': presenza, 'target_lufs': round(target, 1)})
    return sum(strati), {'brano': stato + '.mp3', 'effetti_da_mix': dettagli}


def clip_B(stato):
    s = B[stato]
    m_lufs = MUSICA_LUFS + s['musica']
    base = carica(os.path.join(CLASSICA, BASE + '.mp3'))[:N]
    strati = [fade(to_lufs(base, m_lufs))]
    dettagli = []
    for gruppo, rel in s['livelli'].items():
        strati.append(tile(varianti(gruppo, m_lufs + rel)))
        dettagli.append({'gruppo': gruppo, 'rispetto_musica_db': rel})
    if 'rumore' in s:
        lo, hi, rel = s['rumore']
        strati.append(to_lufs(band_noise(lo, hi, SEED), m_lufs + rel))
        dettagli.append({'gruppo': f'ronzio {lo}-{hi} Hz (fermo)', 'rispetto_musica_db': rel})
    x = sum(strati)
    params = {'brano': BASE + '.mp3 (Haydn)', 'musica_db': s['musica'], 'strati': dettagli}
    # Acuti e modulazione non devono cambiare il volume: si riporta il livello a quello della somma.
    lufs_somma = meter.integrated_loudness(x)
    if 'acuti' in s:
        x = to_lufs(high_shelf(x, 3000.0, s['acuti']), lufs_somma)
        params['acuti_sopra_3kHz_db'] = s['acuti']
    if 'ruvido' in s:
        x = to_lufs(am(x, 70.0, s['ruvido']), lufs_somma)
        params['modulazione_70Hz_profondita'] = s['ruvido']
    return x, params


def scrivi(x, nome, guadagno):
    # Stesso guadagno per tutte le clip: il confronto di volume fra stati resta quello voluto.
    x = fade(x * guadagno, 0.3, 0.5)
    lufs = meter.integrated_loudness(x)
    wav = os.path.join(OUT, nome + '.wav')
    sf.write(wav, x, SR, subtype='PCM_24')
    mp3 = os.path.join(OUT, nome + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '160k', mp3], check=True)
    os.remove(wav)
    return {'lufs': round(float(lufs), 1), 'picco_dbfs': round(20 * np.log10(np.abs(x).max()), 2),
            'durata_s': round(len(x) / SR, 2)}


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*')):
        os.remove(f)
    voci = [(v, s) for s in STATI for v in ('A', 'B')]
    ordine = np.random.default_rng(SEED).permutation(len(voci))
    costruite = []
    for i, idx in enumerate(ordine, start=1):
        versione, stato = voci[idx]
        x, params = clip_A(stato) if versione == 'A' else clip_B(stato)
        costruite.append((f'{i:02d}', stato, versione, x, params))
    # Un solo guadagno per tutte le clip, sul picco più alto: -1 dBFS.
    picco_max = max(np.abs(x).max() for _, _, _, x, _ in costruite)
    guadagno = min(1.0, 10 ** (-1 / 20) / picco_max)
    chiave = {}
    print(f"{'codice':7}{'stato':14}{'versione':10}{'LUFS':>7}{'picco':>9}")
    for codice, stato, versione, x, params in costruite:
        info = scrivi(x, codice, guadagno)
        chiave[codice] = {'stato': stato, 'versione': versione, 'parametri': params, **info}
        print(f"{codice:7}{stato:14}{versione:10}{info['lufs']:>7}{info['picco_dbfs']:>9}")
    print(f'\nGuadagno comune: {20 * np.log10(guadagno):.2f} dB')
    with open(os.path.join(OUT, 'chiave.json'), 'w') as f:
        json.dump(dict(sorted(chiave.items())), f, indent=2, ensure_ascii=False)
    print('Chiave scritta in clip/chiave.json: aprirla dopo l\'ascolto.')


if __name__ == '__main__':
    main()
