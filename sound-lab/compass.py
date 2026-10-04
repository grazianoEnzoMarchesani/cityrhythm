"""Prototipo della bussola emotiva per Ascoli, ora per ora, quartiere per quartiere.

Uso: python compass.py <cartella con i CSV/KML scaricati dalla piattaforma>
Scrive data/aree_ascoli.json (caratteristiche fisse dei quartieri) e stampa la
distribuzione degli stati, per verificare che la formula "racconti" bene l'anno.

ENERGIA (asse X) = persone per km2 nell'ora, in scala logaritmica, ancorata al
10o e al 90o percentile delle ore di luce: -1 = vuoto, +1 = affollato.

PIACEVOLEZZA (asse Y) = 0.75 * comfort termico + 0.25 * verde - pioggia.
  Temperatura locale = temperatura percepita (Open-Meteo)
                       + sole diretto (radiazione x cielo visibile SVF)
                       - ombra/evaporazione del verde (solo di giorno)
                       + isola di calore (UHI risk, piu' forte di notte).
  Comfort: +1 fra 16 e 26 gradi, scende a -1 a 36 gradi (caldo) o a -4 (freddo).
E' un INDICATORE di stress termico percepito, non una misura.
"""
import sys, os, re, json, math
import numpy as np, pandas as pd
from shapely import wkt
from shapely.geometry import Polygon

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
HERE = os.path.dirname(os.path.abspath(__file__))
LAT0 = 42.854

UHI = {"Very Low": 0.0, "Low": 0.2, "Low-Medium": 0.35, "Medium-Low": 0.35, "Medium": 0.5, "High": 0.75, "Very High": 1.0}
P = dict(  # coefficienti: modificabili a orecchio, documentati in un unico posto
    sun_gain=4.0,      # gradi in piu' in pieno sole (900 W/m2) con cielo tutto visibile
    green_cool=2.0,    # gradi in meno di giorno con verde al 100%
    uhi_day=1.0, uhi_night=2.5,  # gradi in piu' con UHI "Very High"
    comfort=(16, 26), hot_end=36, cold_end=-4,  # il freddo pesa meno: ci si copre
    w_comfort=0.75, w_green=0.25, rain=0.3,
    night_sun_deg=-6,  # notte = sole sotto -6 gradi (fine crepuscolo) E poca gente (X sotto la soglia)
    cut=1 / 3,         # soglie fra le 3 colonne/righe della bussola
)
GRID = [["afa", "fatica", "calca"], ["attesa", "routine", "corrente"], ["rifugio", "passeggiata", "festa"]]

def km(poly):  # proiezione locale equirettangolare, sufficiente su pochi km
    k = math.cos(math.radians(LAT0))
    return Polygon([(x * 111.32 * k, y * 110.57) for x, y in poly.exterior.coords])

# --- quartieri (KML) ---
kml = open(os.path.join(SRC, "cityrhythm_blimp_areas.kml")).read()
areas = {}
for pm in re.findall(r"<Placemark[^>]*>(.*?)</Placemark>", kml, re.S):
    name = re.search(r"<name>(.*?)</name>", pm).group(1)
    coords = re.search(r"<coordinates>(.*?)</coordinates>", pm, re.S).group(1)
    pts = [tuple(map(float, c.split(",")[:2])) for c in coords.split()]
    areas[name.strip()] = Polygon(pts)

# --- celle LCZ: media pesata per area dentro ogni quartiere ---
lcz = pd.read_csv(os.path.join(SRC, "lcz_vitality.csv"), sep=";")
feat = {a: {"w": 0.0, "uhi": 0.0, "green": 0.0, "svf": 0.0, "wg": 0.0} for a in areas}
for _, r in lcz.iterrows():
    g = wkt.loads(re.sub(r"(\d),(\d)", r"\1.\2", r.WKT))
    c = g.centroid
    for a, poly in areas.items():
        if poly.contains(c):
            w = km(g).area
            f = feat[a]
            svf = float(str(r.SVF).replace(",", "."))
            f["w"] += w; f["uhi"] += w * UHI.get(r["UHI risk"], 0.5); f["svf"] += w * svf
            per = float(str(r.PER_PC).replace(",", ".")) if pd.notna(r.PER_PC) else -1
            if per >= 0:
                f["wg"] += w; f["green"] += w * per / 100
            break
info = {}
for a, f in feat.items():
    info[a] = {
        "km2": round(km(areas[a]).area, 3),
        "uhi": round(f["uhi"] / f["w"], 3) if f["w"] else 0.5,
        "svf": round(f["svf"] / f["w"], 3) if f["w"] else 0.7,
        "green": round(f["green"] / f["wg"], 3) if f["wg"] else 0.3,
        "lcz_km2": round(f["w"], 3), "copertura_lcz": round(f["w"] / km(areas[a]).area, 2),
    }
