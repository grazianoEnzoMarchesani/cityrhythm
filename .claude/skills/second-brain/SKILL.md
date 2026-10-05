---
name: second-brain
description: Aggiorna il second brain di CityRhythm (second-brain/: indice SECOND_BRAIN.md più file per argomento) a fine sessione con il riassunto di cosa è stato fatto e deciso, spostando le decisioni non più valide fra le superate. Da usare quando l'utente chiede di chiudere la sessione, fare il riassunto, aggiornare il second brain, oppure scrive /second-brain.
---

# Aggiornare il second brain

File in `second-brain/`:
- `SECOND_BRAIN.md` — **indice**, caricato in ogni sessione: progetto in breve, dati, obiettivo, **regole permanenti**, "Dove trovare cosa", prossimi passi, diario, prompt per la prossima sessione. Deve restare corto (indicativamente sotto le 100 righe / 15 KB).
- File di argomento, ognuno con la sua tabella "Decisioni valide": `bussola-clima.md`, `audio.md` (anche lo stato degli asset audio), `mappa.md`, `persone.md`.
- `decisioni-superate.md`, `strumenti.md`, `prompts.md` (prompt musicali).
Se nasce un argomento nuovo che non sta in nessun file, crea un file nuovo con la stessa intestazione degli altri e aggiungilo alla tabella "Dove trovare cosa" dell'indice.

1. **Rileggi** l'indice e i file di argomento toccati dalla sessione.
2. **Raccogli cosa è cambiato in questa sessione**, dalla conversazione e da `git log` / `git status` / `git diff`: decisioni prese, file creati o modificati, asset generati, problemi trovati, opinioni espresse dall'utente.
3. **Aggiorna le sezioni**, senza riscrivere quello che non è cambiato:
   - *Decisioni valide*: aggiungi le nuove e modifica quelle cambiate **nel file del loro argomento** (non nell'indice). Nell'indice vanno solo le regole permanenti.
   - *Decisioni superate* (`decisioni-superate.md`): sposta qui ogni decisione che non vale più, barrata, con una riga sul perché e su cosa la sostituisce. Non cancellarle.
   - *Stato degli asset* (`audio.md`) / *Strumenti* (`strumenti.md`): devono riflettere i file che esistono davvero; verificali, non andare a memoria.
   - *Prossimi passi* (indice): togli i fatti, aggiungi i nuovi.
   - *Diario delle sessioni* (indice): aggiungi **una** voce con la data assoluta (AAAA-MM-GG), al massimo 3 righe.
   - Aggiorna la data in "Ultimo aggiornamento" dell'indice.
4. **Stile**: italiano, sintetico, tabelle ed elenchi, niente cronaca minuto per minuto. L'indice deve restare leggibile in un paio di minuti: se cresce, comprimi le voci vecchie del diario o sposta dettagli nei file di argomento. Un file di argomento troppo lungo si può dividere in due.
5. Non inserire segreti (token, password, email).
6. Alla fine riferisci all'utente, in 3–5 righe, cosa hai aggiunto, cambiato o spostato fra le decisioni superate.
