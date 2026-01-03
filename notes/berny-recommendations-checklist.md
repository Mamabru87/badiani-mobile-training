# Berny – Checklist consigli schede (manuale)

## Scopo

Verificare che BERNY:

- non consigli sempre la stessa scheda
- allinei il testo della risposta con la scheda proposta
- gestisca input corti/small-talk (es. "come stai") improvvisando in modo utile

## Setup rapido

1. Apri `index.html` (consigliato via server statico, ma funziona anche file:// se non usi proxy).
2. Assicurati che il widget Berny sia visibile.
3. (Opzionale) Pulisci stato consigli per test pulito:

   - LocalStorage key: `badianiBerny.lastRecommendation.v1`

## Casi da provare

### Small talk / input corto

- "come stai"
- "ok"
- "ciao"

Atteso:

- risposta simpatica
- propone/apre una scheda *variabile* (non sempre la stessa)

### Keyword → scheda specifica

- "procedura apertura"
- "chiusura"
- "pulizia"
- "churros"
- "waffle"
- "crepe"
- "espresso"
- "cappuccino"
- "buontalenti"
- "coni"

Atteso:

- pulsante "Apri scheda" coerente con la keyword (pagina + `?q=`)

### Non riconosciuto (frase lunga)

- una domanda generica non legata al training

Atteso:

- Berny risponde; il link può non comparire oppure comparire solo se coerente.

## Note

Se vedi ancora la *stessa* scheda consigliata spesso:

- verifica che la risposta contenga `[[LINK:...]]` (tag invisibile) e che non venga eliminato da qualche altro script.
- verifica che il browser non stia usando una versione cached di `scripts/berny-brain-api.js` (bump del `?v=` in `index.html`).
