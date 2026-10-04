---
name: second-brain
description: Aggiorna il second brain di CityRhythm (second-brain/SECOND_BRAIN.md) a fine sessione con il riassunto di cosa è stato fatto e deciso, spostando le decisioni non più valide fra le superate. Da usare quando l'utente chiede di chiudere la sessione, fare il riassunto, aggiornare il second brain, oppure scrive /second-brain.
---

# Aggiornare il second brain

File: `second-brain/SECOND_BRAIN.md` (più `second-brain/prompts.md` se sono cambiati i prompt).

1. **Rileggi** il second brain per intero.
2. **Raccogli cosa è cambiato in questa sessione**, dalla conversazione e da `git log` / `git status` / `git diff`: decisioni prese, file creati o modificati, asset generati, problemi trovati, opinioni espresse dall'utente.
3. **Aggiorna le sezioni**, senza riscrivere quello che non è cambiato:
   - *Decisioni valide*: aggiungi le nuove e modifica quelle cambiate.
   - *Decisioni superate*: sposta qui ogni decisione che non vale più, barrata, con una riga sul perché e su cosa la sostituisce. Non cancellarle.
   - *Stato degli asset / Strumenti*: devono riflettere i file che esistono davvero; verificali, non andare a memoria.
   - *Prossimi passi*: togli i fatti, aggiungi i nuovi.
   - *Diario delle sessioni*: aggiungi **una** voce con la data assoluta (AAAA-MM-GG), al massimo 3 righe.
   - Aggiorna la data in "Ultimo aggiornamento".
4. **Stile**: italiano, sintetico, tabelle ed elenchi, niente cronaca minuto per minuto. Il file deve restare leggibile in un paio di minuti (indicativamente sotto le 200 righe). Se cresce troppo, comprimi le voci vecchie del diario.
5. Non inserire segreti (token, password, email).
6. Alla fine riferisci all'utente, in 3–5 righe, cosa hai aggiunto, cambiato o spostato fra le decisioni superate.
