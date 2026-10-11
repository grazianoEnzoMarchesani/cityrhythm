"""Profili orari per tipo di luogo, dai diari ISTAT Uso del tempo 2008-09 armonizzati da IPUMS MTUS.

Per ogni tipo di luogo: quota di persone che in quell'ora della settimana sta in quel tipo di luogo
(variabile ELOC) o fa l'attività che ci si fa (variabile MAIN). Serve a dare a ogni luogo OSM un
profilo di affluenza per la settimana tipo (sound-lab/luoghi_osm.py, src/data/luoghi-core.js), al posto
dei profili di affollamento di fonte commerciale usati prima (branch dati-legali, in prova).

Fonte: Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman,
Etienne Breton, and Stephanie Richards. Multinational Time Use Study Extract System: Version 1.5 [dataset].
Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D062.V1.5 (dati originali: ISTAT, Uso del tempo 2008-09).
Codici di MAIN (69 attività) ed ELOC (luogo): MTUS User Guide, Chapter 3 "Activity codes", tabelle 3.1 e 3.4
(https://www.timeuse.org/sites/default/files/9727/chapter-3-activity-codes.pdf).

Licenza IPUMS MTUS: i microdati NON si ridistribuiscono. Restano in ../IPUMS/ (in .gitignore); nel progetto
entra solo l'aggregato calcolato qui. Termini UCL (https://uma.pop.umn.edu/mtus_terms.pdf): nessun risultato
da meno di 30 casi non pesati. Qui ogni valore pubblicato viene da almeno 30 diari distinti con tempo nel tipo
di luogo in quell'ora; sotto i 30 il valore resta null (non pubblicato) e nell'app vale 0. Seconda citazione
obbligatoria: "This document uses the Multinational Time Use Study, Centre for Time Use Research, University
College London 2019, http://www.timeuse.org/mtus/reference.html".

Estratto: campione Italy 2008, struttura "activity" (mtus_00003, lo stesso di casa_mtus.py). Colonne come in
casa_mtus.py; MAIN (attività principale, 69 categorie) alle colonne 124-126, ricavate dai dati e verificate
con le tabelle MTUS: «ristorante, caffè, bar, pub» (39) cade per il 100% in ELOC 6, «culto» (34) per l'80% in
ELOC 7, «comprare beni» (24) per il 98% in ELOC 5, «scuola» (15) per il 99% in ELOC 4.

Scelte [S]: giorni feriali (lunedì-venerdì) messi insieme, perché un giorno feriale da solo ha ~2.800 diari e
molte celle scendono sotto i 30 casi; sabato e domenica a parte (diari più numerosi e abitudini diverse).
Il diario parte alle 4:00: le ore 0-3 di un giorno di calendario vengono dal diario del giorno prima (come in
casa_mtus.py), quindi il sabato 0-3 (venerdì notte) usa i feriali. Quota = minuti pesati (PROPWT) nell'ora ÷
(60 × peso dei diari di quel tipo di giorno).
La corrispondenza fra profilo e categoria di luogo OSM è un'ipotesi [H]: sta in luoghi_osm.py (PROFILO).

Uso (dalla cartella sound-lab):
  .venv/bin/python profili_mtus.py ../IPUMS/mtus_00003.dat.gz ../public/data/profili_luoghi.json
"""
import gzip, json, sys
import numpy as np

# Posizioni delle colonne dell'estratto mtus_00003 (1 = primo carattere)
COLS = {'DAY': (76, 77), 'PROPWT': (86, 101), 'BADCASE': (102, 103), 'CLOCKST': (106, 111),
        'TIME': (120, 123), 'MAIN': (124, 126), 'ELOC': (130, 131), 'IDENT': (14, 22)}
MIN_CASI = 30  # [F] termini UCL: nessun risultato da meno di 30 casi non pesati

