# Brani classici della mappa sonora (modalità "Musica classica"): un loop per stato da registrazioni Musopen.
# Uso (dalla cartella sound-lab, con il venv):
#   .venv/bin/python process_classica.py <cartella dei FLAC> ../public/audio/classica
# I FLAC sono la collezione "Musopen Collection as FLAC" su Internet Archive (licenza dichiarata:
# Public Domain Mark 1.0; Musopen chiede di citarlo nelle opere derivate). I file non si versionano.
# Come process.py: -18 LUFS, picco ≤ -1 dBFS, dissolvenza incrociata di 2 s sul bordo, MP3 160k.
# Differenza: il loop è un segmento di 70–95 s del brano (non il brano intero, che dura 5–15 minuti).
# I punti di inizio e fine sono scelti dall'analisi (bordi simili, a battuta). Se un brano non convince
# all'ascolto, si fissano a mano in MANUALE (secondi dall'inizio del file).
import sys, os, json, subprocess
import numpy as np, librosa, soundfile as sf, pyloudnorm as pyln

SRC = sys.argv[1]
OUT = sys.argv[2]
TARGET_LUFS = -18.0
PEAK_CEIL_DB = -1.0
XFADE = 2.0
DURATA_MIN, DURATA_MAX = 70.0, 95.0

# stato: (file FLAC, titolo, autore, inizio e fine a mano in secondi o None)
# Fatica: solo l'introduzione lenta e pesante dell'Egmont, non l'Allegro che segue. L'Allegro comincia
# verso 70 s: la densità degli attacchi passa da 0 a 13–18 ogni 5 s. Il punto (secondi dall'inizio del file)
# viene dall'analisi degli attacchi, non dall'ascolto: da giudicare all'orecchio.
FATICA_MANUALE = (0.0, 68.0)

SELEZIONE = {
    "rifugio": ("EdvardGrieg-PeerGyntSuiteNo.1Op.46-01-Morning.flac",
                "Morgenstimmung (Peer Gynt, suite n. 1, op. 46)", "Edvard Grieg", None),
    "passeggiata": ("FelixMendelssohn-SymphonyNo.4InAMajorOp.90italian-02-AndanteConMoto.flac",
                    "Andante con moto (Sinfonia n. 4 «Italiana», op. 90)", "Felix Mendelssohn", None),
    "festa": ("WolfgangAmadeusMozart-MarriageOfFigaro.flac",
              "Le nozze di Figaro, ouverture (K. 492)", "Wolfgang Amadeus Mozart", None),
    "attesa": ("JosephHaydn-StringQuartetInDOp.645H363Lark-02-AdagioCantabile.flac",
               "Adagio cantabile (Quartetto op. 64 n. 5, «L'allodola»)", "Joseph Haydn", None),
    "routine": ("JosephHaydn-StringQuartetInDOp.645H363Lark-03-MenuettoAllegretto.flac",
                "Menuetto (Quartetto op. 64 n. 5, «L'allodola»)", "Joseph Haydn", None),
    "corrente": ("FelixMendelssohn-SymphonyNo.4InAMajorOp.90italian-04-Saltarellopresto.flac",
                 "Saltarello presto (Sinfonia n. 4 «Italiana», op. 90)", "Felix Mendelssohn", None),
    "afa": ("AlexanderBorodin-InTheSteppesOfCentralAsia.flac",
            "Nelle steppe dell'Asia centrale", "Aleksandr Borodin", None),
    "fatica": ("LudwigVanBeethoven-EgmontOvertureOp.84.flac",
               "Introduzione lenta (Egmont, ouverture, op. 84)", "Ludwig van Beethoven", FATICA_MANUALE),
    "calca": ("JohannesBrahms-SymphonyNo.4InEMinorOp.98-04-AllegroEnergicoEPassionato.flac",
              "Allegro energico e passionato (Sinfonia n. 4, op. 98)", "Johannes Brahms", None),
    "notte": ("FranzSchubert-SonataInAMajorD.664-02-Andante.flac",
              "Andante (Sonata in la maggiore, D. 664)", "Franz Schubert", None),
}

def rms_db(x, hop):
    r = librosa.feature.rms(y=x, frame_length=hop * 2, hop_length=hop)[0]
    return 20 * np.log10(r + 1e-9)

