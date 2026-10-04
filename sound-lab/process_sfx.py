import sys, os, re, glob, json, subprocess
import numpy as np, librosa, soundfile as sf, pyloudnorm as pyln
from scipy.ndimage import minimum_filter1d, uniform_filter1d

# Effetti urbani: taglia la sfumatura finale, uniforma il volume e raggruppa le varianti
# ("Traffico1", "Traffico2" -> gruppo "traffico"). Il loop non e' cucito qui: la pagina
# alterna le varianti con dissolvenze incrociate, cosi' la ripetizione si sente meno.
SRC = sys.argv[1]
OUT = sys.argv[2]
SR = 44100
TARGET_LUFS = -20.0
PEAK_CEIL_DB = -1.0
EDGE = 0.05  # micro-sfumatura ai bordi per evitare click

def slug(name):
    return re.sub(r"\s*\d+$", "", name).strip().lower().replace(" ", "-")

def body(mono):
    # volume medio su finestre di 1 s; tiene il tratto entro 3 dB dalla mediana
    hop = SR // 20
    r = librosa.feature.rms(y=mono, frame_length=hop * 2, hop_length=hop)[0]
    db = 20 * np.log10(uniform_filter1d(r, 20) + 1e-9)
    ok = np.where(db > np.median(db) - 3)[0]
    return ok[0] * hop, min(len(mono), (ok[-1] + 1) * hop)

def limit(x, ceil):
    # limitatore semplice: abbassa solo i picchi oltre la soglia, con rilascio morbido
    need = np.minimum(1.0, ceil / (np.abs(x).max(axis=1) + 1e-12))
    g = uniform_filter1d(minimum_filter1d(need, int(0.01 * SR)), int(0.005 * SR))
    g = np.minimum(g, minimum_filter1d(need, 3))
    return x * g[:, None]

os.makedirs(OUT, exist_ok=True)
groups = {}
files = sorted(glob.glob(os.path.join(SRC, "*.mp3")) + glob.glob(os.path.join(SRC, "*.wav")))
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    g = slug(name)
    y, _ = librosa.load(f, sr=SR, mono=False)
    data = (y.T if y.ndim > 1 else y[:, None]).astype(np.float64)
    s, e = body(data.mean(axis=1))
    clip = data[s:e].copy()
    n = int(EDGE * SR)
    ramp = np.linspace(0, 1, n)[:, None]
    clip[:n] *= ramp; clip[-n:] *= ramp[::-1]

    meter = pyln.Meter(SR)
    gain_db = TARGET_LUFS - meter.integrated_loudness(clip)
    clip *= 10 ** (gain_db / 20)
    ceil = 10 ** (PEAK_CEIL_DB / 20)
    limited = np.abs(clip).max() > ceil
    if limited:
        clip = limit(clip, ceil)

    idx = len(groups.get(g, [])) + 1
    base = os.path.join(OUT, f"{g}-{idx}")
    sf.write(base + ".wav", clip, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", base + ".wav", "-b:a", "160k", base + ".mp3"], check=True)
    os.remove(base + ".wav")
    info = {
        "file": f"{g}-{idx}.mp3", "source": os.path.basename(f),
        "start_s": round(s / SR, 2), "end_s": round(e / SR, 2), "duration_s": round(len(clip) / SR, 2),
        "gain_db": round(gain_db, 1), "limited": bool(limited),
        "lufs": round(meter.integrated_loudness(clip), 1),
    }
    groups.setdefault(g, []).append(info)
    print(g, info)

with open(os.path.join(OUT, "manifest.json"), "w") as fh:
    json.dump(groups, fh, indent=2, ensure_ascii=False)