# Tipi di giorno del diario (DAY: 1 domenica ... 7 sabato) [S]
TIPO_GIORNO = {1: 'domenica', 2: 'feriale', 3: 'feriale', 4: 'feriale', 5: 'feriale', 6: 'feriale', 7: 'sabato'}


def leggi(percorso):
    rows = {k: [] for k in COLS}
    with gzip.open(percorso, 'rt', encoding='latin-1') as f:
        for line in f:
            for k, (a, b) in COLS.items():
                rows[k].append(line[a - 1:b])
    return {k: np.array(v) for k, v in rows.items()}


def main(ingresso, uscita=None):
    d = leggi(ingresso)
    day = d['DAY'].astype(int); w = d['PROPWT'].astype(float); bad = d['BADCASE'].astype(int)
    clock = d['CLOCKST'].astype(int); dur = d['TIME'].astype(int)
    eloc = d['ELOC'].astype(int); attivita = d['MAIN'].astype(int)
    start = (clock // 100 * 60 + clock % 100) % 1440  # CLOCKST ha 2 decimali impliciti: 000710 = 07:10
    ok = (w > 0) & np.isin(bad, [0, 5]) & np.isin(day, list(TIPO_GIORNO)) & (dur > 0)
    diario = np.unique(d['IDENT'], return_inverse=True)[1]
    tipo = np.array([TIPO_GIORNO.get(x, '') for x in day])
    print(f"attività: {len(w):,}  valide: {ok.sum():,}  diari validi: {len(np.unique(diario[ok])):,}")

    # [F] dati, [H] corrispondenza con i luoghi: chiave -> (nome, definizione MTUS, maschera)
    PROFILI = {
        'bar_ristoranti': ('Bar, caffè e ristoranti', 'ELOC 6: al ristorante, caffè, bar, pub', eloc == 6),
        'acquisti': ('Acquisti', 'MAIN 24: comprare beni (98% in ELOC 5, servizi o negozi)', attivita == 24),
        'servizi_persona': ('Servizi alla persona', 'MAIN 25: servizi alla persona', attivita == 25),
        'servizi': ('Banche, poste e uffici', 'MAIN 26: altri servizi (banca, posta)', attivita == 26),
        'culto': ('Luoghi di culto', 'ELOC 7: in un luogo di culto', eloc == 7),
        'scuola': ('Scuola', 'ELOC 4: a scuola', eloc == 4),
        'sport': ('Sport', 'MAIN 42: sport o esercizio, fuori casa (ELOC diverso da 1)', (attivita == 42) & (eloc != 1)),
        'partite': ('Partite e gare', 'MAIN 36: assistere a un evento sportivo', attivita == 36),
        'spettacoli': ('Spettacoli e cultura', 'MAIN 37 e 38: cinema, teatro, concerti, altri eventi pubblici',
                       np.isin(attivita, [37, 38])),
        'all_aperto': ('Svago all’aperto', 'MAIN 43, 45, 47 in ELOC 9: passeggiate, svago all’aperto, cane a spasso',
                       np.isin(attivita, [43, 45, 47]) & (eloc == 9)),
        'spostamenti': ('Spostamenti per lavoro e studio', 'MAIN 63 e 64: viaggi per lavoro e per studio',
                        np.isin(attivita, [63, 64])),
    }

    # Peso totale e numero dei diari per tipo di giorno (una volta per diario)
    primo = np.unique(diario[ok], return_index=True)[1]
    idx_ok = np.flatnonzero(ok)[primo]
    peso_tipo = {t: w[idx_ok][tipo[idx_ok] == t].sum() for t in ('feriale', 'sabato', 'domenica')}
    diari_tipo = {t: int((tipo[idx_ok] == t).sum()) for t in peso_tipo}
    print('diari per tipo di giorno:', diari_tipo)
    assert min(diari_tipo.values()) >= MIN_CASI

    def per_ora(maschera):
        """Minuti pesati per ora del giorno e diari distinti con tempo > 0 in ogni ora (giro di mezzanotte)."""
        s, e, ww, ids = start[maschera], start[maschera] + dur[maschera], w[maschera], diario[maschera]
        diff = np.zeros(2881)
        np.add.at(diff, s, ww); np.add.at(diff, e, -ww)
        p = np.cumsum(diff)[:2880]
        minuti = (p[:1440] + p[1440:]).reshape(24, 60).sum(axis=1)
        visti = [set() for _ in range(24)]
        for a, b, i in zip(s, e, ids):
            for m in range(a // 60, (b - 1) // 60 + 1):
                visti[m % 24].add(i)
        return minuti, np.array([len(x) for x in visti])

    # Giorno di calendario (0 = lunedì ... 6 = domenica) -> tipo del diario per le ore 4-23 e per le ore 0-3
    cal = ['feriale'] * 5 + ['sabato', 'domenica']
    prima = ['domenica'] + ['feriale'] * 5 + ['sabato']  # diario del giorno prima: lun <- dom, sab <- ven, dom <- sab

    profili = {}
    for chiave, (nome, definizione, m) in PROFILI.items():
        per_tipo = {}
        for t in peso_tipo:
            minuti, casi = per_ora(ok & (tipo == t) & m)
            per_tipo[t] = (minuti / (60 * peso_tipo[t]), casi)
        quota, soppresse, casi_min = [], 0, None
        for g in range(7):
            for h in range(24):
                t = cal[g] if h >= 4 else prima[g]
                q, n = per_tipo[t][0][h], int(per_tipo[t][1][h])
                if n < MIN_CASI:
                    quota.append(None); soppresse += 1
                else:
                    quota.append(round(float(q), 6)); casi_min = n if casi_min is None else min(casi_min, n)
        validi = [q for q in quota if q is not None]
        picco = max(validi) if validi else 0
        print(f"{chiave:16s} picco {picco:7.2%}  celle non pubblicate {soppresse:3d}/168  diari minimi {casi_min}")
        profili[chiave] = {'nome': nome, 'definizione': definizione, 'quota': quota,
                           'celle_non_pubblicate': soppresse, 'diari_minimi_per_valore': casi_min}

    if uscita:
        json.dump({
            'descrizione': 'Quota di persone (su tutti i diari del tipo di giorno) che in ogni ora della settimana sta in un '
                           'tipo di luogo o fa l’attività che ci si fa. Settimana dal lunedì 00:00 (indice 0) alla domenica '
                           '23:00 (indice 167). Aggregati: nessun microdato. null = meno di 30 diari, valore non pubblicato.',
            'fonte': 'ISTAT, Uso del tempo 2008-09 (diari giornalieri), armonizzati in IPUMS MTUS: variabili MAIN (attività, '
                     '69 categorie), ELOC (luogo), CLOCKST, TIME, DAY, PROPWT. Codici: MTUS User Guide, Chapter 3.',
            'giorni': 'Feriali (lunedì-venerdì) insieme, sabato e domenica a parte. Le ore 0-3 vengono dal diario del giorno prima.',
            'regola_30_casi': 'Ogni valore viene da almeno 30 diari distinti con tempo in quel luogo in quell’ora (termini UCL).',
            'citazioni': [
                'Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman, Etienne Breton, '
                'and Stephanie Richards. Multinational Time Use Study Extract System: Version 1.5 [dataset]. Minneapolis, MN: IPUMS, 2025. '
                'https://doi.org/10.18128/D062.V1.5',
                'This document uses the Multinational Time Use Study, Centre for Time Use Research, University College London 2019, '
                'http://www.timeuse.org/mtus/reference.html'],
            'diari_per_tipo_di_giorno': diari_tipo,
            'profili': profili}, open(uscita, 'w'), ensure_ascii=False, separators=(',', ':'))
        print('scritto', uscita)


if __name__ == '__main__':
    main(*sys.argv[1:3])
