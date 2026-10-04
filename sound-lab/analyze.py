import sys, glob, os
import numpy as np, librosa, pyloudnorm as pyln, soundfile as sf

TARGET = {"rifugio": ("D major", 70), "routine": ("D mixolydian", 95), "calca": ("D minor", 110),
          "passeggiata": ("D major", 90), "festa": ("D major", 115), "attesa": ("D sus", 70),
          "corrente": ("D dorian", 120), "alfa": ("D minor", 60), "afa": ("D minor", 60),
          "fatica": ("D minor", 80), "notte": ("D major", 65)}
NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])

def key_of(chroma):
    c = chroma.mean(axis=1)
    best = []
    for i in range(12):
        best.append((np.corrcoef(c, np.roll(MAJ, i))[0,1], f"{NOTES[i]} major"))
        best.append((np.corrcoef(c, np.roll(MIN, i))[0,1], f"{NOTES[i]} minor"))
    best.sort(reverse=True)
    return best[0], best[1]

feats = {}
files = sorted(glob.glob(os.path.join(sys.argv[1], "*.wav")))
for f in files:
    name = os.path.basename(f)[:-4]
    data, sr = sf.read(f)
    mono = data.mean(axis=1) if data.ndim > 1 else data
    lufs = pyln.Meter(sr).integrated_loudness(data)
    peak = 20*np.log10(np.abs(data).max())
    y = librosa.resample(mono, orig_sr=sr, target_sr=22050); sr2 = 22050
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr2)
    onset = librosa.onset.onset_detect(y=y, sr=sr2)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr2)
    (k1s, k1), (k2s, k2) = key_of(chroma)
    seg = 10*sr2
    rms = [20*np.log10(np.sqrt(np.mean(y[i:i+seg]**2))+1e-9) for i in range(0, len(y)-seg+1, seg)]
    head = 20*np.log10(np.sqrt(np.mean(y[:sr2]**2))+1e-9)
    tail = 20*np.log10(np.sqrt(np.mean(y[-sr2:]**2))+1e-9)
    mid = np.median(rms)
    cent = librosa.feature.spectral_centroid(y=y, sr=sr2).mean()
    mfcc = librosa.feature.mfcc(y=y, sr=sr2, n_mfcc=20)
    a = librosa.feature.mfcc(y=y[-2*sr2:], sr=sr2).mean(axis=1); b = librosa.feature.mfcc(y=y[:2*sr2], sr=sr2).mean(axis=1)
    seam = np.linalg.norm(a-b)
    feats[name] = (mfcc.mean(axis=1), chroma.mean(axis=1))
    t = TARGET.get(name.split()[0].lower(), ("?", 0))
    print(f"\n== {name}  (chiesto: {t[0]}, {t[1]} BPM)")
    print(f"durata {len(mono)/sr:.1f}s | loudness {lufs:.1f} LUFS | picco {peak:.1f} dBFS")
    print(f"tempo stimato {float(np.atleast_1d(tempo)[0]):.0f} BPM | onset/min {len(onset)/(len(y)/sr2/60):.0f} | brillantezza {cent:.0f} Hz")
    print(f"tonalita' {k1} ({k1s:.2f}), seconda {k2} ({k2s:.2f})")
    print("energia per 10s (dB):", " ".join(f"{r:.0f}" for r in rms))
    print(f"primo secondo {head-mid:+.0f} dB vs mediana, ultimo {tail-mid:+.0f} dB | salto al loop (timbro) {seam:.0f}")

names = list(feats)
M = np.array([feats[n][0] for n in names]); M = (M - M.mean(0)) / (M.std(0)+1e-9)
print("\nDistanza timbrica (piu' basso = piu' simili):")
print(" "*14 + "".join(f"{n[:12]:>13}" for n in names))
for i, n in enumerate(names):
    print(f"{n[:13]:>13} " + "".join(f"{np.linalg.norm(M[i]-M[j]):13.1f}" for j in range(len(names))))
