# CityRhythm — Privacy: avviso, informativa, email

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca la privacy, l'informativa, l'avviso in basso a sinistra o qualsiasi servizio che esce dal dominio del sito, e si aggiorna col comando `/second-brain`.

**Stato (2026-10-12, sessione 33)**: in uso su `main`. Codice in `src/ui/ui-privacy.js` (avviso, tasto, pannello `<dialog>`, testo dell'informativa), stile in fondo a `style.css`, link «Privacy» nei crediti di MapLibre (`map-setup.js`, `customAttribution`).

## Decisioni valide
| Decisione | Perché |
|---|---|
| **Non è un banner del consenso**: niente «Accetta/Rifiuta» | Il sito non ha cookie, statistiche né chiamate esterne: non c'è nulla a cui acconsentire. Un «Rifiuta» che non cambia niente sarebbe una scelta finta. |
| **Avviso breve alla prima visita** in basso a sinistra («Nessun cookie, nessun tracciamento»), con «Leggi l'informativa» e «Ho capito» | Chi guarda la mappa deve saperlo senza cercarlo. |
| **Dopo la chiusura resta il tasto «Privacy»** (scudo) nello stesso angolo, apre l'informativa completa | Richiesta dell'utente: poter sempre rivedere tutto. |
| «Ho capito» salva `cityrhythm.privacyNote.v1`; la × **non salva niente** (l'avviso può tornare) | Si salva solo la scelta dell'utente, mai all'avvio. |
| Posizione: sotto i 1400 px l'avviso sale sopra la timeline, il tasto sotto i 920 px | La timeline è larga 640 px e centrata. |
| **Email offuscata come sul sito personale**: nell'HTML solo `nome [at] dominio` e un token base64 nel JS; l'indirizzo vero si ricostruisce al clic («Scrivi», «Copia»). Mai `mailto:` né chiocciola in chiaro, mai l'indirizzo in questo file | Stessa tecnica del footer del sito personale. Il base64 non è cifratura: evita solo gli harvester. |
| L'informativa dice «autore del progetto», non «ricercatore Unicam» | Il sito personale dice che non è un sito istituzionale. Da confermare con l'utente. |

## Verifica fatta il 2026-10-12 (Chromium, build di produzione)
- Nessun URL esterno nel codice se non link di crediti e licenze; nel CSS nessun `@font-face` né `@import` (caratteri del dispositivo).
- Prova di rete con Playwright: stile Toner, 3D, Mappa sonora, timeline, Periodo, clic su un'area → **zero richieste fuori dal dominio**, zero WebSocket.
- Unico «terzo»: **GitHub Pages** (vede l'IP come ogni server): dichiarato nell'informativa.
- Non provato su Safari/iPhone reali.

## Da rifare se cambia qualcosa
Se si aggiunge un servizio esterno (statistiche, font o tessere da un server, un modello scaricato), serve un **vero consenso per funzione, spento di partenza**, come in Warmish (`consent.svelte.ts`), e va rifatta la prova di rete. Se il sito esce da GitHub Pages, aggiornare il paragrafo sull'hosting. Modelli di riferimento dell'utente: repo `grazianoenzomarchesani.xyz` (banner con Accetta/Rifiuta pari peso, provv. Garante 231/2021) e `Warmish-Web`.
