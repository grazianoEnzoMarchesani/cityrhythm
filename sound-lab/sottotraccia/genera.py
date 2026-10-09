# Sottotraccia: strumento di prova che scrive le clip (MP3).
# Le regole e la lista degli eventi NON stanno qui: vengono da src/audio/sottotraccia-eventi.js,
# la stessa sorgente che usa l'app. Questo file fa solo la sintesi: colpi di cassa, hi-hat e note.
# Le forme di suono (inviluppi, filtri, tempi) sono quelle del modo Web Audio di src/audio/sottotraccia.js.
# Uso (dalla cartella sound-lab):  .venv/bin/python sottotraccia/genera.py
import json, os, subprocess
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import lfilter

SR = 44100
DUR = 20.0
N = int(SR * DUR)
CODA = 1.5                               # le note decadono oltre la fine del brano: si tagliano dopo
NOTA_DURATA_S = 1.5                      # come in sottotraccia.js
SEME = 2026
MUSICA_LUFS = -18.0
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
EVENTI_JS = os.path.join(HERE, 'eventi.mjs')
OUT = os.path.join(HERE, 'clip')
meter = pyln.Meter(SR)

# Clip statiche: ingressi fissi per tutta la durata. H è il calore con segno (+1 caldo).
STATICHE = {
    'festa':            [dict(t=0, X=+1, Y=+1, H=0, I=0)],
    'rifugio':          [dict(t=0, X=-1, Y=+1, H=0, I=0)],
    'afa':              [dict(t=0, X=-1, Y=-1, H=+1, I=0)],
    'afa_senza_caldo':  [dict(t=0, X=-1, Y=-1, H=0, I=0)],
    'calca_regolare':   [dict(t=0, X=+1, Y=-1, H=0, I=0)],
    'calca_irregolare': [dict(t=0, X=+1, Y=-1, H=0, I=1)],
}
# Clip con rampe: un ingresso cambia lungo i 20 secondi, gli altri restano fermi.
RAMPE = {
    'rampa_energia':      [dict(t=0, X=-1, Y=+1, H=0, I=0), dict(t=DUR, X=+1, Y=+1, H=0, I=0)],
    'rampa_piacevolezza': [dict(t=0, X=+1, Y=+1, H=0, I=0), dict(t=DUR, X=+1, Y=-1, H=0, I=0)],
}


def eventi_da_js(fotogrammi, seme):
    """Chiama il pianificatore JavaScript dell'app e riceve la lista degli eventi."""
    richiesta = json.dumps({'seme': seme, 'durata': DUR, 'fotogrammi': fotogrammi})
    risultato = subprocess.run(['node', EVENTI_JS], input=richiesta, capture_output=True, text=True,
                               cwd=ROOT, check=True)
    return json.loads(risultato.stdout)


def inviluppo_nota(n):
    # Come in sottotraccia.js: attacco di 10 ms, poi decadimento esponenziale con costante 0,35 s
    t = np.arange(n) / SR
    return np.minimum(1, t / 0.01) * np.exp(-np.maximum(t - 0.01, 0) / 0.35)


def nota(f, g, n):
    t = np.arange(n) / SR
    tono = sum(peso * np.sin(2 * np.pi * f * mult * t) for mult, peso in [(1, 1.0), (2, 0.3), (3, 0.1)])
    return g * tono * inviluppo_nota(n)


def cassa(g):
    # Scivolamento da 120 a 45 Hz in 0,09 s (esponenziale), poi decadimento con costante 0,08 s
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = np.where(t < 0.09, 120 * (45 / 120) ** (t / 0.09), 45.0)
    fase = 2 * np.pi * np.cumsum(f) / SR
    return g * np.sin(fase) * np.exp(-t / 0.08)


def hihat(g, banda, seme_evento):
    # Filtro passa-banda con la stessa forma del BiquadFilter 'bandpass' di Web Audio (Q = f0 / larghezza)
    lo, hi = banda
    f0 = np.sqrt(lo * hi)
    Q = f0 / (hi - lo)
    n = int(0.1 * SR)
    w0 = 2 * np.pi * f0 / SR
    alfa = np.sin(w0) / (2 * Q)
    b = np.array([alfa, 0.0, -alfa])
    a = np.array([1 + alfa, -2 * np.cos(w0), 1 - alfa])
    rumore = np.random.default_rng(seme_evento).standard_normal(n)
    t = np.arange(n) / SR
    return g * lfilter(b / a[0], a / a[0], rumore) * np.exp(-t / 0.02)


