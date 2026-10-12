// Privacy: un avviso breve alla prima visita e l'informativa completa in un pannello.
//
// Non è un banner del consenso, e di proposito: il sito non usa cookie, non misura le visite e non chiama servizi
// esterni, quindi non c'è nulla a cui acconsentire (nessun «Accetta/Rifiuta» che sarebbe una scelta finta).
// L'unico dato salvato nel browser è la preferenza di stile della mappa, che sceglie l'utente (provv. Garante 231/2021:
// le preferenze richieste dall'utente non servono il consenso). Se un giorno si aggiunge un servizio esterno
// (statistiche, mappe da un server, font), questo file va cambiato nella stessa sessione: vedi privacy.md.
//
// Si apre da: avviso della prima visita, link «Privacy» nei crediti della mappa (qualunque link a #privacy).

const NOTE_KEY = 'cityrhythm.privacyNote.v1'; // si salva solo quando l'utente chiude l'avviso, mai all'avvio
const AGGIORNATA = 'ottobre 2026';

// Email: stessa tecnica del sito personale. Nell'HTML non c'è mai una stringa con la chiocciola né un mailto:
// il testo visibile è «nome [at] dominio»; l'indirizzo vero si ricostruisce solo al clic (base64 = non è cifratura,
// serve a non farsi raccogliere dai programmi che leggono l'HTML).
const EMAIL_TOKEN = 'Z3Jhemlhbm8ubWFyY2hlc2FuaUB1bmljYW0uaXQ=';
const EMAIL_VISIBILE = 'graziano.marchesani [at] unicam.it';
const email = () => atob(EMAIL_TOKEN);

const leggi = () => { try { return localStorage.getItem(NOTE_KEY) === '1'; } catch (e) { return false; } };
const scrivi = () => { try { localStorage.setItem(NOTE_KEY, '1'); } catch (e) { /* archivio non disponibile: l'avviso tornerà */ } };

function el(tag, attrs = {}, ...figli) {
    const nodo = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'text') nodo.textContent = v;
        else nodo.setAttribute(k, v);
    }
    nodo.append(...figli);
    return nodo;
}

// Il testo è scritto a mano in questo file: nessun pezzo viene da input esterni, quindi innerHTML è sicuro.
const INFORMATIVA = `
<h3>In breve</h3>
<p>CityRhythm funziona <strong>interamente nel tuo browser</strong>. Non usa cookie, non conta le visite, non ha pubblicità, non crea profili e non ti chiede nessun dato. Mappe, dati, suoni e caratteri arrivano da questo stesso indirizzo (o dal tuo dispositivo): il sito non chiama servizi di terzi.</p>

<h3>Chi se ne occupa</h3>
<p>Graziano Enzo Marchesani, autore del progetto. Per qualsiasi domanda sui tuoi dati scrivi all’indirizzo qui sotto.</p>
<div class="privacy-mail">
    <span class="privacy-mail-testo">${EMAIL_VISIBILE}</span>
    <button type="button" class="btn" data-mail="scrivi">Scrivi</button>
    <button type="button" class="btn" data-mail="copia">Copia</button>
</div>
<p class="note">La scrivi sostituendo [at] con la chiocciola. Nessun messaggio passa da questo sito: la posta va dal tuo servizio al mio, e viene ricevuta sui server di posta dell’Università di Camerino, che li gestisce con le proprie regole.</p>

<h3>Che cosa resta nel tuo browser</h3>
<p>Una sola cosa, e solo se la scegli tu: lo stile della mappa (Nolli o Toner), in una voce chiamata <code>cityrhythm.mapStyle.v2</code>. Se chiudi questo avviso, ne salviamo un’altra, <code>cityrhythm.privacyNote.v1</code>, per non fartelo rivedere. Restano sul tuo dispositivo e non vengono mai inviate: puoi cancellarle dalle impostazioni del browser quando vuoi. Sono preferenze che hai chiesto tu, per questo non serve un consenso.</p>

<h3>Che cosa vede chi ospita il sito</h3>
<p>Il sito è pubblicato con GitHub Pages (GitHub, Inc., Stati Uniti). Come ogni server web, chi ospita il sito riceve il tuo indirizzo IP e i dati tecnici della richiesta (browser, pagina richiesta) per consegnarti le pagine. Io non li ricevo e non posso consultarli; li tratta GitHub secondo la <a href="https://docs.github.com/it/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">propria informativa</a>.</p>

<h3>I dati sulla mappa non riguardano persone</h3>
<p>I puntini sono una rappresentazione statistica: mostrano percentuali di presenza per quartiere e per ora, non seguono persone reali. Il sito non sa dove sei e non usa posizione, microfono o fotocamera. Il suono si accende solo quando lo accendi tu.</p>

<h3>Link verso l’esterno</h3>
<p>I crediti e i riferimenti rimandano a siti esterni (OpenStreetMap, ISTAT, IPUMS e altri). Se li apri, valgono le regole di quei siti.</p>

<p class="note">Ultimo aggiornamento: ${AGGIORNATA}.</p>`;