os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
json.dump({"parametri": P, "aree": info}, open(os.path.join(HERE, "data", "aree_ascoli.json"), "w"), indent=2, ensure_ascii=False)
print(pd.DataFrame(info).T.to_string(), "\n")

# --- meteo e sole ---
met = json.load(open(os.path.join(HERE, "data", "meteo_ascoli_2024-06-01_2025-02-01.json")))
met = pd.DataFrame(met["hourly"]); met["time"] = pd.to_datetime(met.time)

def sun_elev(ts):  # elevazione solare (gradi), formula NOAA semplificata; ts in ora locale italiana
    utc = ts.tz_localize("Europe/Rome", ambiguous=True, nonexistent="shift_forward").tz_convert("UTC")
    d = utc.dayofyear; h = utc.hour + utc.minute / 60
    g = 2 * math.pi / 365 * (d - 1 + (h - 12) / 24)
    decl = 0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    ha = math.radians((h * 60 + eqt + 4 * 13.575) / 4 - 180)
    lat = math.radians(LAT0)
    return math.degrees(math.asin(math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(ha)))

met["sun"] = [sun_elev(t) for t in met.time]

# --- presenze orarie ---
poi = pd.read_csv(os.path.join(SRC, "cityrhythm_blimp.csv"))
rows = []
for _, r in poi.iterrows():
    a = r.poi_name.strip()
    for h in range(24):
        rows.append((a, pd.Timestamp(r.date) + pd.Timedelta(hours=h), r[f"presenze_{h}"]))
df = pd.DataFrame(rows, columns=["area", "time", "people"]).dropna().merge(met, on="time")  # 1 ora senza dato su 64.944
df["km2"] = df.area.map(lambda a: info[a]["km2"])
for k in ("uhi", "svf", "green"):
    df[k] = df.area.map(lambda a: info[a][k])

# energia
logd = np.log10(df.people / df.km2 + 1)
lo, hi = np.percentile(logd[df.sun > P["night_sun_deg"]], [10, 90])  # solo ore di luce
df["X"] = np.clip(2 * (logd - lo) / (hi - lo) - 1, -1, 1)

# piacevolezza
day = df.sun > 0
rad = (df.shortwave_radiation / 900).clip(0, 1.2)
df["T_loc"] = (df.apparent_temperature + P["sun_gain"] * rad * df.svf - P["green_cool"] * df.green * rad
               + np.where(day, P["uhi_day"], P["uhi_night"]) * df.uhi)
c0, c1 = P["comfort"]
comfort = np.where(df.T_loc > c1, 1 - 2 * (df.T_loc - c1) / (P["hot_end"] - c1),
          np.where(df.T_loc < c0, 1 - 2 * (c0 - df.T_loc) / (c0 - P["cold_end"]), 1.0))
df["Y"] = np.clip(P["w_comfort"] * np.clip(comfort, -1, 1) + P["w_green"] * (2 * df.green - 1)
                  - P["rain"] * (df.precipitation > 0.5), -1, 1)

def state(r):
    if r.sun < P["night_sun_deg"] and r.X < -P["cut"]:
        return "notte"
    col = 0 if r.X < -P["cut"] else 2 if r.X > P["cut"] else 1
    row = 0 if r.Y < -P["cut"] else 2 if r.Y > P["cut"] else 1
    return GRID[row][col]
df["stato"] = df.apply(state, axis=1)

pd.set_option("display.width", 200)
print(f"Energia: ancore {10**lo:.0f} e {10**hi:.0f} persone/km2 (10o e 90o percentile delle ore di luce)\n")
print("Quota degli stati (%), tutte le ore e aree:")
print((df.stato.value_counts(normalize=True) * 100).round(1).to_string(), "\n")
print("Stati per mese (%):")
print((pd.crosstab(df.time.dt.to_period("M"), df.stato, normalize="index") * 100).round(0).to_string(), "\n")
print("Stato piu' frequente di giorno (sole > -6) per quartiere e mese:")
d = df[df.stato != "notte"]
print(pd.crosstab(d.area, d.time.dt.to_period("M"), values=d.stato, aggfunc=lambda s: s.mode().iat[0]).to_string(), "\n")
for when, a in [("2024-07-13 18:00", "Ascoli - Centro Storico"), ("2024-07-16 14:00", "Ascoli - Porta Maggiore"),
                ("2024-10-06 11:00", "Ascoli - Centro Storico"), ("2024-12-21 17:00", "Ascoli - Centro Storico"),
                ("2025-01-15 08:00", "Ascoli - Stadio")]:
    r = df[(df.time == when) & (df.area == a)].iloc[0]
    print(f"{when} {a[8:]:16} persone {r.people:6.0f} X {r.X:+.2f} | T perc {r.apparent_temperature:4.1f} -> locale {r.T_loc:4.1f} Y {r.Y:+.2f} | sole {r.sun:+.0f} -> {r.stato}")
df[["area", "time", "people", "X", "T_loc", "Y", "stato"]].to_csv(os.path.join(HERE, "data", "bussola_prova.csv"), index=False)
