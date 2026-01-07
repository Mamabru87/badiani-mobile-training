# Berny Adaptive Quiz - Integrazione AI nel Mini Quiz

## Panoramica

Il mini quiz (quello che appare ogni 3 stelle) è stato integrato con Berny, l'assistente AI del sistema. Ora Berny analizza le schede studiate dall'utente e genera domande personalizzate basate sui contenuti effettivamente consultati.

## Come Funziona

### 1. Tracciamento delle Schede Studiate

Il sistema già traccia tutte le schede aperte dall'utente in `state.openedTabContextToday`, che contiene:
- `pageSlug`: la pagina del contenuto (es: 'caffe', 'gelato-lab')
- `cardTitle`: titolo della scheda
- `tabTitle`: titolo del tab aperto
- `content`: contenuto testuale della scheda
- `ts`: timestamp di apertura

### 2. Generazione Domanda con Berny

Quando l'utente ottiene 3 stelle e attiva il mini quiz:

1. **Raccolta Contesto**: La funzione `getStudiedCardsContent()` recupera le schede studiate con contenuto
2. **Preparazione Prompt**: Viene creato un prompt che include:
   - Le ultime 5 schede studiate (per non sovraccaricare)
   - Un'istruzione specifica per generare una domanda a quiz
   - Il formato JSON richiesto per la risposta
3. **Chiamata API**: Viene chiamato `window.bernyBrain.processMessage()` per generare la domanda
4. **Parsing Risposta**: La risposta JSON viene parsata e validata
5. **Conversione Formato**: La domanda viene convertita nel formato del sistema quiz esistente

### 3. Fallback Automatico

Se Berny non è disponibile o non riesce a generare una domanda:
- Il sistema usa automaticamente il pool di domande standard
- L'utente non vede errori, il quiz continua normalmente
- Viene loggato un messaggio di debug per troubleshooting

## Interfaccia Utente

### Loading State
Quando Berny sta generando la domanda, appare:
- Avatar animato di Berny (cerchio rosso con faccina)
- Messaggio "Berny sta pensando..."
- Animazione di loading con puntini

### Intro Personalizzato
Una volta generata la domanda, Berny mostra:
- Messaggio personalizzato: "Fammi vedere cosa hai studiato!"
- Elenco delle schede su cui è basata la domanda
- Avatar di Berny nel titolo: "🧠 Berny Quiz"

### Success/Fail
- **Successo**: Avatar verde di Berny con messaggio congratulatorio
- **Fallimento**: Stesso comportamento standard (penalità -3 stelle)

## Codice Chiave

### File Modificati

1. **scripts/site.js**
   - `getStudiedCardsContent()`: recupera contenuto schede studiate
   - `generateBernyQuizQuestion()`: genera domanda con AI
   - `showMiniQuiz()`: modificata per integrare Berny
   - Supporto per tipo quiz 'mini-berny' nella history

2. **styles/site.css**
   - `.berny-avatar-section`: sezione avatar
   - `.berny-avatar-circle`: cerchio animato
   - `.berny-loading-dots`: animazione loading
   - Animazioni: `bernyPulse`, `bernyBounce`, `bernyDotBounce`

## Struttura Domanda Generata

```javascript
{
  id: 'berny-1234567890',
  topic: 'Berny Adaptive',
  question: 'Quale temperatura è corretta per...?',
  options: ['Opzione A', 'Opzione B', 'Opzione C', 'Opzione D'],
  correct: 1, // indice della risposta corretta
  explanation: 'Spiegazione della risposta...',
  generatedByBerny: true,
  basedOnCards: ['Caffè Espresso', 'Macinatura']
}
```

## Prompt Engineering

Il prompt inviato a Berny include:
- **Contesto**: Snippet delle schede studiate (primi 300 caratteri)
- **Istruzione**: Specifica chiara del tipo di domanda richiesta
- **Vincoli**: Difficoltà, formato, numero opzioni
- **Output Format**: JSON preciso per parsing automatico

## Testing e Debug

### Console Logs
Il sistema logga informazioni utili:
- `📚 Berny: trovate N schede studiate per il quiz`
- `🧠 Berny: generazione domanda in corso...`
- `✅ Berny: domanda generata con successo`
- `⚠️ Errore/Fallback messages`

### Verifica Funzionamento
1. Apri alcune schede (ottieni stelle oro)
2. Raggiungi 3 stelle per attivare il mini quiz
3. Osserva se appare l'avatar di Berny e il loading
4. Verifica che la domanda sia pertinente ai contenuti studiati

## Estensioni Future

### Per "Test Me" Quiz (secondo quiz)
La stessa logica può essere applicata al quiz più difficile:
1. Generare 3 domande invece di 1
2. Aumentare la difficoltà nel prompt
3. Usare più contesto dalle schede studiate
4. Variare le tipologie di domande

### Miglioramenti Possibili
- Cache delle domande generate per riuso
- Feedback loop: tracciare quali domande sono troppo facili/difficili
- Personalizzazione basata sullo storico errori dell'utente
- Domande multi-step o scenario-based

## Configurazione Berny API

Il sistema usa `window.bernyBrain.processMessage()` che supporta:
- **Proxy Mode**: chiamate tramite Cloudflare Worker
- **SDK Mode**: chiamate dirette a Gemini API
- Configurazione in `localStorage` come da sistema esistente

## Compatibilità

- ✅ Funziona con il sistema di stelle/cristalli esistente
- ✅ Compatibile con sistema di i18n (multilingua)
- ✅ Integrato con history quiz per "Errori recenti"
- ✅ Mantiene tutte le meccaniche di gamification
- ✅ Fallback automatico se AI non disponibile

## Note Tecniche

- La funzione è async/await per gestire la chiamata API
- Timeout gestito da Berny API layer
- JSON parsing robusto con gestione errori
- UI bloccata durante generazione (lockClose: true)
- Animazioni CSS performanti con transform/opacity