def sintetizza(eventi):
    buf = np.zeros(N + int(CODA * SR))
    for i, e in enumerate(eventi):
        i0 = int(round(e['t'] * SR))
        if e['tipo'] == 'cassa':
            s = cassa(e['g'])
        elif e['tipo'] == 'hihat':
            s = hihat(e['g'], e['banda'], SEME * 100000 + i)
        elif e['tipo'] == 'nota':
            s = nota(e['f'], e['g'], int(NOTA_DURATA_S * SR))
        else:
            continue
        if i0 < 0 or i0 >= len(buf):
            continue
        fine = min(len(buf), i0 + len(s))
        buf[i0:fine] += s[:fine - i0]
    return buf[:N]


def scrivi(buf, nome):
    x = np.repeat(buf[:, None], 2, axis=1)
    # Dissolvenza in entrata e in uscita: niente click al bordo del file
    x[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    x[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))[:, None]
    x = x * 10 ** ((MUSICA_LUFS - meter.integrated_loudness(x)) / 20)
    picco = np.abs(x).max()
    if picco > 10 ** (-1 / 20):
        x = x * (10 ** (-1 / 20) / picco)
    wav = os.path.join(OUT, nome + '.wav')
    sf.write(wav, x, SR, subtype='PCM_24')
    mp3 = os.path.join(OUT, nome + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '160k', mp3], check=True)
    os.remove(wav)
    return round(float(meter.integrated_loudness(x)), 1), round(20 * np.log10(np.abs(x).max()), 2)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    manifest = {}
    print(f"{'clip':22}{'eventi':>8}{'LUFS':>7}{'picco':>8}")
    tutte = list(STATICHE.items()) + list(RAMPE.items())
    for nome, fotogrammi in tutte:
        eventi = eventi_da_js(fotogrammi, SEME)
        lufs, picco = scrivi(sintetizza(eventi), nome)
        conteggio = {tipo: sum(1 for e in eventi if e['tipo'] == tipo) for tipo in ('cassa', 'hihat', 'nota')}
        manifest[nome] = {'fotogrammi': fotogrammi, 'eventi': conteggio, 'LUFS': lufs, 'picco_dbfs': picco}
        print(f"{nome:22}{len(eventi):>8}{lufs:>7}{picco:>8}")
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


if __name__ == '__main__':
    main()


# --- Tabella dei livelli per l'app ---
# L'app non normalizza le clip: usa un guadagno che dipende da X, Y e H, misurato qui sulla griglia.
# Per ogni punto: quanto guadagno (dB) porta la musica grezza a -18 LUFS, senza superare -1 dBFS.
# Il valore è interpolato in src/audio/sottotraccia-livelli.js. Griglia 5 x 5 x 3.
GRIGLIA = {'X': [-1, -0.5, 0, 0.5, 1], 'Y': [-1, -0.5, 0, 0.5, 1], 'H': [-1, 0, 1]}

def tabella_livelli():
    guadagni = []
    for X in GRIGLIA['X']:
        riga = []
        for Y in GRIGLIA['Y']:
            colonna = []
            for H in GRIGLIA['H']:
                eventi = eventi_da_js([dict(t=0, X=X, Y=Y, H=H, I=0)], SEME)
                buf = sintetizza(eventi)
                x = np.repeat(buf[:, None], 2, axis=1)
                lufs = meter.integrated_loudness(x)
                picco_db = 20 * np.log10(np.abs(x).max() + 1e-12)
                guadagno = min(MUSICA_LUFS - lufs, -1.0 - picco_db)   # -18 LUFS, ma picco <= -1 dBFS
                colonna.append(round(float(guadagno), 2))
            riga.append(colonna)
        guadagni.append(riga)
        print(f'X={X:+.1f} fatto', flush=True)
    tabella = {'griglia': GRIGLIA, 'guadagno_dB': guadagni,
               'nota': 'guadagno (dB) da applicare alla musica grezza per arrivare a -18 LUFS, picco <= -1 dBFS'}
    with open(os.path.join(ROOT, 'src', 'audio', 'sottotraccia-livelli.json'), 'w') as f:
        json.dump(tabella, f, indent=1)
    print('Tabella scritta in src/audio/sottotraccia-livelli.json')


if __name__ == '__main__' and 'livelli' in __import__('sys').argv:
    tabella_livelli()