let dialogo = null;
let avviso = null;
let tasto = null; // il tasto «Privacy» sempre visibile in basso a sinistra, al posto dell'avviso una volta chiuso
let fuoco = null; // l'elemento che aveva il fuoco prima dell'apertura, a cui si torna alla chiusura

function costruisciDialogo() {
    const chiudi = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi l’informativa', text: '×' });
    const testa = el('header', { class: 'drawer-head' }, el('h2', { id: 'privacy-titolo', class: 'drawer-title', text: 'Privacy' }), chiudi);
    const corpo = el('div', { class: 'drawer-body privacy-corpo' });
    corpo.innerHTML = INFORMATIVA;

    const d = el('dialog', { id: 'privacy-dialog', class: 'privacy-dialog', 'aria-labelledby': 'privacy-titolo' }, testa, corpo);
    chiudi.addEventListener('click', () => d.close());
    // Clic sullo sfondo (fuori dalla scheda) chiude, come Esc
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => { fuoco?.focus?.(); fuoco = null; });
    corpo.addEventListener('click', async e => {
        const b = e.target.closest('[data-mail]');
        if (!b) return;
        if (b.dataset.mail === 'scrivi') { location.href = 'mailto:' + email(); return; }
        try {
            await navigator.clipboard.writeText(email());
            b.textContent = 'Copiato';
        } catch (err) {
            b.textContent = 'Copia non riuscita'; // niente fallback che scriva l'indirizzo nell'HTML
        }
        setTimeout(() => { b.textContent = 'Copia'; }, 2000);
    });
    document.body.append(d);
    return d;
}

export function apriPrivacy() {
    fuoco = document.activeElement;
    dialogo ??= costruisciDialogo();
    if (!dialogo.open) dialogo.showModal();
}

function chiudiAvviso(ricorda) {
    if (ricorda) scrivi();
    avviso?.remove();
    avviso = null;
    if (tasto) tasto.hidden = false; // chiuso l'avviso resta il tasto, per rivedere tutto
}

function mostraAvviso() {
    const ok = el('button', { type: 'button', class: 'btn', text: 'Ho capito' });
    const info = el('button', { type: 'button', class: 'btn', text: 'Leggi l’informativa' });
    ok.addEventListener('click', () => chiudiAvviso(true));
    info.addEventListener('click', () => { apriPrivacy(); });
    const x = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi l’avviso', text: '×' });
    x.addEventListener('click', () => chiudiAvviso(false)); // la × non registra nulla: l’avviso può tornare

    avviso = el('section', { class: 'privacy-note', 'aria-label': 'Privacy' },
        el('div', { class: 'privacy-note-head' }, el('strong', { text: 'Nessun cookie, nessun tracciamento' }), x),
        el('p', { text: 'CityRhythm lavora nel tuo browser e non raccoglie dati su di te. Per questo non ti chiediamo di accettare nulla.' }),
        el('div', { class: 'privacy-note-azioni' }, info, ok));
    if (tasto) tasto.hidden = true;
    document.body.append(avviso);
}

function creaTasto() {
    tasto = el('button', { type: 'button', class: 'privacy-tasto', 'aria-label': 'Privacy: rivedi l’informativa' });
    tasto.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z"/></svg><span>Privacy</span>';
    tasto.addEventListener('click', apriPrivacy);
    document.body.append(tasto);
}

export function setupPrivacy() {
    // Qualsiasi link a #privacy (per ora quello nei crediti della mappa, dove MapLibre toglie gli attributi data-) apre l'informativa
    document.addEventListener('click', e => {
        const a = e.target.closest('a[href="#privacy"]');
        if (!a) return;
        e.preventDefault();
        apriPrivacy();
    });
    creaTasto();
    if (!leggi()) mostraAvviso();
}
