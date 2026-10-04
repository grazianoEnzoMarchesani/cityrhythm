import sys, os, json, subprocess
import numpy as np, librosa, soundfile as sf, pyloudnorm as pyln

SRC = sys.argv[1]
OUT = sys.argv[2]
SELECTION = {
    "rifugio": "rifugio 2025.wav",
    "passeggiata": "passeggiata 2025.wav",
    "festa": "festa 2025.wav",
    "attesa": "attesa 2026.wav",
    "routine": "Routine 2025.wav",
    "corrente": "corrente 2025 .wav",
    "afa": "afa 2025.wav",
    "fatica": "fatica 2026.wav",
    "calca": "Calca 2025.wav",
    "notte": "notte 2025.wav",
}
TARGET_LUFS = -18.0
PEAK_CEIL_DB = -1.0
XFADE = 2.0

def rms_db(x, sr, hop):
    r = librosa.feature.rms(y=x, frame_length=hop * 2, hop_length=hop)[0]
    return 20 * np.log10(r + 1e-9)

def window_feat(y, sr, t):
    seg = y[int(t * sr): int((t + 1.0) * sr)]
    c = librosa.feature.chroma_stft(y=seg, sr=sr).mean(axis=1)
    m = librosa.feature.mfcc(y=seg, sr=sr, n_mfcc=13).mean(axis=1)
    v = np.concatenate([c / (np.linalg.norm(c) + 1e-9), m / (np.linalg.norm(m) + 1e-9)])
    return v

os.makedirs(OUT, exist_ok=True)
manifest = {}
for mood, fname in SELECTION.items():
    data, sr = sf.read(os.path.join(SRC, fname), always_2d=True)
    mono = data.mean(axis=1)
    hop = sr // 10
    db = rms_db(mono, sr, hop)
    med = np.median(db)
    t = np.arange(len(db)) * hop / sr
    ok = np.where(db > med - 6)[0]
    body_start = max(0.5, t[ok[0]])
    body_end = min(t[ok[-1]], len(mono) / sr - 0.5) - XFADE

    y22 = librosa.resample(mono, orig_sr=sr, target_sr=22050)
    _, beats = librosa.beat.beat_track(y=y22, sr=22050)
    beat_t = librosa.frames_to_time(beats, sr=22050)
    starts = beat_t[beat_t >= body_start]
    s = float(starts[0]) if len(starts) else body_start

    ref = window_feat(y22, 22050, s)
    best, best_e = -1, None
    cands = beat_t[(beat_t > s + 0.6 * (body_end - s)) & (beat_t <= body_end)]
    if len(cands) == 0:
        cands = np.array([body_end])
    for e in cands:
        idx = np.searchsorted(beat_t, e)
        bars_ok = ((idx - np.searchsorted(beat_t, s)) % 4 == 0)
        score = float(np.dot(ref, window_feat(y22, 22050, e))) + (0.05 if bars_ok else 0)
        if score > best:
            best, best_e = score, float(e)
    e = best_e

    si, ei, xn = int(s * sr), int(e * sr), int(XFADE * sr)
    loop = data[si:ei].copy()
    tail = data[ei:ei + xn]
    ramp = np.linspace(0, np.pi / 2, xn)[:, None]
    loop[:xn] = loop[:xn] * np.sin(ramp) + tail * np.cos(ramp)

    meter = pyln.Meter(sr)
    gain_db = TARGET_LUFS - meter.integrated_loudness(loop)
    peak_db = 20 * np.log10(np.abs(loop).max()) + gain_db
    if peak_db > PEAK_CEIL_DB:
        gain_db -= peak_db - PEAK_CEIL_DB
    loop *= 10 ** (gain_db / 20)

    wav = os.path.join(OUT, f"{mood}.wav")
    sf.write(wav, loop, sr)
    mp3 = os.path.join(OUT, f"{mood}.mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "160k", mp3], check=True)
    manifest[mood] = {
        "source": fname, "loop_start_s": round(s, 2), "loop_end_s": round(e, 2),
        "duration_s": round(len(loop) / sr, 2), "seam_similarity": round(best, 3),
        "lufs": round(meter.integrated_loudness(loop), 1), "gain_db": round(gain_db, 1),
        "mp3_kb": os.path.getsize(mp3) // 1024,
    }
    print(mood, manifest[mood])

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