def window_feat(y, sr, t):
    seg = y[int(t * sr): int((t + 1.0) * sr)]
    c = librosa.feature.chroma_stft(y=seg, sr=sr).mean(axis=1)
    m = librosa.feature.mfcc(y=seg, sr=sr, n_mfcc=13).mean(axis=1)
    return np.concatenate([c / (np.linalg.norm(c) + 1e-9), m / (np.linalg.norm(m) + 1e-9)])

def trova_loop(mono, sr):
    """Inizio dal corpo del brano (non dal silenzio), fine a battuta fra 70 e 95 s dopo, bordi più simili."""
    hop = sr // 10
    db = rms_db(mono, hop)
    t = np.arange(len(db)) * hop / sr
    ok = np.where(db > np.median(db) - 6)[0]
    corpo_inizio = max(0.5, t[ok[0]])
    y22 = librosa.resample(mono, orig_sr=sr, target_sr=22050)
    _, beats = librosa.beat.beat_track(y=y22, sr=22050)
    beat_t = librosa.frames_to_time(beats, sr=22050)
    partenze = beat_t[beat_t >= corpo_inizio]
    s = float(partenze[0]) if len(partenze) else corpo_inizio
    ref = window_feat(y22, 22050, s)
    fine_max = min(len(mono) / sr - XFADE - 1, s + DURATA_MAX)
    candidati = beat_t[(beat_t >= s + DURATA_MIN) & (beat_t <= fine_max)]
    if len(candidati) == 0:  # brano senza battute riconoscibili: si chiude dove si può
        candidati = np.array([fine_max])
    migliore, e_migliore = -np.inf, None
    for e in candidati:
        punteggio = float(np.dot(ref, window_feat(y22, 22050, e)))
        if punteggio > migliore:
            migliore, e_migliore = punteggio, float(e)
    return s, e_migliore, migliore

os.makedirs(OUT, exist_ok=True)
manifest = {}
for stato, (fname, titolo, autore, manuale) in SELEZIONE.items():
    data, sr = sf.read(os.path.join(SRC, fname), always_2d=True, dtype="float32")
    mono = data.mean(axis=1)
    if manuale:
        s, e, punteggio = manuale[0], manuale[1], None
    else:
        s, e, punteggio = trova_loop(mono, sr)
    si, ei, xn = int(s * sr), int(e * sr), int(XFADE * sr)
    loop = data[si:ei].copy()
    coda = data[ei:ei + xn]
    rampa = np.linspace(0, np.pi / 2, xn)[:, None]
    loop[:xn] = loop[:xn] * np.sin(rampa) + coda * np.cos(rampa)

    meter = pyln.Meter(sr)
    guadagno_db = TARGET_LUFS - meter.integrated_loudness(loop)
    picco_db = 20 * np.log10(np.abs(loop).max()) + guadagno_db
    if picco_db > PEAK_CEIL_DB:
        guadagno_db -= picco_db - PEAK_CEIL_DB
    loop *= 10 ** (guadagno_db / 20)

    wav = os.path.join(OUT, f"{stato}.wav")
    sf.write(wav, loop, sr, subtype="PCM_24")
    mp3 = os.path.join(OUT, f"{stato}.mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "160k", mp3], check=True)
    os.remove(wav)
    manifest[stato] = {
        "titolo": titolo, "autore": autore, "file_sorgente": fname,
        "inizio_s": round(s, 2), "fine_s": round(e, 2), "durata_s": round(len(loop) / sr, 2),
        "similarita_bordi": None if punteggio is None else round(punteggio, 3),
        "lufs": round(meter.integrated_loudness(loop), 1), "guadagno_db": round(guadagno_db, 1),
        "mp3_kb": os.path.getsize(mp3) // 1024,
    }
    print(stato, manifest[stato], flush=True)

manifest["_fonte"] = {
    "raccolta": "Musopen Collection as FLAC, Internet Archive (https://archive.org/details/MusopenCollectionAsFlac)",
    "licenza": "Public Domain Mark 1.0: dichiarata da chi ha caricato la raccolta nel 2012, non da Musopen. "
               "Da verificare su musopen.org per ogni registrazione prima della pubblicazione. "
               "Musopen chiede di citarlo nelle opere derivate",
    "sito": "https://musopen.org/",
    "trattamento": "estratto di 70-95 s per stato, in loop, con dissolvenza di 2 s, volume normalizzato a -18 LUFS"
}
with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
