"""Bussola emotiva per Ascoli, ora per ora, CELLA per cella (LCZ da 30 m).

Uso: python compass.py [cartella dati]   (di default ../public/data)
Legge i parametri da bussola.json, ci riscrive le ancore dell'energia e i km2
dei quartieri, stampa la distribuzione degli stati e scrive
data/bussola_campioni.json (casi di prova per verificare la versione JS).

ENERGIA (asse X) = persone per km2 del quartiere nell'ora, in scala logaritmica,
ancorata al 10o e al 90o percentile delle ore di luce: -1 = vuoto, +1 = affollato.
Le celle fuori dai quartieri non hanno dati di persone: l'energia del quartiere
piu' vicino sfuma verso -1 entro 'energia_svanisce_m' metri.

PIACEVOLEZZA (asse Y) = w_comfort * comfort termico + w_green * verde - pioggia,
con i valori della cella (nessuna media). Il comfort viene dall'UTCI della cella
(vedi clima.py): +1 senza stress termico, -1 da stress forte. Il verde come
"bellezza" (w_green) e' una scelta espressiva, non fisica.
"""
import sys, os, json, math
import numpy as np, pandas as pd
from clima import clima, comfort

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "public", "data")
LAT0, LON0 = 42.854, 13.575

CFG_PATH = os.path.join(SRC, "bussola.json")
cfg = json.load(open(CFG_PATH))
P, F, GRID = cfg["parametri"], cfg["fisica"], cfg["griglia"]
COSTRUITE = [str(i) for i in range(1, 11)]

# --- celle LCZ ---
cells = pd.DataFrame([f["properties"] for f in json.load(open(os.path.join(SRC, "lcz_ascoli.geojson")))["features"]])
cells["svf"] = cells.svf_mean.where(cells.svf_mean > 0, P["svf_ripiego"])  # svf 0 = difetto del calcolo
cells["costruita"] = cells.lcz_class.isin(COSTRUITE)
cells["green"] = cells.pervious_frac / 100
cells["fade"] = (cells.quartiere_dist_m / P["energia_svanisce_m"]).clip(0, 1)

# --- quartieri: area in km2 (proiezione locale equirettangolare) ---
import re
from shapely.geometry import Polygon
kml = open(os.path.join(SRC, "cityrhythm_blimp_areas.kml")).read()
k = math.cos(math.radians(LAT0))
km2 = {}
for pm in re.findall(r"<Placemark[^>]*>(.*?)</Placemark>", kml, re.S):
    name = re.search(r"<name>(.*?)</name>", pm).group(1).strip()
    coords = re.search(r"<coordinates>(.*?)</coordinates>", pm, re.S).group(1)
    km2[name] = round(Polygon([(float(c.split(",")[0]) * 111.32 * k, float(c.split(",")[1]) * 110.57)
                               for c in coords.split()]).area, 4)

# --- meteo e sole ---
met = json.load(open(os.path.join(SRC, "meteo_ascoli.json")))
met = pd.DataFrame(met["hourly"]); met["time"] = pd.to_datetime(met.time)

def sun_elev(ts):  # elevazione solare (gradi), formula NOAA semplificata; ts in ora locale italiana
    utc = ts.tz_localize("Europe/Rome", ambiguous=True, nonexistent="shift_forward").tz_convert("UTC")
    d = utc.dayofyear; h = utc.hour + utc.minute / 60
    g = 2 * math.pi / 365 * (d - 1 + (h - 12) / 24)
    decl = 0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    ha = math.radians((h * 60 + eqt + 4 * LON0) / 4 - 180)
    lat = math.radians(LAT0)
    return math.degrees(math.asin(math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(ha)))

met["sun"] = [sun_elev(t) for t in met.time]

# --- presenze orarie per quartiere ---
poi = pd.read_csv(os.path.join(SRC, "cityrhythm_blimp.csv"))
rows = []
for _, r in poi.iterrows():
    for h in range(24):
        rows.append((r.poi_name.strip(), pd.Timestamp(r.date) + pd.Timedelta(hours=h), r[f"presenze_{h}"]))
df = pd.DataFrame(rows, columns=["area", "time", "people"]).dropna().merge(met, on="time")  # 1 ora senza dato

