import sys, glob, os
import numpy as np, librosa, pyloudnorm as pyln

# Analisi degli effetti urbani: durata, volume, stabilita', sfumature, giuntura del loop
# e presenza di note musicali (gli effetti non devono avere tonalita', altrimenti stonano).
SR = 44100
feats = {}
files = sorted(glob.glob(os.path.join(sys.argv[1], "*.mp3")) + glob.glob(os.path.join(sys.argv[1], "*.wav")))
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    y, _ = librosa.load(f, sr=SR, mono=False)
    data = y.T if y.ndim > 1 else y[:, None]
    mono = data.mean(axis=1)
    lufs = pyln.Meter(SR).integrated_loudness(data)
    peak = 20 * np.log10(np.abs(data).max())
    hop = SR // 2
    rms = [20 * np.log10(np.sqrt(np.mean(mono[i:i + hop] ** 2)) + 1e-9) for i in range(0, len(mono) - hop + 1, hop)]
    mid = np.median(rms)
    head = 20 * np.log10(np.sqrt(np.mean(mono[:SR // 4] ** 2)) + 1e-9) - mid
    tail = 20 * np.log10(np.sqrt(np.mean(mono[-SR // 4:] ** 2)) + 1e-9) - mid
    cent = librosa.feature.spectral_centroid(y=mono, sr=SR).mean()
    flat = librosa.feature.spectral_flatness(y=mono).mean()
    chroma = librosa.feature.chroma_stft(y=mono, sr=SR).mean(axis=1)
    tonal = chroma.max() / (chroma.mean() + 1e-9)
    nota = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][int(chroma.argmax())]
    a = librosa.feature.mfcc(y=mono[-SR // 2:], sr=SR).mean(axis=1)
    b = librosa.feature.mfcc(y=mono[:SR // 2], sr=SR).mean(axis=1)
    seam = np.linalg.norm(a - b)
    feats[name] = librosa.feature.mfcc(y=mono, sr=SR, n_mfcc=20).mean(axis=1)
    print(f"\n== {name}")
    print(f"durata {len(mono) / SR:.1f}s | loudness {lufs:.1f} LUFS | picco {peak:.1f} dBFS")
    print(f"brillantezza {cent:.0f} Hz | rumorosita' {flat:.3f} | tonalita' {tonal:.2f}x (nota dominante {nota})")
    print("energia per 0,5 s (dB):", " ".join(f"{r:.0f}" for r in rms), f"| oscillazione {np.std(rms):.1f} dB")
    print(f"inizio {head:+.0f} dB, fine {tail:+.0f} dB vs mediana | salto al loop (timbro) {seam:.0f}")

names = list(feats)
M = np.array([feats[n] for n in names]); M = (M - M.mean(0)) / (M.std(0) + 1e-9)
print("\nDistanza timbrica (piu' basso = piu' simili):")
print(" " * 15 + "".join(f"{n[:13]:>14}" for n in names))
for i, n in enumerate(names):
    print(f"{n[:14]:>14} " + "".join(f"{np.linalg.norm(M[i] - M[j]):14.1f}" for j in range(len(names))))
