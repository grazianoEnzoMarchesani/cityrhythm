"""Quota di persone in casa ora per ora, dai diari ISTAT Uso del tempo 2008-09 armonizzati da IPUMS MTUS.

Fonte: Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman,
Etienne Breton, and Stephanie Richards. Multinational Time Use Study Extract System: Version 1.5 [dataset].
Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D062.V1.5 (dati originali: ISTAT, Uso del tempo 2008-09).

Licenza IPUMS MTUS: i microdati NON si ridistribuiscono. Restano in ../IPUMS/ (in .gitignore);
nel progetto entra solo la curva aggregata calcolata qui. Termini UCL (https://uma.pop.umn.edu/mtus_terms.pdf):
nessun risultato da meno di 30 casi non pesati (lo script si ferma se succede) e seconda citazione obbligatoria
"This document uses the Multinational Time Use Study, Centre for Time Use Research, University College London
2019, http://www.timeuse.org/mtus/reference.html".

Estratto: campione Italy 2008, struttura "activity" (una riga per attività), variabili DAY, PROPWT,
BADCASE, CLOCKST, TIME, ELOC. Uso (dalla cartella sound-lab):
  .venv/bin/python casa_mtus.py ../IPUMS/mtus_00003.dat.gz ../public/data/quota_in_casa.json
"""
import gzip, sys
import numpy as np

# Posizioni delle colonne dal codebook (DDI) dell'estratto mtus_00003 (1 = primo carattere)
COLS = {'DAY': (76, 77), 'PROPWT': (86, 101), 'BADCASE': (102, 103), 'CLOCKST': (106, 111),
        'TIME': (120, 123), 'ELOC': (130, 131), 'IDENT': (14, 22)}
LOC = {1: 'casa propria', 2: 'casa d\'altri', 3: 'lavoro', 4: 'scuola', 5: 'servizi, negozi',
       6: 'bar, ristoranti', 7: 'luogo di culto', 8: 'in viaggio', 9: 'altrove', -8: 'sconosciuto'}
DAYTYPE = {2: 'feriale', 3: 'feriale', 4: 'feriale', 5: 'feriale', 6: 'feriale', 7: 'sabato', 1: 'domenica'}

rows = {k: [] for k in COLS}
with gzip.open(sys.argv[1], 'rt', encoding='latin-1') as f:
    for line in f:
        for k, (a, b) in COLS.items():
            rows[k].append(line[a - 1:b])
d = {k: np.array(v) for k, v in rows.items()}
day = d['DAY'].astype(int); w = d['PROPWT'].astype(float); bad = d['BADCASE'].astype(int)
clock = d['CLOCKST'].astype(int); dur = d['TIME'].astype(int); eloc = d['ELOC'].astype(int)
start = (clock // 100 * 60 + clock % 100) % 1440  # CLOCKST ha 2 decimali impliciti: 000710 = 07:10
ok = (w > 0) & np.isin(bad, [0, 5]) & np.isin(day, list(DAYTYPE)) & (dur > 0)
print(f"attività: {len(w):,}  valide: {ok.sum():,}  diari validi: {len(np.unique(d['IDENT'][ok])):,}")

def minute_profile(mask):
    """Peso cumulato per minuto del giorno (0..1439) delle attività in mask, con il giro di mezzanotte."""
    diff = np.zeros(1441 * 2)
    s, e = start[mask], start[mask] + dur[mask]
    np.add.at(diff, s, w[mask]); np.add.at(diff, e, -w[mask])
    prof = np.cumsum(diff)[:2880]
    return prof[:1440] + prof[1440:]

# Un profilo per giorno del diario (DAY: 1 domenica ... 7 sabato), quota in casa per ora (media dei 60 minuti)
diary, n_diaries = {}, {}
for dd in range(1, 8):
    m = ok & (day == dd)
    n_diaries[dd] = len(np.unique(d['IDENT'][m]))
    known = minute_profile(m) - minute_profile(m & (eloc == -8))
    diary[dd] = (minute_profile(m & (eloc == 1)) / known).reshape(24, 60).mean(axis=1)
    print(f"DAY {dd}: diari {n_diaries[dd]:,}")
# Ogni valore della curva è una media su tutti i diari di quel giorno: deve averne almeno 30 (termini UCL)
assert min(n_diaries.values()) >= 30, 'meno di 30 diari in un giorno: la curva non si può pubblicare'

# Il diario parte alle 4:00: le ore 0-3 di un giorno di calendario stanno nel diario del giorno prima.
# Risultato per giorno di calendario come in JavaScript (getDay: 0 domenica ... 6 sabato).
curve = []
for js in range(7):
    dd, prev = js + 1, (js - 1) % 7 + 1
    curve.append([round(float(diary[prev][h] if h < 4 else diary[dd][h]), 3) for h in range(24)])
names = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
print('\nora  ' + ' '.join(f'{n:>5}' for n in names))
for h in range(24):
    print(f'{h:02d}   ' + ' '.join(f'{curve[js][h]:5.0%}' for js in range(7)))
if len(sys.argv) > 2:
    import json
    json.dump({
        'descrizione': 'Quota di persone in casa propria per giorno della settimana (0 = domenica, come getDay) '
                       'e ora (0-23, media dei 60 minuti). Curva aggregata: nessun microdato.',
        'fonte': 'ISTAT, Uso del tempo 2008-09 (diari giornalieri), armonizzati in IPUMS MTUS; variabile ELOC = 1 (casa propria)',
        'citazioni': [
            'Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman, Etienne Breton, '
            'and Stephanie Richards. Multinational Time Use Study Extract System: Version 1.5 [dataset]. Minneapolis, MN: IPUMS, 2025. '
            'https://doi.org/10.18128/D062.V1.5',
            'This document uses the Multinational Time Use Study, Centre for Time Use Research, University College London 2019, '
            'http://www.timeuse.org/mtus/reference.html'],
        'diari_per_giorno': [n_diaries[js + 1] for js in range(7)],
        'quota_in_casa': curve}, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