logd = np.log10(df.people / df.area.map(km2) + 1)
lo, hi = np.percentile(logd[df.sun > P["night_sun_deg"]], [10, 90])  # solo ore di luce
df["X"] = np.clip(2 * (logd - lo) / (hi - lo) - 1, -1, 1)

cfg["energia"] = {"log_lo": round(float(lo), 5), "log_hi": round(float(hi), 5)}
cfg["aree_km2"] = km2
json.dump(cfg, open(CFG_PATH, "w"), indent=2, ensure_ascii=False)
print(f"Energia: ancore {10**lo:.0f} e {10**hi:.0f} persone/km2 (10o e 90o percentile delle ore di luce)\n")


def bussola(X, sun, met, cel):
    """Stato per cella e ora; met = colonne meteo (1 x ore), cel = colonne cella (celle x 1)."""
    T, _, _ = clima(F, ta=met("temperature_2m"), rh=met("relative_humidity_2m"), cloud_pct=met("cloud_cover"),
                    wind_kmh=met("wind_speed_10m"), dni=met("direct_normal_irradiance"), dir_h=met("direct_radiation"),
                    dif_h=met("diffuse_radiation"), sun=sun, svf=cel("svf"), albedo=cel("albedo"), z0=cel("z0_value"),
                    costruita=cel("costruita"))
    green = cel("green")
    Y = np.clip(P["w_comfort"] * comfort(T, F) + P["w_green"] * (2 * green - 1) - P["rain"] * (met("precipitation") > P["rain_mm"]), -1, 1)
    cut = P["cut"]
    col = np.where(X < -cut, 0, np.where(X > cut, 2, 1))
    row = np.where(Y < -cut, 0, np.where(Y > cut, 2, 1))
    names = np.array(GRID)[row, col]
    return np.where((sun < P["night_sun_deg"]) & (X < -cut), "notte", names), Y, T


# --- stati per ogni cella e ora (matrice celle x ore, quartiere per quartiere) ---
conteggi, mesi, campioni = {}, [], []
rng = np.random.default_rng(1)
for area, ore in df.groupby("area"):
    cc = cells[cells.quartiere == area]
    if cc.empty:
        continue
    col = lambda s: ore[s].to_numpy()[None, :]
    cel = lambda s: cc[s].to_numpy()[:, None]
    Xq = col("X")
    X = Xq - (Xq + 1) * cel("fade")
    stati, Y, T = bussola(X, col("sun"), col, cel)
    dentro = cc.quartiere_dist_m.to_numpy() == 0
    for chi, sel in (("tutte", slice(None)), ("dentro", dentro)):
        s, n = np.unique(stati[sel], return_counts=True)
        for a, b in zip(s, n):
            conteggi[(chi, a)] = conteggi.get((chi, a), 0) + b
    mese = ore.time.dt.to_period("M").to_numpy()
    for m in np.unique(mese):
        s, n = np.unique(stati[:, mese == m], return_counts=True)
        mesi += [(m, a, b) for a, b in zip(s, n)]
    for _ in range(20):  # casi di prova per la versione JS
        i, j = rng.integers(len(cc)), rng.integers(len(ore))
        r = ore.iloc[j]
        campioni.append({"ora": r.time.strftime("%Y-%m-%dT%H:%M"), "cella": int(cc.id.iloc[i]), "quartiere": area,
                         "X": round(float(X[i, j]), 4), "Y": round(float(Y[i, j]), 4), "T": round(float(T[i, j]), 2),
                         "sole": round(float(r.sun), 2), "stato": str(stati[i, j])})

c = pd.Series(conteggi)
print("Quota degli stati (%), celle x ore:")
print(pd.DataFrame({k: (c[k] / c[k].sum() * 100).round(1) for k in ("dentro", "tutte")}).rename(
    columns={"dentro": "celle nei quartieri", "tutte": "tutte le celle"}).sort_values("tutte le celle", ascending=False).to_string(), "\n")
m = pd.DataFrame(mesi, columns=["mese", "stato", "n"]).pivot_table(index="mese", columns="stato", values="n", aggfunc="sum").fillna(0)
print("Stati per mese (%), tutte le celle:")
print((m.div(m.sum(axis=1), axis=0) * 100).round(0).to_string(), "\n")
json.dump(campioni, open(os.path.join(HERE, "data", "bussola_campioni.json"), "w"), indent=1, ensure_ascii=False)
print(f"{len(campioni)} casi di prova in data/bussola_campioni.json")
