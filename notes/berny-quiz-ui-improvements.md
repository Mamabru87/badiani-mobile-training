# 🎨 Berny Quiz - Interfaccia Migliorata

## Modifiche Visive Implementate

### Prima vs Dopo

**PRIMA:** Il mini quiz sembrava identico al quiz standard, senza indicazione che fosse Berny a generare la domanda.

**DOPO:** Quando Berny genera una domanda, l'interfaccia mostra chiaramente che è lui il "maestro" del quiz.

## Nuovi Elementi UI

### 1. **Header Berny** (berny-quiz-header)
Quando è un quiz generato da Berny, appare un header speciale in cima:
- **Avatar animato** di Berny (48x48px) che "si dondola" leggermente
- **Nome**: "Berny" in rosso #E30613
- **Sottotitolo**: "Il tuo assistente formazione"
- **Sfondo**: Gradient rosa-rosso con bordo

```css
.berny-quiz-header {
  background: linear-gradient(135deg, rgba(227, 6, 19, 0.08) 0%, rgba(236, 65, 140, 0.08) 100%);
  border: 2px solid rgba(227, 6, 19, 0.2);
}
```

### 2. **Chat Bubble** (berny-chat-bubble)
Il messaggio di introduzione appare come una chat bubble:
- **Stile messaggio chat**: bordo arrotondato con "coda" a sinistra
- **Testo in grassetto**: titolo del quiz
- **Messaggio personalizzato**: "Fammi vedere cosa hai studiato! Ho preparato una domanda su: [schede]"
- **Animazione slide**: entra da sinistra con fade

```css
.berny-chat-bubble {
  border-radius: 20px;
  border-top-left-radius: 4px; /* coda chat */
  animation: bernyBubbleSlide 0.4s ease-out;
}
```

### 3. **Avatar Animato nel Loading**
Durante la generazione della domanda:
- Avatar Berny più grande (60x60px)
- **Animazione "pensiero"**: piccolo cerchio al centro che pulsa
- Titolo rosso: "🧠 Berny sta pensando..."
- Puntini animati sotto

### 4. **Stile Quiz Personalizzato**
Quando `theme='berny'`:
- Card del quiz con **bordo rosso** invece che blu
- Opzioni di risposta con **hover rosso**
- Box-shadow rosso per enfasi
- Bottone "🙏 Più tardi Berny" invece di "Più tardi"

## Animazioni

### bernyWiggle
L'avatar si muove leggermente da sinistra a destra
```css
@keyframes bernyWiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}
```

### bernyBubbleSlide
La chat bubble entra da sinistra con fade
```css
@keyframes bernyBubbleSlide {
  0% { opacity: 0; transform: translateX(-20px); }
  100% { opacity: 1; transform: translateX(0); }
}
```

### bernyPulse
L'avatar durante il loading pulsa leggermente
```css
@keyframes bernyPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

## Codice Chiave

### JavaScript - Rilevamento Quiz Berny
```javascript
const isBernyQuiz = theme === 'berny' || (questions[0] && questions[0].generatedByBerny);

if (isBernyQuiz) {
  // Mostra header e chat bubble di Berny
} else {
  // Header normale
}
```

### HTML Struttura Header Berny
```html
<div class="berny-quiz-header">
  <div class="berny-quiz-avatar">
    <svg><!-- avatar Berny --></svg>
  </div>
  <div class="berny-quiz-info">
    <h3 class="berny-quiz-name">Berny</h3>
    <p class="berny-quiz-status">Il tuo assistente formazione</p>
  </div>
</div>

<div class="berny-chat-bubble">
  <div class="berny-chat-text">
    <p><strong>🧠 Quiz Personalizzato</strong></p>
    <p>Ho preparato una domanda basata su quello che hai studiato!</p>
  </div>
</div>
```

## Palette Colori Berny

- **Rosso primario**: #E30613
- **Rosa sfumato**: rgba(227, 6, 19, 0.08) - rgba(236, 65, 140, 0.08)
- **Bordo**: rgba(227, 6, 19, 0.2)
- **Shadow**: rgba(227, 6, 19, 0.15)

## Esperienza Utente

### Flusso Completo

1. **Utente ottiene 3 stelle**
2. **Loading Screen**: Avatar Berny che "pensa" + animazione puntini
3. **Quiz Screen con Header Berny**: 
   - Avatar animato con nome
   - Chat bubble con messaggio personalizzato
   - Domanda nel solito formato ma con colori rossi
4. **Risposta Corretta**: Avatar verde che rimbalza + messaggio "Ottimo lavoro! 🎉"
5. **Risposta Sbagliata**: Stesso comportamento standard

### Differenze Visive Chiave

| Elemento | Quiz Standard | Quiz Berny |
|----------|---------------|------------|
| Header | Titolo semplice | Avatar + Nome + Status |
| Intro | Testo normale | Chat bubble con coda |
| Colori | Blu/Rosa | Rosso/Rosa |
| Card border | Blu scuro | Rosso |
| Hover opzioni | Rosa | Rosso |
| Bottone cancel | "Più tardi" | "🙏 Più tardi Berny" |
| Animazioni | Standard | Wiggle + Slide |

## File Modificati

### scripts/site.js
- `startQuizSession()`: Aggiunto rilevamento `isBernyQuiz` e rendering condizionale
- Logica per mostrare header e chat bubble quando `theme === 'berny'`

### styles/site.css
- `.berny-quiz-header`: Stile header con avatar
- `.berny-quiz-avatar`: Container avatar con animazione
- `.berny-quiz-info`: Info nome e status
- `.berny-chat-bubble`: Bolla chat con coda
- `.berny-chat-text`: Testo formattato nella bolla
- `.quiz-screen--berny`: Override colori per tema Berny
- Animazioni: `bernyWiggle`, `bernyBubbleSlide`

## Testing

### Come Verificare
1. Apri alcune schede (ottieni stelle oro)
2. Raggiungi 3 stelle
3. **Osserva**:
   - Loading con avatar Berny "pensante"
   - Header con avatar che si muove
   - Chat bubble che slide da sinistra
   - Domanda con bordi rossi
   - Bottone "Più tardi Berny"

### Screenshot Punti Chiave
- ✅ Header Berny visibile in alto
- ✅ Chat bubble con messaggio personalizzato
- ✅ Colori rossi invece che blu
- ✅ Animazioni fluide

## Note Tecniche

- **Retrocompatibilità**: Quiz standard continua a funzionare normalmente
- **Fallback**: Se Berny non genera domanda, usa pool standard (senza header Berny)
- **Performance**: Animazioni usano `transform` e `opacity` per GPU acceleration
- **Accessibilità**: Mantiene la stessa struttura HTML semantica

## Prossimi Miglioramenti Possibili

- 🎨 Aggiungere suoni quando appare Berny
- 💬 Variare i messaggi di Berny in base al contenuto
- 🌈 Animazione "typing" per il testo della chat bubble
- 📊 Mostrare "score" di personalizzazione (es: "basato su 3 schede studiate")
- 🎯 Aggiungere "tooltip" su avatar Berny con info extra
