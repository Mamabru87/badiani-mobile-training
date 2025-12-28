/* Badiani Training Orbit – runtime i18n (no bundler, vanilla JS, IIFE)
   - Marks translatable nodes via data-i18n / data-i18n-html / data-i18n-attr.
   - Persists language in localStorage.
   - Does NOT translate product names/brand terms unless explicitly keyed.
*/

(() => {
  const STORAGE_KEY = 'badianiUILang.v1';
  const SUPPORTED = ['it', 'en', 'es', 'fr'];
  const DEFAULT_LANG = 'it';

  /** @type {Record<string, Record<string, string>>} */
  const dict = {
    it: {
      'lang.label': 'Lingua',
      'lang.it': 'Italiano',
      'lang.en': 'English',
      'lang.es': 'Español',
      'lang.fr': 'Français',

      'common.close': 'Chiudi',
      'toast.copied': 'Copiato negli appunti ✅',

      'quiz.generic': 'Quiz',
      'carousel.headerAria': 'Scorri il carosello: swipe sinistra/destra oppure clic (sinistra=precedente, destra=successivo)',

      'card.procedure': 'Procedura',
      'card.checklist': 'Checklist',
      'card.rules': 'Regole',
      'card.table': 'Tabella',
      'card.routine': 'Routine',
      'card.deepCleanSteps': 'Step deep clean',
      'card.stepsTips': 'Step & tips',
      'card.details': 'Dettagli',
      'card.use': 'Uso',
      'card.notes': 'Note',

      'gelatoLab.hero.badge': 'Linea gelato',
      'gelatoLab.hero.stars': '⭐ Stelle: 8/8',
      'gelatoLab.hero.desc': 'Manuale per il banco gelato: porzioni, servizio take me home, coppe scenografiche e manutenzione della vetrina a -14/-15 °C.',
      'gelatoLab.carousel.products.category': 'Linea gelato',
      'gelatoLab.ops.title': 'Setup & Conservazione',
      'gelatoLab.ops.category': 'Apertura · Setting · Storage · Scampoli · Chiusura',

      'gelatoLab.cards.cups.desc': 'Coppette in tre misure: Piccolo (1 gusto, 100 g), Medio (1-2 gusti, 140 g), Grande (1-3 gusti, 180 g). La chiave è dosare correttamente il gelato e compattarlo bene per eliminare bolle d\'aria e dare una presentazione uniforme.',
      'gelatoLab.cards.cups.stats': `<li>Pesatura: Piccolo 100-120g, Medio 160-200g, Grande 200-240g (controlla sempre)</li><li>Tecnica scoop: lineare + ball per look professionale</li><li>Compattamento: spingi il gelato sul lato della coppetta eliminando aria</li><li>Ammorbidimento spatola: scaldala passandola sul gelato per facilitare il prelievo</li><li>Completamento: offri sempre wafer e panna (upselling)</li><li>Temperatura ideale gelato: -14/-15°C (se più caldo è difficile da dosare)</li>`,
      'gelatoLab.cards.cups.details': `<div class="steps"><span>1 · Scalda spatola passando sul gusto per ammorbidirlo.</span><span>2 · Spingi gelato sul lato della coppetta eliminando aria.</span><span>3 · Offri wafer/panna e sorridi.</span></div><div class="tips">Bambini possono scegliere due gusti anche sul piccolo.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opzione 1:</strong> "Vuoi passare al medio? Aggiungi un altro gusto e panna"</span><span><strong>Opzione 2:</strong> "Ti aggiungo panna montata e wafer croccante?"</span><span><strong>Opzione 3:</strong> "Con salsa al pistacchio diventa ancora più goloso"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Pesa sempre le coppette per rispettare range grammi. Usa tecnica "scoop lineare + ball" per look professionale. Temperatura gelato ideale: -14/-15°C.</div>`,

      'gelatoLab.cards.cones.desc': 'Coni in tre varianti: Classico (1 gusto), Cioccolato o Gluten Free (1-2 gusti). Ogni cono va avvolto con tissue per grip e presentazione. Mantieni l\'area dei coni sempre pulita per evitare contaminazioni di sapori.',
      'gelatoLab.cards.cones.stats': `<li>Avvolgimento: tissue sempre, per grip e look</li><li>Dosaggio: 1 ball per cono piccolo, 1-2 ball per coni speciali (choco/GF)</li><li>Posizionamento: appoggia la ball ruotando il cono per stabilità</li><li>Pulizia area: ogni 30 minuti elimina briciole (assorbono umidità)</li><li>Stock rotation: FIFO rigoroso (i coni assorbono umidità, usa quelli meno freschi prima)</li><li>Upgrade upsell: cono cioccolato (ricoperto dentro e fuori), panna montata</li>`,
      'gelatoLab.cards.cones.details': `<div class="steps"><span>1 · Avvolgi cono con tissue.</span><span>2 · Prepara ball e appoggiala ruotando.</span><span>3 · Proponi upgrade al cono choco o panna montata.</span></div><div class="tips">Mantieni l\'area dei coni pulita eliminando briciole.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opzione 1:</strong> "Upgrade al cono cioccolato? è ricoperto dentro e fuori"</span><span><strong>Opzione 2:</strong> "Cono gluten-free disponibile (se presente)"</span><span><strong>Opzione 3:</strong> "Vuoi panna montata sopra per look Instagram?"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Pulisci area coni ogni 30 minuti per eliminare briciole. Rotazione stock: i coni assorbono umidità, usa FIFO rigoroso. Avvolgi sempre con tissue per grip.</div>`,

      'gelatoLab.cards.boxes.desc': 'Gelato da asporto in box termici da 500/750/1000 ml. Ogni box mantiene il gelato al giusto stato per circa 1 ora se messo nella borsa termica. Comunica sempre al cliente di mettere subito in freezer a casa: il gelato cambia di consistenza quando si scongela.',
      'gelatoLab.cards.boxes.stats': `<li>Piccolo: 500 ml (1-3 gusti)</li><li>Medio: 750 ml (1-4 gusti)</li><li>Grande: 1000 ml (1-5 gusti)</li><li>Ordine inserimento: inizia dai gusti più morbidi (sorbet prima) per evitare contaminazione sapori</li><li>Compattamento: elimina bene le bolle d\'aria, pulisci bordi con spatola prima di sigillare</li><li>Sigillatura: film + nastro Badiani, consegna in borsa termica</li><li>Autonomia: 1 ora in borsa termica; comunica sempre il freezer a casa per mantenere qualità</li>`,
      'gelatoLab.cards.boxes.details': `<div class="steps"><span>1 · Inserisci gusti iniziando dai più morbidi (sorbet prima per evitare contaminazioni).</span><span>2 · Compatta eliminando bolle d\'aria e pulisci bordi.</span><span>3 · Sigilla con film + nastro Badiani, consegna in borsa.</span></div><div class="tips">Upsell box più grande + pack 10 waffle o coni.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opzione 1:</strong> "Il box grande da 1L ti fa provare più gusti diversi"</span><span><strong>Opzione 2:</strong> "Aggiungiamo pack di coni per servire a casa?"</span><span><strong>Opzione 3:</strong> "Con borsa termica mantieni tutto perfetto fino a 2 ore"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Compatta bene eliminando aria per evitare cristalli. Pulisci bordi prima di sigillare. Autonomia: 1h in borsa termica, comunica sempre al cliente di mettere subito in freezer.</div>`,

      'gelatoLab.cards.coppa.desc': 'Tre boules di gelato in coppa di vetro, completate con panna montata, una salsa a scelta, mini cono e wafer Badiani. È la proposta “wow”: va costruita con ordine e servita subito per mantenere texture e pulizia del topping.',
      'gelatoLab.cards.coppa.stats': `<li>Base: coppa in vetro</li><li>Porzione: 3 scoops con scooper tondo (anche 3 gusti diversi)</li><li>Top: panna montata + swirl di sauce scelta</li><li>Finitura: mini cono + wafer Badiani</li><li>Servizio: cucchiaio in acciaio, consegna immediata</li>`,
      'gelatoLab.cards.coppa.details': `<div class="steps"><span>1 · Prendi una coppa di vetro e prepara i gusti con lo scooper tondo: 3 boules regolari (anche di gusti diversi).</span><span>2 · Completa con panna montata e uno swirl della sauce scelta (senza sporcare i bordi).</span><span>3 · Aggiungi mini cono + wafer Badiani e servi con cucchiaio in acciaio.</span></div><div class="tips">Proponi pairing con Slitti dragée per un dessert completo.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opzione 1:</strong> "Vuoi aggiungere granella di nocciola tostata e dragée Slitti?"</span><span><strong>Opzione 2:</strong> "Con doppia salsa pistacchio e cioccolato diventa signature"</span><span><strong>Opzione 3:</strong> "Abbinamento perfetto: Coppa + espresso affogato style"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Usa bicchieri in vetro freddi per mantenere temperatura. Monta boules con scooper tondo per estetica uniforme. Servi immediatamente dopo guarnizione per evitare scioglimento panna.</div>`,

      'gelatoLab.ops.displayPrep.title': 'Preparazione vetrina (mattino)',
      'gelatoLab.ops.displayPrep.desc': 'Pulisci, lucida e prepara la vetrina prima di esporre. Esponi solo quando la macchina arriva a -14/-15 °C.',
      'gelatoLab.ops.displayPrep.stats': `<li>Pulizia: panno umido con acqua calda + sanitiser giallo sulle macchie gelato</li><li>Metalli: blue spray + blue roll per far “shine” le superfici</li><li>Setup: inserisci barre porta-vaschette, accendi, posiziona vaschette e sliding doors</li><li>Esposizione: quando arriva a -14/-15 °C, carica i gusti e chiudi le sliding doors</li>`,
      'gelatoLab.ops.displayPrep.details': `<div class="steps"><span>1 · Pulisci e lucida (soprattutto metalli e sliding doors).</span><span>2 · Accendi e posiziona barre + vaschette.</span><span>3 · A -14/-15°C: esponi gelato e chiudi le porte scorrevoli.</span></div><div class="tips">Controlla prima lo scampoli freezer: se un gusto è recuperabile, usalo correttamente.</div>`,

      'gelatoLab.ops.tempDoors.title': 'Temperatura & porte (standard)',
      'gelatoLab.ops.tempDoors.desc': 'Standard chiave: vetrina a -14/-15 °C. Se lo store non è busy, le sliding doors devono essere in posizione per preservare la temperatura.',
      'gelatoLab.ops.tempDoors.stats': `<li>Target: -14/-15 °C (registra su log HACCP se previsto in store)</li><li>Porte: in posizione quando non c\'è servizio attivo</li><li>Utensili: le spatole usate per pulire vanno lavate e asciugate prima di passare ad altri gusti</li>`,
      'gelatoLab.ops.tempDoors.details': `<div class="steps"><span>1 · Controlla temperatura e annota secondo standard locale.</span><span>2 · Mantieni le sliding doors chiuse tra un servizio e l\'altro.</span><span>3 · Lava/asciuga gli utensili dopo ogni uso di pulizia per evitare contaminazioni.</span></div>`,

      'gelatoLab.ops.treatsShelfLife.title': 'Shelf life treats (dopo esposizione)',
      'gelatoLab.ops.treatsShelfLife.desc': 'Tabella rapida: giorni massimi dopo esposizione nella vetrina treats.',
      'gelatoLab.ops.treatsShelfLife.stats': `<li>Cakes / Pinguinos / Mini semifreddo: 35 giorni</li><li>Mini cakes / Mini cones: 21 giorni</li><li>Cookies: 14 giorni</li>`,
      'gelatoLab.ops.treatsShelfLife.details': `<div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">Shelf life una volta esposti</strong><span>Cakes / Pinguinos / Mini semifreddo: 35 giorni</span><span>Mini cakes / Mini cones: 21 giorni</span><span>Cookies: 14 giorni</span></div>`,

      'gelatoLab.ops.treatFreezer.title': 'Gestione treat freezer',
      'gelatoLab.ops.treatFreezer.desc': 'Vetrina verticale a -14 °C, defrost weekly, tutto esposto con guanti.',
      'gelatoLab.ops.treatFreezer.stats': `<li>Disporre cakes su shelf alto, cookies/pinguini su quello basso (eye level kids)</li><li>Shelf life dopo esposizione: cakes/pinguini 35 giorni, mini semifreddi 35, mini cakes 21, mini cones 21, cookies 14</li>`,
      'gelatoLab.ops.treatFreezer.details': `<div class="steps"><span>1 · Massimizza spazio, FIFO.</span><span>2 · Ricorda ai clienti che sono prodotti gelato.</span><span>3 · Usa box termico (autonomia 1h) per take away.</span></div><div class="tips">Pulizia ghiaccio weekly per mantenere visibilità impeccabile.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Tecnica 1:</strong> "Posiziona treats a eye-level bambini per vendite impulse"</span><span><strong>Tecnica 2:</strong> "Box misto pinguini/cookies per feste (secondo listino locale)"</span><span><strong>Tecnica 3:</strong> "Mini semifreddi perfetti per dessert last-minute a casa"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Mantieni freezer a -14°C costanti. Rimuovi ghiaccio settimanale con spatola plastica per non graffiare. Usa guanti sempre per manipolazione igienica.</div>`,

      'gelatoLab.ops.scampolo.title': 'Regola Scampolo (1/4 pan)',
      'gelatoLab.ops.scampolo.desc': 'Quando un gusto ha meno di 1/4 di vaschetta è uno scampolo e va sostituito. Puoi integrarlo poco alla volta nella vaschetta nuova, senza superare 5–7 cm.',
      'gelatoLab.ops.scampolo.stats': `<li>Definizione: &lt; 1/4 pan = scampolo</li><li>Aggiunta: circa 100 g alla volta (lato di uno scoop)</li><li>Limite: massimo 5–7 cm di scampolo totale</li>`,
      'gelatoLab.ops.scampolo.details': `<div class="steps"><span>1 · Prendi lo scampolo dallo scampoli freezer.</span><span>2 · Aggiungi piccoli quantitativi e livella (non deve “sembrare aggiunto”).</span><span>3 · Non superare 5–7 cm di scampolo complessivo.</span></div><div class="tips">Scampolo = controllo sprechi, ma sempre rispettando lo standard visivo.</div>`,

      'gelatoLab.ops.closeDeepClean.title': 'Chiusura & deep clean vetrina',
      'gelatoLab.ops.closeDeepClean.desc': 'Routine: vetrina OFF ogni notte. Deep clean completo una volta a settimana, inclusa la pulizia filtri.',
      'gelatoLab.ops.closeDeepClean.stats': `<li>Ogni sera: switch off + pulizia ordinaria</li><li>Weekly: deep clean completo + cleaning filtri</li><li>Focus: rimuovere nuts/crumbs e sanificare tutte le superfici</li>`,
      'gelatoLab.ops.closeDeepClean.details': `<div class="steps"><span>1 · Rimuovi pannelli bottom e pulisci macchie gelato.</span><span>2 · Elimina nuts/crumbs; sanitising spray + panno su tutte le superfici.</span><span>3 · Blue spray + blue roll per lucidare; deep clean label stands; rimonta e riaccendi.</span></div><div class="tips">Porte scorrevoli: se non busy, devono essere in posizione per preservare temperatura.</div>`,

      'gelatoLab.footer.tagline': "L'arte del gelato fiorentino",
      'gelatoLab.footer.tempLabel': 'Temp. Ideale',
      'gelatoLab.footer.heritageLabel': 'Heritage',

      'caffe.hero.badge': 'Bar & Drinks · 2025',
      'caffe.hero.stars': '⭐ Stelle: 18/18',
      'caffe.hero.desc': 'La guida completa al beverage Badiani: dai classici della caffetteria italiana al nuovo Matcha Bar, fino agli Smoothies e le bevande fredde. Include procedure per servizio al tavolo e Take Away (TW).',

      'sweetTreats.hero.badge': 'Linea Dessert · 2025',
      'sweetTreats.hero.stars': '⭐ Stelle: 13/13',
      'sweetTreats.hero.desc': 'Laboratorio digitale per crepe, waffle, burger di GELATO e set da tè. Include grammature, shelf life, ordine di assemblaggio e scenografia di servizio per stupire in boutique.',

      'sweetTreats.carousel.main.title': 'Sweet Crepes & Waffles',
      'sweetTreats.carousel.main.category': 'Dolci tentazioni',

      'sweetTreats.cards.crepeSauce.desc': 'Crepe classica servita con una delle nostre salse signature (Pistacchio, Nocciola, Cioccolato). Base perfetta per ogni aggiunta.',
      'sweetTreats.cards.crepeSauce.stats': `<li><strong>Shelf life mix:</strong> 3 giorni (frigo)</li><li><strong>Riposo:</strong> almeno 2 ore (frigo)</li><li><strong>Cottura:</strong> 20s per lato</li>`,
      'sweetTreats.cards.crepeSauce.details': `<div class="steps"><span>1 · Stendi mix, gira quando dorata.</span><span>2 · Spalma la salsa su metà, chiudi a mezzaluna poi a ventaglio.</span><span>3 · Impiatta, zucchero a velo e drizzle di salsa sopra.</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> La piastra deve essere ben calda ma non fumante. Il primo giro è spesso di test.</div>`,

      'sweetTreats.cards.buontalentiCrepe.desc': 'Il nostro best seller: Crepe con salsa a scelta e uno scoop di Buontalenti on top.',
      'sweetTreats.cards.buontalentiCrepe.stats': `<li><strong>GELATO:</strong> 1 scoop Buontalenti (70g)</li><li><strong>Salsa:</strong> 30g interna + decorazione</li><li><strong>Servizio:</strong> Piatto dessert con posate</li>`,
      'sweetTreats.cards.buontalentiCrepe.details': `<div class="steps"><span>1 · Prepara la crepe con salsa come da standard.</span><span>2 · Piega a ventaglio e spolvera con zucchero a velo.</span><span>3 · Adagia lo scoop di Buontalenti sopra e finisci con salsa.</span></div><div class="tips">Aggiungi il GELATO solo all'ultimo secondo per evitare che si sciolga sulla crepe calda.</div>`,

      'sweetTreats.cards.waffles.desc': 'Waffle dorato e croccante fuori, soffice dentro. Servito con salse, frutta o GELATO.',
      'sweetTreats.cards.waffles.stats': `<li><strong>Cottura:</strong> 2.5 min per lato (5 min tot)</li><li><strong>Riposo:</strong> 45s per croccantezza</li><li><strong>Batter:</strong> 1 scoop (177ml)</li>`,
      'sweetTreats.cards.waffles.details': `<div class="steps"><span>1 · Versa il mix nella piastra calda e chiudi.</span><span>2 · Cuoci 2.5 min, gira e cuoci altri 2.5 min.</span><span>3 · Lascia riposare su griglia 45s prima di decorare.</span></div><div class="tips">Il riposo è fondamentale: se servito subito risulta molle.</div>`,

      'sweetTreats.cards.pancake.desc': 'Torre di 3 pancake soffici. Serviti con sciroppo d\'acero, frutta fresca o salse Badiani.',
      'sweetTreats.cards.pancake.stats': `<li><strong>Porzione:</strong> 3 pezzi</li><li><strong>Cottura:</strong> Fino a comparsa bolle</li><li><strong>Topping:</strong> Generoso</li>`,
      'sweetTreats.cards.pancake.details': `<div class="steps"><span>1 · Versa 3 dischi di impasto sulla piastra.</span><span>2 · Gira quando compaiono le bolle in superficie.</span><span>3 · Impila e decora abbondantemente.</span></div>`,

      'sweetTreats.cards.italianaPlain.desc': 'Mozzarella, rucola e pomodorini su base classica. Fresca e leggera.',
      'sweetTreats.cards.italianaPlain.stats': `<li><strong>Base:</strong> Classica</li><li><strong>Ripieno:</strong> Mozzarella, rucola, pomodorini</li><li><strong>Condimento:</strong> Olio EVO, sale, origano</li>`,
      'sweetTreats.cards.italianaPlain.details': `<div class="steps"><span>1 · Cuoci la crepe e gira.</span><span>2 · Aggiungi mozzarella e fai sciogliere leggermente.</span><span>3 · Aggiungi rucola e pomodorini conditi, chiudi a portafoglio.</span></div>`,

      'sweetTreats.cards.italianaBeetroot.desc': 'La variante colorata: impasto alla barbabietola per un look unico e un tocco dolce-terroso.',
      'sweetTreats.cards.italianaBeetroot.stats': `<li><strong>Base:</strong> Beetroot (Barbabietola)</li><li><strong>Ripieno:</strong> Mozzarella, rucola, pomodorini</li><li><strong>Visual:</strong> Colore rosso/viola intenso</li>`,
      'sweetTreats.cards.italianaBeetroot.details': `<div class="steps"><span>1 · Usa il mix beetroot (3g polvere per 250g mix).</span><span>2 · Procedi come per la classica Italiana.</span><span>3 · Il contrasto di colori è il punto di forza: lascia intravedere il ripieno.</span></div>`,

      'sweetTreats.cards.prosciuttoPlain.desc': 'Classica con Prosciutto Crudo, mozzarella e rucola.',
      'sweetTreats.cards.prosciuttoPlain.stats': `<li><strong>Base:</strong> Classica</li><li><strong>Ripieno:</strong> Crudo, mozzarella, rucola</li><li><strong>Servizio:</strong> Calda e filante</li>`,
      'sweetTreats.cards.prosciuttoPlain.details': `<div class="steps"><span>1 · Sciogli la mozzarella sulla crepe in cottura.</span><span>2 · Aggiungi il prosciutto a fine cottura per non cuocerlo troppo.</span><span>3 · Completa con rucola e chiudi.</span></div>`,

      'sweetTreats.cards.prosciuttoBeetroot.desc': 'Prosciutto Crudo su base alla barbabietola. Un twist moderno su un classico.',
      'sweetTreats.cards.prosciuttoBeetroot.stats': `<li><strong>Base:</strong> Beetroot</li><li><strong>Ripieno:</strong> Crudo, mozzarella, rucola</li><li><strong>Gusto:</strong> Sapido + dolce (impasto)</li>`,
      'sweetTreats.cards.prosciuttoBeetroot.details': `<div class="steps"><span>1 · Prepara la base beetroot.</span><span>2 · Farcisci generosamente.</span><span>3 · Servi tagliata a metà per mostrare gli strati.</span></div>`,

      'sweetTreats.cards.gelatoBurger.desc': 'Una scoop di GELATO in una brioche morbida, chiusa a caldo in pochi secondi: effetto “wow” e servizio veloce.',
      'sweetTreats.cards.gelatoBurger.stats': `<li><strong>Pane:</strong> Brioche bun leggermente scaldato</li><li><strong>GELATO:</strong> 1 scoop (circa 70 g) a scelta</li><li><strong>Sauce:</strong> 1 sola scelta (standard)</li>`,
      'sweetTreats.cards.gelatoBurger.details': `<div class="steps"><span>1 · Scalda leggermente la brioche (non tostare troppo).</span><span>2 · Inserisci una scoop di GELATO (circa 70 g) e rifinisci con una sola salsa a scelta.</span><span>3 · Chiudi, servi subito e consiglia di mangiare come un panino.</span></div>`,

      'sweetTreats.ops.title': 'Setup & Conservazione',
      'sweetTreats.ops.category': 'Apertura · Setting · Dati tecnici · Storage · Chiusura',

      'sweetTreats.ops.opening.title': 'Checklist apertura stazioni',
      'sweetTreats.ops.opening.desc': 'Prima del servizio verifica che le macchine siano pronte e che mix/ingredienti siano in ordine. La Gelato Burger Machine va accesa all\'apertura e spenta alla chiusura.',
      'sweetTreats.ops.opening.stats': `<li>Waffle machine: accendi e attendi entrambe le luci verdi (READY + POWER)</li><li>Gelato Burger Machine: ON all'apertura; in genere pronta ~10 min dopo l'accensione</li><li>Crepe mix: deve aver riposato in frigo almeno 2 ore prima dell'uso</li>`,
      'sweetTreats.ops.opening.details': `<div class="steps"><span>1 · Accendi macchine e verifica che siano in temperatura/pronte.</span><span>2 · Controlla mix e scorte (etichette, FIFO, date).</span><span>3 · Prepara blue roll e bottiglie sauce per un banco pulito e veloce.</span></div><div class="tips">Obiettivo: zero attese al primo ordine e stazioni già “service ready”.</div>`,

      'sweetTreats.ops.settings.title': 'Settaggi macchine (standard)',
      'sweetTreats.ops.settings.desc': 'Imposta i parametri base prima del rush: riduce errori, sprechi e prodotti fuori standard.',
      'sweetTreats.ops.settings.stats': `<li>Waffle: olia leggermente con olio di semi; power livello 3; cottura 2,5 min per lato (tot 5 min)</li><li>Waffle: lascia riposare 45s prima di topping/GELATO (croccantezza)</li><li>Gelato Burger: timer 12 secondi; non serve oliare le piastre</li>`,
      'sweetTreats.ops.settings.details': `<div class="steps"><span>1 · Waffle: set power 3 e non iniziare finché READY + POWER sono attive.</span><span>2 · Gelato Burger: set timer 12s e usa solo blue-roll per eventuali gocce/salse.</span><span>3 · Mantieni la superficie sempre pulita: briciole = qualità visiva in caduta.</span></div><div class="tips">No oil sulla Gelato Burger machine: le superfici non vanno unte.</div>`,

      'sweetTreats.ops.storage.title': 'Shelf life & storage rapidi',
      'sweetTreats.ops.storage.desc': 'Questo modulo è “più storage che show”: tieni sempre sotto controllo date e condizioni.',
      'sweetTreats.ops.storage.stats': `<li>Crepe mix: shelf life 3 giorni (frigo) + riposo minimo 2 ore (frigo)</li><li>Waffle mix (pre-packed): shelf life 2 giorni</li><li>Gelato Burger: bun shelf life quando defrosted = 2 giorni</li><li>Gelato Croissant: plain croissant shelf life = 2 giorni</li>`,
      'sweetTreats.ops.storage.details': `<div class="steps"><span>1 · Applica etichette con data preparazione/apertura e scadenza.</span><span>2 · FIFO rigoroso: usa prima ciò che scade prima.</span><span>3 · Se fuori range/senza label: non servire.</span></div><div class="tips">Lo storage è training: qualità costante = clienti che tornano.</div>`,

      'sweetTreats.ops.portions.title': 'Porzionatura & dosi (quick ref)',
      'sweetTreats.ops.portions.desc': 'Una scheda “da banco”: dosi chiave per velocità e standard.',
      'sweetTreats.ops.portions.stats': `<li>Waffle: 1 scoop intero di batter = 177 ml</li><li>Crepe: 1 scoop o 1,5 small ladle scoop di mix</li><li>Signature Buontalenti Crepe: Buontalenti 70 g + sauce top ~30 g</li><li>Gelato Burger: 1 scoop di GELATO = 70 g (uno solo) + una sola scelta sauce</li>`,
      'sweetTreats.ops.portions.details': `<div class="steps"><span>1 · Usa scoop dedicati: riduci variazioni tra operatori.</span><span>2 · Se il prodotto esce fuori standard, correggi subito (non “compensare” con extra).</span><span>3 · Segna gli errori ricorrenti: sono training points.</span></div>`,

      'sweetTreats.ops.closing.title': 'Chiusura & pulizia rapida',
      'sweetTreats.ops.closing.desc': 'A fine giornata riduci residui e rischi: sulla Gelato Burger Machine si usa solo blue-roll per GELATO/salsa fuoriusciti e per rimuovere le briciole.',
      'sweetTreats.ops.closing.stats': `<li>Gelato Burger Machine: OFF a chiusura; superficie senza residui/particelle</li><li>Waffle: rimuovi residui e prepara la stazione per il giorno dopo</li><li>Mix: riponi in frigo con etichetta (o elimina se oltre shelf life)</li>`,
      'sweetTreats.ops.closing.details': `<div class="steps"><span>1 · Spegni le macchine e lascia raffreddare in sicurezza.</span><span>2 · Pulisci con blue-roll: niente olio sulle piastre Gelato Burger.</span><span>3 · Frigo + label per mix/ingredienti; smaltisci ciò che supera shelf life.</span></div><div class="tips">Pulito e asciutto oggi = apertura più veloce domani.</div>`,

      'sweetTreats.footer.tagline': 'Crepes, Waffles & More',
      'sweetTreats.footer.stat1.value': '10+ Varianti',
      'sweetTreats.footer.stat1.label': 'Menu',
      'sweetTreats.footer.stat2.value': 'Sweet & Savory',
      'sweetTreats.footer.stat2.label': 'Gusti',

      'pastries.hero.badge': 'Pasticceria da banco',
      'pastries.hero.stars': '⭐ Stelle: 6/6',
      'pastries.hero.desc': 'Tutte le referenze servite al banco: cakes, brownies, loaf, croissant farciti e scones con scoop di Buontalenti. Ogni scheda include shelf life, porzioni e script di upselling.',
      'pastries.hero.coverAlt': 'Cakes e brownie Badiani',

      'pastries.carousel.main.title': 'Pastry Lab',
      'pastries.carousel.main.category': 'Pasticceria da banco',

      'pastries.cards.cakes.alt': 'Fetta di torta Badiani',
      'pastries.cards.cakes.desc': 'Chocolate (3g), Carrot (2g), Walnut (3g) rispettando 14 fette per torta.',
      'pastries.cards.cakes.stats': `<li>Usa il cake slicer come guida</li><li>Servi su piatto con posate</li><li>Upsell scoop Buontalenti + sauce</li>`,
      'pastries.cards.cakes.details': `<div class="steps"><span>1 → Posiziona il cutter e incidi le 14 porzioni.</span><span>2 → Servi la fetta su piatto e racconta pairing con GELATO.</span><span>3 → Se upsell riuscito, aggiungi scoop con milkshake scooper e drizzle sulla fetta.</span></div><div class="tips">Ricorda al team: tazza di cioccolata calda + cake crea combo premium.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💫 Upselling</strong><span><strong>Opzione 1:</strong> "Vuoi arricchire la fetta con uno scoop di Buontalenti?"</span><span><strong>Opzione 2:</strong> "Aggiungiamo un drizzle di salsa pistacchio o caramello?"</span><span><strong>Opzione 3:</strong> "La combo perfetta? Cake + cioccolata calda"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> Conserva le cakes coperte con film tra un taglio e l'altro per evitare secchezza. Temperature ambiente: max 2 ore fuori frigo.</div>`,

      'pastries.cards.brownie.alt': 'Brownie Badiani',
      'pastries.cards.brownie.desc': 'Taglio 4x3 (12 pezzi) e servizio su piatto con cutlery.',
      'pastries.cards.brownie.stats': `<li>Display su tray dedicato</li><li>Upsell GELATO + sauce</li><li>Comunicare shelf life</li>`,
      'pastries.cards.brownie.details': `<div class="steps"><span>1 - Taglia 12 pezzi uguali, esponi su vassoio.</span><span>2 - All'ordine, impiatta e offri scoop Buontalenti.</span><span>3 - Servi con drizzle sul brownie e sul gelato.</span></div><div class="tips">Ricorda di usare il round scooper per mantenere porzione perfetta.</div>`,

      'pastries.cards.loaf.alt': 'Banana Loaf',
      'pastries.cards.loaf.desc': 'Ogni loaf deve fornire 10 fette. Servizio e upsell identici alle cakes.',
      'pastries.cards.loaf.stats': `<li>Taglia spessori costanti</li><li>Servi con posate</li><li>Proponi sauce preferita</li>`,
      'pastries.cards.loaf.details': `<div class="steps"><span>1 - Taglia 10 slice uguali, esponi la prima.</span><span>2 - Aggiungi scoop + sauce se il cliente accetta.</span><span>3 - Mantieni il loaf avvolto quando non in uso.</span></div><div class="tips">Comunica shelf life sul label per facilitare i controlli HACCP.</div>`,

      'pastries.cards.croissants.alt': 'Croissant farcito',
      'pastries.cards.croissants.desc': 'Croissant gia\' sfogliato, da farcire con la sauce richiesta dal cliente. Apri lateralmente, riempi e completa la presentazione su piatto con forchetta e coltello. Ricordati di riscaldare leggermente i croissant del giorno prima per ravvivare la fragranza.',
      'pastries.cards.croissants.stats': `<li>Shelf life: 2 giorni dal defrost (controlla data)</li><li>Incisione: usa coltello seghettato, apri il lato in orizzontale</li><li>Riempimento: sac a poche per uniformita' e precisione</li><li>Presentazione: sauce inside + drizzle sopra, piatto pulito, posate sempre</li><li>Riscaldamento (se necessario): 8-10 secondi solo; mai oltre 15s (la farcitura si scioglie)</li>`,
      'pastries.cards.croissants.details': `<div class="steps"><span>1 - Incidi lato con coltello seghettato.</span><span>2 - Riempie interno e topping esterno con la stessa sauce.</span><span>3 - Impiatta, aggiungi posate e servi.</span></div><div class="tips">Comunica shelf life e rotazione: 2 giorni dal defrost.</div>`,

      'pastries.cards.scone.alt': 'Scone ripieno di GELATO',
      'pastries.cards.scone.desc': 'Scalda 15 s nel gelato burger machine, farcisci con scoop Buontalenti e sauce.',
      'pastries.cards.scone.stats': `<li>Taglia orizzontalmente</li><li>Usa milkshake scooper</li><li>Finitura pistacchio o cioccolato</li>`,
      'pastries.cards.scone.details': `<div class="steps"><span>1 - Riscalda 15 s.</span><span>2 - Taglia, inserisci scoop e richiudi.</span><span>3 - Sauce top, impiatta con posate.</span></div><div class="tips">Ricorda ai clienti la doppia consistenza caldo/freddo per valorizzare l'upsell.</div>`,

      'pastries.ops.title': 'Setup & Conservazione',
      'pastries.ops.category': 'Apertura · Dati tecnici · Shelf life · FIFO · Chiusura',

      'pastries.ops.display.alt': 'Vetrina pastry Badiani',
      'pastries.ops.display.desc': 'Obiettivo apertura: vetrina piena, ordinata e leggibile. Label sempre accanto al tray corretto; le cakes sui cake stand con una fetta rimossa per mostrare l\'interno.',
      'pastries.ops.display.stats': `<li>CAKES: cake stands + rimuovi 1 slice (visual interno)</li><li>CROISSANTS: su tray dedicati (file pulite)</li><li>BROWNIES/PUDDING/TARTS/SCONES: su tray, allineati</li><li>LOAF: taglia e mostra la prima fetta sul tray</li>`,
      'pastries.ops.display.details': `<div class="steps"><span>1 · Ripristina vetrina “full look” (senza buchi visivi).</span><span>2 · Metti le label accanto al tray giusto (mai generiche).</span><span>3 · Verifica FIFO e shelf life prima del primo servizio.</span></div><div class="tips">Coerenza visiva = vendite. Il banco “pieno” invita all'acquisto.</div>`,

      'pastries.ops.cuts.desc': 'Porzioni costanti = qualità costante. Usa sempre gli stessi tagli per controllo food cost e per lavorare “in squadra”.',
      'pastries.ops.cuts.stats': `<li>Cake: usa il cake slicer guida 14 fette</li><li>Brownie tray: taglio 4×3 = 12 pezzi</li><li>Loaf: ricava 10 fette dalla forma intera</li>`,
      'pastries.ops.cuts.details': `<div class="steps"><span>1 · Usa sempre lo stesso strumento guida (slicer / righello visivo).</span><span>2 · Se una porzione è fuori standard, correggi subito il taglio successivo.</span><span>3 · Mantieni le lame pulite: taglio netto = presentazione premium.</span></div>`,

      'pastries.ops.shelf.desc': 'Lista shelf life per controlli quotidiani, rotazione e label corrette.',
      'pastries.ops.shelf.stats': `<li>Chocolate Cake: 3 giorni</li><li>Carrot Cake: 2 giorni</li><li>Walnut Cake: 3 giorni</li><li>Brownie: 4 giorni</li><li>Banana Loaf: 4 giorni</li><li>Croissants: 2 giorni</li><li>Scones: 2 giorni</li>`,
      'pastries.ops.shelf.details': `<div class="steps"><span>1 · Etichetta sempre: data defrost/apertura + scadenza.</span><span>2 · FIFO rigoroso (first in, first out).</span><span>3 · In dubbio: non servire (chiedi al manager).</span></div>`,

      'pastries.ops.full.desc': 'Regola vetrina: deve apparire sempre piena e ordinata. Le label stanno accanto al tray corretto, sempre.',
      'pastries.ops.full.stats': `<li>Ridisponi i prodotti per chiudere vuoti (senza mescolare referenze)</li><li>Allinea fronti: brownie/loaf/croissant sempre “in squadra”</li><li>Controlla che le label siano leggibili e coerenti con il tray</li>`,
      'pastries.ops.full.details': `<div class="steps"><span>1 · Riempi e riallinea dopo ogni rush.</span><span>2 · Aggiorna le label quando cambia il tray (mai lasciare “vecchie”).</span><span>3 · Verifica scadenze durante i refill.</span></div><div class="tips">Visual merchandising = training: è una skill, non un dettaglio.</div>`,

      'pastries.ops.close.desc': 'Obiettivo: ripristinare ordine e preparare una partenza veloce domani, senza perdere controllo su shelf life.',
      'pastries.ops.close.stats': `<li>Rimuovi briciole e residui dai tray (prima che diventino “incollati”)</li><li>Raggruppa per referenza e verifica scadenze (FIFO)</li><li>Controlla che tutte le label siano presenti e corrette</li>`,
      'pastries.ops.close.details': `<div class="steps"><span>1 · Riordina per categoria, controlla date e scarta ciò che è oltre shelf life.</span><span>2 · Pulisci superfici e tray; asciuga prima di richiudere.</span><span>3 · Prepara il banco “apertura-ready”: label e layout già impostati.</span></div>`,

      'pastries.footer.tagline': 'Colazione & Merenda',
      'pastries.footer.stat1.value': 'Daily',
      'pastries.footer.stat1.label': 'Frequenza',
      'pastries.footer.stat2.value': 'Fresh',
      'pastries.footer.stat2.label': 'Qualità',

      'nav.menu': 'Menu',
      'nav.homeAria': 'Torna alla home Badiani',
      'nav.profileAria': 'Profilo utente',
      'nav.profileLabel': 'Profilo',

      'menu.cluster.orbit': 'Orbit',
      'menu.cluster.beverage': 'Beverage & Treats',
      'menu.cluster.gelato': 'Gelato & Speciali',

      'menu.link.hub': 'Hub',
      'menu.link.storyOrbit': 'Story Orbit',
      'menu.link.operations': 'Operations & Setup',
      'menu.link.caffe': 'Bar & Drinks',
      'menu.link.sweetTreats': 'Sweet Treat Atelier',
      'menu.link.pastries': 'Pastry Lab',
      'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
      'menu.link.gelatoLab': 'Gelato Lab',
      'menu.link.festive': 'Festive & Churros',

      'drawer.categories': 'Categorie',
      'drawer.close': 'Chiudi menu',

      'quizSolution.eyebrow': 'Quiz · Soluzione',
      'quizSolution.title': 'Rivedi la risposta corretta',
      'quizSolution.loadingQuestion': 'Caricamento domanda...',
      'quizSolution.loadingAnswer': 'Caricamento risposta corretta...',
      'quizSolution.explainLabel': 'Spiegazione:',
      'quizSolution.tipLabel': 'Suggerimento:',
      'quizSolution.backHub': "⬅ Torna all'hub",
      'quizSolution.openSpecs': '📖 Apri specifiche',
      'quizSolution.back': '↩ Torna indietro',
      'quizSolution.correctAnswerPrefix': 'Risposta corretta:',
      'quizSolution.openSuggestedCard': '📖 Apri scheda consigliata',
      'quizSolution.noQuestion': 'Nessuna domanda ricevuta.',
      'quizSolution.retry': 'Riprova dal quiz.',

      'hub.badge': 'Training Orbit',
      'hub.eyebrow': 'Hub operativo · aggiornato ogni giorno',
      'hub.title': 'Playbook operativo Badiani 1932',
      'hub.lede': "Tradizione fiorentina, rituali di boutique e procedure digitalizzate in un'unica plancia: consulta, ripassa e chiudi i quiz per riscattare GELATO reali.",
      'hub.openCategories': 'Apri categorie',
      'hub.rules': 'Regolamento',
      'hub.pill.starsToday': '⭐ Stelle oggi:',
      'hub.pill.gelatiWon': '🍨 GELATO vinti:',
      'hub.pill.quizCorrect': '🎯 Quiz corretti:',

      'page.starsBadge': '⭐ Stelle: {{count}}/{{total}}',

      'cockpit.eyebrow': 'Orbit cockpit',
      'cockpit.title': 'Panoramica live',
      'cockpit.sub': 'Scorri le schede e resta sempre sul pezzo.',
      'cockpit.indicatorsAria': 'Indicatori panoramica',

      'cockpit.daily.eyebrow': 'Training',
      'cockpit.daily.badge': 'Live',
      'cockpit.daily.title': 'Training quotidiano',
      'cockpit.daily.loading': 'Caricamento domanda del giorno...',
      'cockpit.daily.hint': 'Apri una scheda, rispondi e guadagna stelline extra.',

      'cockpit.perf.eyebrow': 'Oggi',
      'cockpit.perf.badge': 'Aggiornato',
      'cockpit.perf.title': 'Performance oggi',
      'cockpit.stat.stars': 'Stelle',
      'cockpit.stat.bonusPoints': 'Punti Bonus',
      'cockpit.stat.gelatiWon': 'GELATO vinti',
      'cockpit.stat.quizCorrect': 'Quiz corretti',
      'cockpit.stat.quizWrong': 'Quiz sbagliati',

      'cockpit.totals.eyebrow': 'Storico',
      'cockpit.totals.badge': 'Totale',
      'cockpit.totals.title': 'Totali',
      'cockpit.totals.stars': 'Stelle totali',
      'cockpit.totals.gelati': 'GELATO totali',
      'cockpit.totals.bonus': 'Bonus totali',

      'cockpit.wrong.eyebrow': 'Errori recenti',
      'cockpit.wrong.badge': 'Ultimi 10',
      'cockpit.wrong.title': 'Errori recenti',
      'cockpit.wrong.empty': 'Nessun errore recente — continua così! ✨',
      'cockpit.wrong.viewAll': 'Vedi tutti',

      'cockpit.wrong.total': 'Totale: {{count}}',
      'cockpit.wrong.reviewAria': 'Apri revisione errore: {{title}}',

      'wrongLog.tip': 'Tip: se la lista è lunghissima, usa la ricerca. Gli errori più vecchi oltre il limite (300 eventi) vengono scartati automaticamente.',
      'wrongLog.searchNoResults': 'Nessun risultato per questa ricerca.',

      'cockpit.history.eyebrow': 'Storico giorni',
      'cockpit.history.badge': '14 giorni',
      'cockpit.history.title': 'Storico giorni',
      'cockpit.history.empty': 'Nessuna cronologia disponibile ancora.',

      'cockpit.profile.eyebrow': 'Profilo',
      'cockpit.profile.badge': 'Tu',
      'cockpit.profile.title': 'Profilo',
      'cockpit.profile.nickname': 'Nickname',
      'cockpit.profile.gelato': 'Gusto preferito',
      'cockpit.profile.changeGelato': 'Cambia gusto',
      'cockpit.profile.switchProfile': 'Cambia profilo',

      'assistant.aria': 'Assistente BERNY',
      'assistant.eyebrow': 'Assistente',
      'assistant.title': 'Parla con BERNY',
      'assistant.sub': 'Chiedi procedure, ricette e dove trovare una scheda. Ti porto al punto giusto.',
      'assistant.placeholder': 'Es. Coni: quanti gusti e quanti grammi?',
      'assistant.ariaInput': 'Parla con BERNY',
      'assistant.send': 'Chiedi',

      'mood.1': 'Coraggio: ogni servizio è un racconto.',
      'mood.2': 'Brilla: i dettagli fanno la differenza.',
      'mood.3': 'Energia gentile: sorridi e guida l’esperienza.',
      'mood.4': 'Precisione oggi, eccellenza domani.',
      'mood.5': 'Servi bellezza: cura, ritmo, calore umano.',
      'mood.6': 'Ogni caffè è una promessa mantenuta.',

      'tokens.stars': 'Stelline',
      'tokens.stars.detailsAria': 'Dettagli stelline',
      'tokens.progress': 'Progressi',
      'tokens.stars.text': 'Apri i tab dentro una scheda: ogni tab svela 1 cristallo di zucchero. Ogni {{perStar}} cristalli (per singola scheda info) si fondono in 1 stellina.',
      'tokens.stars.crystalsHint': 'Cristalli: progressi per scheda (0/{{perStar}}). Se i tab sono meno di {{perStar}}, completiamo la differenza all\'apertura della scheda info.',
      'tokens.stars.miniHint': '3 stelline = mini quiz (1 domanda). Se giusto sblocchi “Test me”.',
      'tokens.rulesFull': 'Regole complete',
      'tokens.testMe': 'Test me',
      'tokens.gelati': 'GELATO',
      'tokens.gelati.detailsAria': 'Dettagli GELATO',
      'tokens.gelati.text': 'Tre quiz perfetti = un GELATO reale da riscattare con il trainer. Il timer ti impedisce gli sprint consecutivi.',
      'tokens.cooldown': 'Cooldown',
      'tokens.seeRules': 'Vedi regolamento',
      'tokens.bonus': 'Bonus',
      'tokens.bonus.detailsAria': 'Dettagli punti bonus',
      'tokens.bonus.text': '65 stelline azzerano il loop e assegnano +{{points}} punti bonus convertibili in cash o prodotti Badiani.',
      'tokens.howUnlock': 'Come si sblocca',

      'game.mini.title': 'Come funziona il mini game',
      'game.mini.text1': 'Apri i tab dentro una scheda: ogni tab = 1 cristallo di zucchero. {{perStar}} cristalli si trasformano in 1 stellina (se i tab sono meno di {{perStar}}, completiamo i cristalli all\'ultimo tab). Ogni 3 stelline parte un mini quiz (1 domanda).',
      'game.mini.text2': 'Mini quiz giusto = sblocchi “Test me” (quiz più difficile). “Test me” perfetto = gelato aggiunto al counter e countdown di 24h (riducibile con 12 e 30 stelline). Mini quiz sbagliato = -3 stelline. Reset automatico: domenica a mezzanotte.',
      'game.mini.text3': 'Completando tutte e 65 le stelline guadagni punti bonus reali da convertire in cash o prodotti Badiani.',
      'game.mini.ok': 'Ok, giochiamo',

      'game.milestone.title.ready': 'Tre stelline: mini quiz sbloccato!',
      'game.milestone.title.waiting': 'Tre stelline: mini quiz (poi aspetti il cooldown)',
      'game.milestone.text.ready': 'Fai il mini quiz su ciò che hai aperto: se rispondi giusto, sblocchi “Test me” (il quiz più difficile che assegna il gelato).',
      'game.milestone.text.waiting': 'Puoi fare adesso il mini quiz. Se lo passi, sblocchi “Test me”, ma potrai farlo solo quando finisce il countdown del gelato.',
      'game.milestone.hint': 'Chiudi questa notifica per avviare il mini quiz.',
      'game.milestone.start': 'Inizia mini quiz',
      'game.milestone.later': 'Più tardi',

      'game.bonus.title': '65 stelline completate!',
      'game.bonus.ok': 'Riparto da capo',

      'challenge.eyebrow': 'Sfida continua',
      'challenge.hint': 'Rispondi subito: errore = -3 stelline.',
      'challenge.toast.lost': 'Sfida persa: -3 stelline. Rivedi subito la specifica.',
      'challenge.result.winTitle': 'Sfida superata',
      'challenge.result.loseTitle': 'Sfida persa: -3 stelline',
      'challenge.result.winText': 'Ottimo! Conosci il playbook Badiani: continua a collezionare stelline senza perdere ritmo.',
      'challenge.result.loseText': 'Niente panico: raccogli nuove schede e rientra subito nel giro delle stelline.',
      'challenge.result.winBtn': 'Continua',
      'challenge.result.loseBtn': 'Ci riprovo',

      'profile.gate.signup': 'Iscrizione',
      'profile.gate.login': 'Accedi',
      'profile.gate.signupLead': 'Crea un nuovo profilo con il tuo nickname e gusto di gelato preferito.',
      'profile.gate.loginLead': 'Accedi con il tuo nickname e gusto di gelato.',
      'profile.gate.nickname': 'Nickname',
      'profile.gate.nicknamePh': 'Es. StellaRosa',
      'profile.gate.gelatoLabel': 'Gusto gelato preferito',
      'profile.gate.gelatoPh': 'Es. Buontalenti',
      'profile.gate.signupBtn': 'Iscriviti',
      'profile.gate.loginBtn': 'Accedi',
      'profile.gate.deviceNote': 'I dati sono salvati solo su questo dispositivo.',

      'profile.err.fillBothMin2': 'Compila entrambi i campi (minimo 2 caratteri).',
      'profile.err.nicknameTaken': 'Questo nickname è già in uso. Scegline un altro.',
      'profile.err.fillBoth': 'Compila entrambi i campi.',
      'profile.err.notFound': 'Profilo non trovato. Controlla nickname e gusto.',
      'profile.ok.signup': 'Registrazione riuscita! Benvenuto/a {{name}}. Ricarico la pagina...',
      'profile.ok.login': 'Login riuscito! Bentornato/a {{name}}. Ricarico la pagina...',

      'profile.switch.title': 'Cambia profilo',
      'profile.switch.text': 'Vuoi passare a un altro profilo? I progressi del profilo attuale rimarranno salvati.',
      'profile.switch.confirm': 'Sì, cambia profilo',
      'profile.switch.button': 'Cambia profilo',
    },

    en: {
      'lang.label': 'Language',
      'lang.it': 'Italiano',
      'lang.en': 'English',
      'lang.es': 'Español',
      'lang.fr': 'Français',

      'common.close': 'Close',
      'toast.copied': 'Copied to clipboard ✅',

      'quiz.generic': 'Quiz',
      'carousel.headerAria': 'Scroll the carousel: swipe left/right or click (left=previous, right=next)',

      'card.procedure': 'Procedure',
      'card.checklist': 'Checklist',
      'card.rules': 'Rules',
      'card.table': 'Table',
      'card.routine': 'Routine',
      'card.deepCleanSteps': 'Deep clean steps',
      'card.stepsTips': 'Steps & tips',
      'card.details': 'Details',
      'card.use': 'Use',
      'card.notes': 'Notes',

      'gelatoLab.hero.badge': 'Gelato line',
      'gelatoLab.hero.stars': '⭐ Stars: 8/8',
      'gelatoLab.hero.desc': 'Manual for the gelato display: portions, take-me-home service, showpiece cups, and cabinet maintenance at -14/-15 °C.',
      'gelatoLab.carousel.products.category': 'Gelato line',
      'gelatoLab.ops.title': 'Setup & Storage',
      'gelatoLab.ops.category': 'Opening · Setup · Storage · Scampoli · Closing',

      'gelatoLab.cards.cups.desc': 'Cups in three sizes: Small (1 flavour, 100 g), Medium (1-2 flavours, 140 g), Large (1-3 flavours, 180 g). The key is portioning correctly and compacting well to remove air bubbles and keep the presentation uniform.',
      'gelatoLab.cards.cups.stats': `<li>Weighing: Small 100-120g, Medium 160-200g, Large 200-240g (always check)</li><li>Scoop technique: linear + ball for a pro look</li><li>Compacting: press GELATO against the side of the cup to remove air</li><li>Warm the spatula: warm it on the GELATO to make scooping easier</li><li>Finish: always offer wafer and whipped cream (upsell)</li><li>Ideal GELATO temp: -14/-15°C (if warmer it\'s harder to portion)</li>`,
      'gelatoLab.cards.cups.details': `<div class="steps"><span>1 · Warm the spatula on the flavour to soften it.</span><span>2 · Press GELATO against the side of the cup to remove air.</span><span>3 · Offer wafer/cream and smile.</span></div><div class="tips">Kids can choose two flavours even on the small.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1:</strong> "Want to go medium? Add another flavour and whipped cream"</span><span><strong>Option 2:</strong> "Shall I add whipped cream and a crunchy wafer?"</span><span><strong>Option 3:</strong> "With pistachio sauce it\'s even more irresistible"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Always weigh cups to stay within the gram range. Use the “linear scoop + ball” technique for a pro look. Ideal GELATO temp: -14/-15°C.</div>`,

      'gelatoLab.cards.cones.desc': 'Cones in three options: Classic (1 flavour), Chocolate or Gluten Free (1-2 flavours). Every cone should be wrapped with tissue for grip and presentation. Keep the cone area clean to avoid flavour cross-contact.',
      'gelatoLab.cards.cones.stats': `<li>Wrap: tissue always, for grip and look</li><li>Portion: 1 ball for classic cone, 1-2 balls for special cones (choco/GF)</li><li>Placement: set the ball while rotating the cone for stability</li><li>Area clean: every 30 minutes remove crumbs (they absorb moisture)</li><li>Stock rotation: strict FIFO (cones absorb moisture—use older stock first)</li><li>Upgrade upsell: chocolate cone (coated inside/out), whipped cream</li>`,
      'gelatoLab.cards.cones.details': `<div class="steps"><span>1 · Wrap the cone with tissue.</span><span>2 · Prepare the ball and place it while rotating.</span><span>3 · Offer an upgrade to the choco cone or whipped cream.</span></div><div class="tips">Keep the cone area clean by removing crumbs.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1:</strong> "Upgrade to the chocolate cone? It\'s coated inside and out"</span><span><strong>Option 2:</strong> "Gluten-free cone available (if in stock)"</span><span><strong>Option 3:</strong> "Add whipped cream on top for an Instagram look?"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Clean the cone area every 30 minutes. Stock rotation: cones absorb moisture, keep FIFO strict. Always wrap with tissue for grip.</div>`,

      'gelatoLab.cards.boxes.desc': 'Take-away GELATO in insulated boxes of 500/750/1000 ml. Each box keeps GELATO in good condition for about 1 hour when placed in the thermal bag. Always tell the customer to put it straight into the freezer at home: GELATO changes texture when it melts.',
      'gelatoLab.cards.boxes.stats': `<li>Small: 500 ml (1-3 flavours)</li><li>Medium: 750 ml (1-4 flavours)</li><li>Large: 1000 ml (1-5 flavours)</li><li>Filling order: start with softer flavours (sorbet first) to avoid flavour cross-contact</li><li>Compacting: remove air bubbles; clean edges with the spatula before sealing</li><li>Seal: film + Badiani tape; hand over in thermal bag</li><li>Autonomy: ~1 hour in thermal bag; always remind customers about the freezer at home</li>`,
      'gelatoLab.cards.boxes.details': `<div class="steps"><span>1 · Add flavours starting from the softest (sorbet first to avoid cross-contact).</span><span>2 · Compact to remove air bubbles and clean the edges.</span><span>3 · Seal with film + Badiani tape and place in the bag.</span></div><div class="tips">Upsell a bigger box + a 10-pack of waffles or cones.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1:</strong> "The 1L box lets you try more flavours"</span><span><strong>Option 2:</strong> "Shall we add a pack of cones to serve at home?"</span><span><strong>Option 3:</strong> "With a thermal bag, you can keep everything perfect for up to 2 hours"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Compact well to remove air and reduce ice crystals. Clean edges before sealing. Autonomy: ~1h in the thermal bag—always remind customers to freeze it ASAP.</div>`,

      'gelatoLab.cards.coppa.desc': 'Three scoops of GELATO in a glass cup, finished with whipped cream, a sauce of choice, a mini cone and a Badiani wafer. It\'s the “wow” option: build it in order and serve immediately to keep texture and toppings clean.',
      'gelatoLab.cards.coppa.stats': `<li>Base: glass cup</li><li>Portion: 3 scoops with a round scooper (can be 3 different flavours)</li><li>Top: whipped cream + a swirl of the chosen sauce</li><li>Finish: mini cone + Badiani wafer</li><li>Service: steel spoon, serve immediately</li>`,
      'gelatoLab.cards.coppa.details': `<div class="steps"><span>1 · Take a glass cup and scoop 3 regular balls (can be different flavours) with the round scooper.</span><span>2 · Finish with whipped cream and a swirl of the chosen sauce (keep the rim clean).</span><span>3 · Add the mini cone + Badiani wafer and serve with a steel spoon.</span></div><div class="tips">Suggest a pairing with Slitti dragée for a complete dessert.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1:</strong> "Add toasted hazelnut crumble and Slitti dragée?"</span><span><strong>Option 2:</strong> "Double sauce (pistachio + chocolate) makes it signature"</span><span><strong>Option 3:</strong> "Perfect pairing: Coppa + espresso affogato style"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Use chilled glass cups to help keep temperature. Make uniform scoops with the round scooper. Serve immediately after topping to avoid whipped-cream melt.</div>`,

      'gelatoLab.ops.displayPrep.title': 'Display prep (morning)',
      'gelatoLab.ops.displayPrep.desc': 'Clean, polish and prep the cabinet before displaying. Display only when the machine reaches -14/-15 °C.',
      'gelatoLab.ops.displayPrep.stats': `<li>Cleaning: damp cloth with hot water + yellow sanitiser on GELATO marks</li><li>Metals: blue spray + blue roll to make surfaces shine</li><li>Setup: insert tray bars, power on, place pans and sliding doors</li><li>Display: at -14/-15 °C, load flavours and close the sliding doors</li>`,
      'gelatoLab.ops.displayPrep.details': `<div class="steps"><span>1 · Clean and polish (especially metals and sliding doors).</span><span>2 · Power on and place bars + pans.</span><span>3 · At -14/-15°C: display GELATO and close the sliding doors.</span></div><div class="tips">Check the scampoli freezer first: if a flavour is recoverable, use it correctly.</div>`,

      'gelatoLab.ops.tempDoors.title': 'Temperature & doors (standard)',
      'gelatoLab.ops.tempDoors.desc': 'Key standard: cabinet at -14/-15 °C. If the store isn\'t busy, the sliding doors must be in place to preserve temperature.',
      'gelatoLab.ops.tempDoors.stats': `<li>Target: -14/-15 °C (log on HACCP sheet if required in your store)</li><li>Doors: in position when there\'s no active service</li><li>Tools: spatulas used for cleaning must be washed and dried before moving to other flavours</li>`,
      'gelatoLab.ops.tempDoors.details': `<div class="steps"><span>1 · Check the temperature and record per local standard.</span><span>2 · Keep the sliding doors closed between services.</span><span>3 · Wash/dry tools after every cleaning use to avoid cross-contact.</span></div>`,

      'gelatoLab.ops.treatsShelfLife.title': 'Treats shelf life (after display)',
      'gelatoLab.ops.treatsShelfLife.desc': 'Quick table: max days after being displayed in the treats cabinet.',
      'gelatoLab.ops.treatsShelfLife.stats': `<li>Cakes / Pinguinos / Mini semifreddo: 35 days</li><li>Mini cakes / Mini cones: 21 days</li><li>Cookies: 14 days</li>`,
      'gelatoLab.ops.treatsShelfLife.details': `<div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">Shelf life once displayed</strong><span>Cakes / Pinguinos / Mini semifreddo: 35 days</span><span>Mini cakes / Mini cones: 21 days</span><span>Cookies: 14 days</span></div>`,

      'gelatoLab.ops.treatFreezer.title': 'Treat freezer management',
      'gelatoLab.ops.treatFreezer.desc': 'Vertical cabinet at -14 °C, weekly defrost, display items using gloves.',
      'gelatoLab.ops.treatFreezer.stats': `<li>Place cakes on the top shelf, cookies/pinguinos on the lower shelf (kids\' eye level)</li><li>Shelf life after display: cakes/pinguinos 35 days, mini semifreddi 35, mini cakes 21, mini cones 21, cookies 14</li>`,
      'gelatoLab.ops.treatFreezer.details': `<div class="steps"><span>1 · Maximise space, keep FIFO.</span><span>2 · Remind customers these are GELATO products.</span><span>3 · Use the insulated box (1h autonomy) for take-away.</span></div><div class="tips">Weekly ice removal keeps visibility spotless.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Technique 1:</strong> "Keep treats at kids\' eye level for impulse sales"</span><span><strong>Technique 2:</strong> "Mixed box of pinguinos/cookies for parties (per local price list)"</span><span><strong>Technique 3:</strong> "Mini semifreddi are perfect last-minute desserts at home"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Keep the freezer consistently at -14°C. Remove ice weekly with a plastic spatula to avoid scratches. Always use gloves for hygienic handling.</div>`,

      'gelatoLab.ops.scampolo.title': 'Scampolo rule (1/4 pan)',
      'gelatoLab.ops.scampolo.desc': 'When a flavour has less than 1/4 of a pan, it\'s a scampolo and must be replaced. You can integrate it little by little into the new pan, without exceeding 5–7 cm.',
      'gelatoLab.ops.scampolo.stats': `<li>Definition: &lt; 1/4 pan = scampolo</li><li>Addition: about 100 g at a time (about one scoop side)</li><li>Limit: max 5–7 cm of scampolo total</li>`,
      'gelatoLab.ops.scampolo.details': `<div class="steps"><span>1 · Take the scampolo from the scampoli freezer.</span><span>2 · Add small amounts and level (it must not “look added”).</span><span>3 · Don\'t exceed 5–7 cm of total scampolo.</span></div><div class="tips">Scampolo = waste control, but always keep the visual standard.</div>`,

      'gelatoLab.ops.closeDeepClean.title': 'Closing & deep clean (cabinet)',
      'gelatoLab.ops.closeDeepClean.desc': 'Routine: cabinet OFF every night. Full deep clean once a week, including filter cleaning.',
      'gelatoLab.ops.closeDeepClean.stats': `<li>Every night: switch off + daily clean</li><li>Weekly: full deep clean + filter cleaning</li><li>Focus: remove nuts/crumbs and sanitise all surfaces</li>`,
      'gelatoLab.ops.closeDeepClean.details': `<div class="steps"><span>1 · Remove bottom panels and clean GELATO marks.</span><span>2 · Remove nuts/crumbs; sanitising spray + cloth on all surfaces.</span><span>3 · Blue spray + blue roll to polish; deep clean label stands; reassemble and power on.</span></div><div class="tips">Sliding doors: if the store isn\'t busy, keep them in position to preserve temperature.</div>`,

      'gelatoLab.footer.tagline': 'The art of Florentine GELATO',
      'gelatoLab.footer.tempLabel': 'Ideal temp.',
      'gelatoLab.footer.heritageLabel': 'Heritage',

      'caffe.hero.badge': 'Bar & Drinks · 2025',
      'caffe.hero.stars': '⭐ Stars: 18/18',
      'caffe.hero.desc': 'The complete Badiani beverage guide: from classic Italian coffee drinks to the new Matcha Bar, plus Smoothies and cold drinks. Includes table service and Take Away (TW) procedures.',

      'sweetTreats.hero.badge': 'Dessert line · 2025',
      'sweetTreats.hero.stars': '⭐ Stars: 13/13',
      'sweetTreats.hero.desc': 'Digital lab for crepes, waffles, GELATO burgers and tea sets. Includes weights, shelf life, build order and service styling to wow guests in boutique.',

      'sweetTreats.carousel.main.title': 'Sweet Crepes & Waffles',
      'sweetTreats.carousel.main.category': 'Sweet temptations',

      'sweetTreats.cards.crepeSauce.desc': 'Classic crepe served with one of our signature sauces (Pistachio, Hazelnut, Chocolate). The perfect base for any add-on.',
      'sweetTreats.cards.crepeSauce.stats': `<li><strong>Mix shelf life:</strong> 3 days (fridge)</li><li><strong>Rest:</strong> at least 2 hours (fridge)</li><li><strong>Cooking:</strong> 20s per side</li>`,
      'sweetTreats.cards.crepeSauce.details': `<div class="steps"><span>1 · Spread the mix; flip when golden.</span><span>2 · Spread sauce on half, fold into a half-moon then into a fan.</span><span>3 · Plate, dust with icing sugar and drizzle sauce on top.</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> The plate must be hot but not smoking. The first crepe is often a test run.</div>`,

      'sweetTreats.cards.buontalentiCrepe.desc': 'Our best seller: crepe with a sauce of choice and one scoop of Buontalenti on top.',
      'sweetTreats.cards.buontalentiCrepe.stats': `<li><strong>GELATO:</strong> 1 scoop Buontalenti (70g)</li><li><strong>Sauce:</strong> 30g inside + decoration</li><li><strong>Service:</strong> Dessert plate with cutlery</li>`,
      'sweetTreats.cards.buontalentiCrepe.details': `<div class="steps"><span>1 · Make the sauce crepe as per standard.</span><span>2 · Fold into a fan and dust with icing sugar.</span><span>3 · Place the Buontalenti scoop on top and finish with sauce.</span></div><div class="tips">Add the GELATO at the very last second so it doesn't melt on the warm crepe.</div>`,

      'sweetTreats.cards.waffles.desc': 'Golden and crunchy outside, soft inside. Served with sauces, fruit or GELATO.',
      'sweetTreats.cards.waffles.stats': `<li><strong>Cook:</strong> 2.5 min per side (5 min total)</li><li><strong>Rest:</strong> 45s for crunch</li><li><strong>Batter:</strong> 1 scoop (177ml)</li>`,
      'sweetTreats.cards.waffles.details': `<div class="steps"><span>1 · Pour the mix into the hot plate and close.</span><span>2 · Cook 2.5 min, flip and cook another 2.5 min.</span><span>3 · Rest on a rack for 45s before decorating.</span></div><div class="tips">Resting is key: if served immediately it turns soft.</div>`,

      'sweetTreats.cards.pancake.desc': 'A stack of 3 fluffy pancakes. Served with maple syrup, fresh fruit or Badiani sauces.',
      'sweetTreats.cards.pancake.stats': `<li><strong>Portion:</strong> 3 pieces</li><li><strong>Cooking:</strong> until bubbles appear</li><li><strong>Topping:</strong> generous</li>`,
      'sweetTreats.cards.pancake.details': `<div class="steps"><span>1 · Pour 3 rounds of batter onto the plate.</span><span>2 · Flip when bubbles appear on the surface.</span><span>3 · Stack and decorate generously.</span></div>`,

      'sweetTreats.cards.italianaPlain.desc': 'Mozzarella, rocket and cherry tomatoes on a classic base. Fresh and light.',
      'sweetTreats.cards.italianaPlain.stats': `<li><strong>Base:</strong> Classic</li><li><strong>Filling:</strong> Mozzarella, rocket, cherry tomatoes</li><li><strong>Finish:</strong> EVO oil, salt, oregano</li>`,
      'sweetTreats.cards.italianaPlain.details': `<div class="steps"><span>1 · Cook the crepe and flip.</span><span>2 · Add mozzarella and let it melt slightly.</span><span>3 · Add dressed rocket and cherry tomatoes; fold into a parcel.</span></div>`,

      'sweetTreats.cards.italianaBeetroot.desc': 'The colourful version: beetroot batter for a unique look and a sweet-earthy note.',
      'sweetTreats.cards.italianaBeetroot.stats': `<li><strong>Base:</strong> Beetroot</li><li><strong>Filling:</strong> Mozzarella, rocket, cherry tomatoes</li><li><strong>Visual:</strong> deep red/purple colour</li>`,
      'sweetTreats.cards.italianaBeetroot.details': `<div class="steps"><span>1 · Use the beetroot mix (3g powder per 250g mix).</span><span>2 · Build it like the classic Italiana.</span><span>3 · Colour contrast is the hero: let the filling show.</span></div>`,

      'sweetTreats.cards.prosciuttoPlain.desc': 'Classic with Prosciutto Crudo, mozzarella and rocket.',
      'sweetTreats.cards.prosciuttoPlain.stats': `<li><strong>Base:</strong> Classic</li><li><strong>Filling:</strong> Crudo, mozzarella, rocket</li><li><strong>Service:</strong> warm and melty</li>`,
      'sweetTreats.cards.prosciuttoPlain.details': `<div class="steps"><span>1 · Melt the mozzarella while the crepe is cooking.</span><span>2 · Add prosciutto at the end to avoid overcooking it.</span><span>3 · Finish with rocket and fold.</span></div>`,

      'sweetTreats.cards.prosciuttoBeetroot.desc': 'Prosciutto Crudo on a beetroot base. A modern twist on a classic.',
      'sweetTreats.cards.prosciuttoBeetroot.stats': `<li><strong>Base:</strong> Beetroot</li><li><strong>Filling:</strong> Crudo, mozzarella, rocket</li><li><strong>Taste:</strong> savoury + sweet (batter)</li>`,
      'sweetTreats.cards.prosciuttoBeetroot.details': `<div class="steps"><span>1 · Prepare the beetroot base.</span><span>2 · Fill generously.</span><span>3 · Serve cut in half to show the layers.</span></div>`,

      'sweetTreats.cards.gelatoBurger.desc': 'One scoop of GELATO in a soft brioche bun, sealed warm in seconds: “wow” effect and fast service.',
      'sweetTreats.cards.gelatoBurger.stats': `<li><strong>Bread:</strong> brioche bun, lightly warmed</li><li><strong>GELATO:</strong> 1 scoop (~70 g), flavour of choice</li><li><strong>Sauce:</strong> 1 choice only (standard)</li>`,
      'sweetTreats.cards.gelatoBurger.details': `<div class="steps"><span>1 · Warm the brioche lightly (don't over-toast).</span><span>2 · Add one scoop of GELATO (~70 g) and finish with one sauce choice.</span><span>3 · Close, serve immediately, and suggest eating it like a sandwich.</span></div>`,

      'sweetTreats.ops.title': 'Setup & Storage',
      'sweetTreats.ops.category': 'Opening · Settings · Tech data · Storage · Closing',

      'sweetTreats.ops.opening.title': 'Opening station checklist',
      'sweetTreats.ops.opening.desc': 'Before service, check machines are ready and mixes/ingredients are in order. The Gelato Burger Machine must be switched on at opening and off at closing.',
      'sweetTreats.ops.opening.stats': `<li>Waffle machine: power on and wait for both green lights (READY + POWER)</li><li>Gelato Burger Machine: ON at opening; typically ready ~10 min after switching on</li><li>Crepe mix: must rest in the fridge at least 2 hours before use</li>`,
      'sweetTreats.ops.opening.details': `<div class="steps"><span>1 · Switch on machines and confirm they're up to temp/ready.</span><span>2 · Check mixes and stock (labels, FIFO, dates).</span><span>3 · Prep blue roll and sauce bottles for a clean, fast station.</span></div><div class="tips">Goal: zero waits on the first order and stations already “service ready”.</div>`,

      'sweetTreats.ops.settings.title': 'Machine settings (standard)',
      'sweetTreats.ops.settings.desc': 'Set the basics before the rush: fewer mistakes, less waste, and more consistent products.',
      'sweetTreats.ops.settings.stats': `<li>Waffle: lightly oil with vegetable oil; power level 3; cook 2.5 min per side (5 min total)</li><li>Waffle: rest 45s before topping/GELATO (crunch)</li><li>Gelato Burger: 12-second timer; no need to oil the plates</li>`,
      'sweetTreats.ops.settings.details': `<div class="steps"><span>1 · Waffle: set power to 3 and don't start until READY + POWER are on.</span><span>2 · Gelato Burger: set 12s timer and use only blue-roll for any drips/sauce.</span><span>3 · Keep surfaces clean: crumbs = visual quality drops fast.</span></div><div class="tips">No oil on the Gelato Burger machine: plates must not be greased.</div>`,

      'sweetTreats.ops.storage.title': 'Shelf life & quick storage',
      'sweetTreats.ops.storage.desc': 'This module is “more storage than show”: keep dates and conditions under control.',
      'sweetTreats.ops.storage.stats': `<li>Crepe mix: shelf life 3 days (fridge) + minimum rest 2 hours (fridge)</li><li>Waffle mix (pre-packed): shelf life 2 days</li><li>Gelato Burger: bun shelf life once defrosted = 2 days</li><li>Gelato Croissant: plain croissant shelf life = 2 days</li>`,
      'sweetTreats.ops.storage.details': `<div class="steps"><span>1 · Label with prep/open date and expiry.</span><span>2 · Strict FIFO: use what expires first.</span><span>3 · Out of spec/no label: do not serve.</span></div><div class="tips">Storage is training: consistency = guests who come back.</div>`,

      'sweetTreats.ops.portions.title': 'Portioning & doses (quick ref)',
      'sweetTreats.ops.portions.desc': 'A counter-side reference: key doses for speed and standards.',
      'sweetTreats.ops.portions.stats': `<li>Waffle: 1 full batter scoop = 177 ml</li><li>Crepe: 1 scoop or 1.5 small ladle scoops of mix</li><li>Signature Buontalenti Crepe: Buontalenti 70 g + sauce on top ~30 g</li><li>Gelato Burger: 1 scoop of GELATO = 70 g (one only) + one sauce choice</li>`,
      'sweetTreats.ops.portions.details': `<div class="steps"><span>1 · Use dedicated scoops: reduce variation between team members.</span><span>2 · If a product is off-standard, correct immediately (don't “compensate” with extras).</span><span>3 · Track recurring mistakes: they're training points.</span></div>`,

      'sweetTreats.ops.closing.title': 'Closing & quick clean',
      'sweetTreats.ops.closing.desc': 'At the end of the day, reduce residue and risk: on the Gelato Burger Machine use only blue-roll for any GELATO/sauce drips and to remove crumbs.',
      'sweetTreats.ops.closing.stats': `<li>Gelato Burger Machine: OFF at close; surface free of residue/particles</li><li>Waffle: remove residue and set the station up for tomorrow</li><li>Mixes: store in the fridge with a label (or discard if beyond shelf life)</li>`,
      'sweetTreats.ops.closing.details': `<div class="steps"><span>1 · Switch machines off and allow to cool safely.</span><span>2 · Clean with blue-roll: no oil on Gelato Burger plates.</span><span>3 · Fridge + labels for mixes/ingredients; discard anything beyond shelf life.</span></div><div class="tips">Clean and dry today = a faster opening tomorrow.</div>`,

      'sweetTreats.footer.tagline': 'Crepes, Waffles & More',
      'sweetTreats.footer.stat1.value': '10+ Variations',
      'sweetTreats.footer.stat1.label': 'Menu',
      'sweetTreats.footer.stat2.value': 'Sweet & Savory',
      'sweetTreats.footer.stat2.label': 'Flavours',

      'pastries.hero.badge': 'Counter pastry',
      'pastries.hero.stars': '⭐ Stars: 6/6',
      'pastries.hero.desc': 'All counter-served references: cakes, brownies, loaf, filled croissants and scones with a scoop of Buontalenti. Each card includes shelf life, portions and upselling scripts.',
      'pastries.hero.coverAlt': 'Badiani cakes and brownies',

      'pastries.carousel.main.title': 'Pastry Lab',
      'pastries.carousel.main.category': 'Counter pastry',

      'pastries.cards.cakes.alt': 'Slice of Badiani cake',
      'pastries.cards.cakes.desc': 'Chocolate (3g), Carrot (2g), Walnut (3g), always cut 14 slices per cake.',
      'pastries.cards.cakes.stats': `<li>Use the cake slicer as a guide</li><li>Serve on a plate with cutlery</li><li>Upsell a Buontalenti scoop + sauce</li>`,
      'pastries.cards.cakes.details': `<div class="steps"><span>1 → Place the cutter and score 14 portions.</span><span>2 → Serve the slice on a plate and suggest a pairing with GELATO.</span><span>3 → If the upsell lands, add one scoop with the milkshake scooper and drizzle sauce on the slice.</span></div><div class="tips">Team reminder: hot chocolate + cake is a premium combo.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💫 Upselling</strong><span><strong>Option 1:</strong> "Would you like to enrich your slice with a scoop of Buontalenti?"</span><span><strong>Option 2:</strong> "Shall we add a pistachio or caramel sauce drizzle?"</span><span><strong>Option 3:</strong> "Perfect combo? Cake + hot chocolate"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> Keep cakes covered with film between cuts to avoid drying out. Room temp: max 2 hours out of the fridge.</div>`,

      'pastries.cards.brownie.alt': 'Badiani brownie',
      'pastries.cards.brownie.desc': 'Cut 4×3 (12 pieces) and serve on a plate with cutlery.',
      'pastries.cards.brownie.stats': `<li>Display on the dedicated tray</li><li>Upsell GELATO + sauce</li><li>Communicate shelf life</li>`,
      'pastries.cards.brownie.details': `<div class="steps"><span>1 - Cut 12 equal pieces and display on the tray.</span><span>2 - On order, plate and offer a Buontalenti scoop.</span><span>3 - Drizzle sauce on the brownie and on the GELATO.</span></div><div class="tips">Use the round scooper to keep the portion consistent.</div>`,

      'pastries.cards.loaf.alt': 'Banana loaf',
      'pastries.cards.loaf.desc': 'Each loaf must yield 10 slices. Service and upsell are the same as cakes.',
      'pastries.cards.loaf.stats': `<li>Cut consistent thickness</li><li>Serve with cutlery</li><li>Offer the guest\'s favourite sauce</li>`,
      'pastries.cards.loaf.details': `<div class="steps"><span>1 - Cut 10 equal slices and display the first one.</span><span>2 - Add a scoop + sauce if the guest agrees.</span><span>3 - Keep the loaf wrapped when not in use.</span></div><div class="tips">Keep shelf life visible on the label to make daily checks easy.</div>`,

      'pastries.cards.croissants.alt': 'Filled croissant',
      'pastries.cards.croissants.desc': 'Pre-laminated croissant, filled with the sauce requested by the guest. Open from the side, fill, and finish the presentation on a plate with fork and knife. Remember to lightly warm yesterday\'s croissants to revive the fragrance.',
      'pastries.cards.croissants.stats': `<li>Shelf life: 2 days from defrost (check date)</li><li>Cut: use a serrated knife; open the side horizontally</li><li>Filling: piping bag for consistency and precision</li><li>Presentation: sauce inside + drizzle on top, clean plate, cutlery always</li><li>Warming (if needed): 8–10 seconds only; never over 15s (filling melts)</li>`,
      'pastries.cards.croissants.details': `<div class="steps"><span>1 - Score the side with a serrated knife.</span><span>2 - Fill inside and top with the same sauce.</span><span>3 - Plate, add cutlery and serve.</span></div><div class="tips">Communicate shelf life and rotation: 2 days from defrost.</div>`,

      'pastries.cards.scone.alt': 'Scone filled with GELATO',
      'pastries.cards.scone.desc': 'Warm for 15s in the Gelato Burger machine, fill with a Buontalenti scoop and sauce.',
      'pastries.cards.scone.stats': `<li>Cut horizontally</li><li>Use the milkshake scooper</li><li>Finish with pistachio or chocolate</li>`,
      'pastries.cards.scone.details': `<div class="steps"><span>1 - Warm for 15s.</span><span>2 - Cut, add the scoop and close.</span><span>3 - Sauce on top; plate with cutlery.</span></div><div class="tips">Remind guests about the hot/cold contrast to boost the upsell.</div>`,

      'pastries.ops.title': 'Setup & Storage',
      'pastries.ops.category': 'Opening · Tech data · Shelf life · FIFO · Closing',

      'pastries.ops.display.alt': 'Badiani pastry display',
      'pastries.ops.display.desc': 'Opening goal: a full, tidy, easy-to-read display. Labels always next to the correct tray; cakes on cake stands with one slice removed to show the inside.',
      'pastries.ops.display.stats': `<li>CAKES: cake stands + remove 1 slice (inside visual)</li><li>CROISSANTS: dedicated trays (clean rows)</li><li>BROWNIES/PUDDING/TARTS/SCONES: on trays, aligned</li><li>LOAF: slice and show the first slice on the tray</li>`,
      'pastries.ops.display.details': `<div class="steps"><span>1 · Restore a “full look” (no visual gaps).</span><span>2 · Place labels next to the right tray (never generic).</span><span>3 · Check FIFO and shelf life before the first service.</span></div><div class="tips">Visual consistency = sales. A “full” counter invites purchase.</div>`,

      'pastries.ops.cuts.desc': 'Consistent portions = consistent quality. Always use the same cuts to control food cost and work “as a team”.',
      'pastries.ops.cuts.stats': `<li>Cake: use the cake slicer guide (14 slices)</li><li>Brownie tray: 4×3 cut = 12 pieces</li><li>Loaf: get 10 slices from the full loaf</li>`,
      'pastries.ops.cuts.details': `<div class="steps"><span>1 · Always use the same guiding tool (slicer / visual ruler).</span><span>2 · If a portion is off-standard, correct the next cut immediately.</span><span>3 · Keep blades clean: a clean cut = premium presentation.</span></div>`,

      'pastries.ops.shelf.desc': 'Shelf life list for daily checks, rotation and correct labels.',
      'pastries.ops.shelf.stats': `<li>Chocolate Cake: 3 days</li><li>Carrot Cake: 2 days</li><li>Walnut Cake: 3 days</li><li>Brownie: 4 days</li><li>Banana Loaf: 4 days</li><li>Croissants: 2 days</li><li>Scones: 2 days</li>`,
      'pastries.ops.shelf.details': `<div class="steps"><span>1 · Always label: defrost/open date + expiry.</span><span>2 · Strict FIFO (first in, first out).</span><span>3 · If in doubt: don\'t serve (ask the manager).</span></div>`,

      'pastries.ops.full.desc': 'Display rule: it must always look full and tidy. Labels must be next to the correct tray, always.',
      'pastries.ops.full.stats': `<li>Reposition products to close gaps (without mixing references)</li><li>Align fronts: brownie/loaf/croissant always “in formation”</li><li>Check labels are readable and match the tray</li>`,
      'pastries.ops.full.details': `<div class="steps"><span>1 · Refill and realign after every rush.</span><span>2 · Update labels whenever the tray changes (never leave “old” ones).</span><span>3 · Check expiry dates during refills.</span></div><div class="tips">Visual merchandising = training: it\'s a skill, not a detail.</div>`,

      'pastries.ops.close.desc': 'Goal: restore order and prep for a fast start tomorrow, without losing shelf life control.',
      'pastries.ops.close.stats': `<li>Remove crumbs and residue from trays (before they “stick”)</li><li>Group by reference and verify expiry dates (FIFO)</li><li>Check all labels are present and correct</li>`,
      'pastries.ops.close.details': `<div class="steps"><span>1 · Tidy by category, check dates, and discard anything beyond shelf life.</span><span>2 · Clean surfaces and trays; dry before closing.</span><span>3 · Leave the counter “opening-ready”: labels and layout already set.</span></div>`,

      'pastries.footer.tagline': 'Breakfast & Snack time',
      'pastries.footer.stat1.value': 'Daily',
      'pastries.footer.stat1.label': 'Frequency',
      'pastries.footer.stat2.value': 'Fresh',
      'pastries.footer.stat2.label': 'Quality',

      'nav.menu': 'Menu',
      'nav.homeAria': 'Back to Badiani home',
      'nav.profileAria': 'User profile',
      'nav.profileLabel': 'Profile',

      'menu.cluster.orbit': 'Orbit',
      'menu.cluster.beverage': 'Beverage & Treats',
      'menu.cluster.gelato': 'Gelato & Specials',

      'menu.link.hub': 'Hub',
      'menu.link.storyOrbit': 'Story Orbit',
      'menu.link.operations': 'Operations & Setup',
      'menu.link.caffe': 'Bar & Drinks',
      'menu.link.sweetTreats': 'Sweet Treat Atelier',
      'menu.link.pastries': 'Pastry Lab',
      'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
      'menu.link.gelatoLab': 'Gelato Lab',
      'menu.link.festive': 'Festive & Churros',

      'drawer.categories': 'Categories',
      'drawer.close': 'Close menu',

      'quizSolution.eyebrow': 'Quiz · Solution',
      'quizSolution.title': 'Review the correct answer',
      'quizSolution.loadingQuestion': 'Loading question...',
      'quizSolution.loadingAnswer': 'Loading correct answer...',
      'quizSolution.explainLabel': 'Explanation:',
      'quizSolution.tipLabel': 'Tip:',
      'quizSolution.backHub': '⬅ Back to hub',
      'quizSolution.openSpecs': '📖 Open specs',
      'quizSolution.back': '↩ Go back',
      'quizSolution.correctAnswerPrefix': 'Correct answer:',
      'quizSolution.openSuggestedCard': '📖 Open suggested card',
      'quizSolution.noQuestion': 'No question received.',
      'quizSolution.retry': 'Go back to the quiz and try again.',

      'hub.badge': 'Training Orbit',
      'hub.eyebrow': 'Operations hub · updated daily',
      'hub.title': 'Badiani 1932 operations playbook',
      'hub.lede': "Florentine heritage, boutique rituals, and digitised procedures in one cockpit: review, refresh, and finish quizzes to redeem real GELATO.",
      'hub.openCategories': 'Open categories',
      'hub.rules': 'Rules',
      'hub.pill.starsToday': '⭐ Stars today:',
      'hub.pill.gelatiWon': '🍨 GELATO redeemed:',
      'hub.pill.quizCorrect': '🎯 Correct quizzes:',

      'page.starsBadge': '⭐ Stars: {{count}}/{{total}}',

      'cockpit.eyebrow': 'Orbit cockpit',
      'cockpit.title': 'Live overview',
      'cockpit.sub': 'Swipe through the cards and stay sharp.',
      'cockpit.indicatorsAria': 'Overview indicators',

      'cockpit.daily.eyebrow': 'Training',
      'cockpit.daily.badge': 'Live',
      'cockpit.daily.title': 'Daily training',
      'cockpit.daily.loading': 'Loading today’s question...',
      'cockpit.daily.hint': 'Open a card, answer, and earn extra stars.',

      'cockpit.perf.eyebrow': 'Today',
      'cockpit.perf.badge': 'Updated',
      'cockpit.perf.title': 'Today’s performance',
      'cockpit.stat.stars': 'Stars',
      'cockpit.stat.bonusPoints': 'Bonus points',
      'cockpit.stat.gelatiWon': 'GELATO redeemed',
      'cockpit.stat.quizCorrect': 'Correct quizzes',
      'cockpit.stat.quizWrong': 'Wrong quizzes',

      'cockpit.totals.eyebrow': 'History',
      'cockpit.totals.badge': 'Total',
      'cockpit.totals.title': 'Totals',
      'cockpit.totals.stars': 'Total stars',
      'cockpit.totals.gelati': 'Total GELATO',
      'cockpit.totals.bonus': 'Total bonus',

      'cockpit.wrong.eyebrow': 'Recent mistakes',
      'cockpit.wrong.badge': 'Last 10',
      'cockpit.wrong.title': 'Recent mistakes',
      'cockpit.wrong.empty': 'No recent mistakes — keep it up! ✨',
      'cockpit.wrong.viewAll': 'View all',

      'cockpit.wrong.total': 'Total: {{count}}',
      'cockpit.wrong.reviewAria': 'Open error review: {{title}}',

      'wrongLog.tip': 'Tip: if the list is very long, use search. Older errors beyond the limit (300 events) are discarded automatically.',
      'wrongLog.searchNoResults': 'No results for this search.',

      'cockpit.history.eyebrow': 'Day history',
      'cockpit.history.badge': '14 days',
      'cockpit.history.title': 'Day history',
      'cockpit.history.empty': 'No history yet.',

      'cockpit.profile.eyebrow': 'Profile',
      'cockpit.profile.badge': 'You',
      'cockpit.profile.title': 'Profile',
      'cockpit.profile.nickname': 'Nickname',
      'cockpit.profile.gelato': 'Favourite gelato flavour',
      'cockpit.profile.changeGelato': 'Change flavour',
      'cockpit.profile.switchProfile': 'Switch profile',

      'assistant.aria': 'BERNY assistant',
      'assistant.eyebrow': 'Assistant',
      'assistant.title': 'Talk to BERNY',
      'assistant.sub': 'Ask for procedures, recipes, and where to find a card. I’ll take you straight there.',
      'assistant.placeholder': 'E.g. Cones: how many flavours and how many grams?',
      'assistant.ariaInput': 'Talk to BERNY',
      'assistant.send': 'Ask',

      'mood.1': 'Courage: every service tells a story.',
      'mood.2': 'Shine: details make the difference.',
      'mood.3': 'Gentle energy: smile and guide the experience.',
      'mood.4': 'Precision today, excellence tomorrow.',
      'mood.5': 'Serve beauty: care, rhythm, human warmth.',
      'mood.6': 'Every coffee is a promise kept.',

      'tokens.stars': 'Stars',
      'tokens.stars.detailsAria': 'Stars details',
      'tokens.progress': 'Progress',
      'tokens.stars.text': 'Open tabs inside a card: each tab reveals 1 sugar crystal. Every {{perStar}} crystals (per single info card) fuse into 1 star.',
      'tokens.stars.crystalsHint': 'Crystals: per-card progress (0/{{perStar}}). If tabs are fewer than {{perStar}}, we top up the difference when opening the info card.',
      'tokens.stars.miniHint': '3 stars = mini quiz (1 question). If correct you unlock “Test me”.',
      'tokens.rulesFull': 'Full rules',
      'tokens.testMe': 'Test me',
      'tokens.gelati': 'GELATO',
      'tokens.gelati.detailsAria': 'GELATO details',
      'tokens.gelati.text': 'Three perfect quizzes = a real GELATO to redeem with the trainer. The timer prevents back-to-back sprints.',
      'tokens.cooldown': 'Cooldown',
      'tokens.seeRules': 'See rules',
      'tokens.bonus': 'Bonus',
      'tokens.bonus.detailsAria': 'Bonus points details',
      'tokens.bonus.text': '65 stars reset the loop and grant +{{points}} bonus points, redeemable for cash or Badiani products.',
      'tokens.howUnlock': 'How it unlocks',

      'game.mini.title': 'How the mini game works',
      'game.mini.text1': 'Open tabs inside a card: each tab = 1 sugar crystal. {{perStar}} crystals become 1 star (if tabs are fewer than {{perStar}}, we top up crystals on the last tab). Every 3 stars triggers a mini quiz (1 question).',
      'game.mini.text2': 'Mini quiz correct = you unlock “Test me” (harder quiz). A perfect “Test me” = gelato added to the counter and a 24h countdown (reducible at 12 and 30 stars). Mini quiz wrong = -3 stars. Auto reset: Sunday at midnight.',
      'game.mini.text3': 'By completing all 65 stars you earn real bonus points that can be converted into cash or Badiani products.',
      'game.mini.ok': 'Ok, let’s play',

      'game.milestone.title.ready': 'Three stars: mini quiz unlocked!',
      'game.milestone.title.waiting': 'Three stars: mini quiz (then wait for cooldown)',
      'game.milestone.text.ready': 'Take the mini quiz on what you opened: if you answer correctly, you unlock “Test me” (the harder quiz that awards the gelato).',
      'game.milestone.text.waiting': 'You can take the mini quiz now. If you pass, you unlock “Test me”, but you can only play it once the gelato countdown ends.',
      'game.milestone.hint': 'Close this notice to start the mini quiz.',
      'game.milestone.start': 'Start mini quiz',
      'game.milestone.later': 'Later',

      'game.bonus.title': '65 stars completed!',
      'game.bonus.ok': 'Start over',

      'challenge.eyebrow': 'Ongoing challenge',
      'challenge.hint': 'Answer now: a mistake = -3 stars.',
      'challenge.toast.lost': 'Challenge lost: -3 stars. Review the spec right away.',
      'challenge.result.winTitle': 'Challenge passed',
      'challenge.result.loseTitle': 'Challenge lost: -3 stars',
      'challenge.result.winText': 'Great! You know the Badiani playbook: keep collecting stars without losing pace.',
      'challenge.result.loseText': 'No panic: open new cards and jump back into the star loop.',
      'challenge.result.winBtn': 'Continue',
      'challenge.result.loseBtn': 'Try again',

      'profile.gate.signup': 'Sign up',
      'profile.gate.login': 'Log in',
      'profile.gate.signupLead': 'Create a new profile with your nickname and favourite gelato flavour.',
      'profile.gate.loginLead': 'Log in with your nickname and gelato flavour.',
      'profile.gate.nickname': 'Nickname',
      'profile.gate.nicknamePh': 'E.g. StellaRosa',
      'profile.gate.gelatoLabel': 'Favourite gelato flavour',
      'profile.gate.gelatoPh': 'E.g. Buontalenti',
      'profile.gate.signupBtn': 'Sign up',
      'profile.gate.loginBtn': 'Log in',
      'profile.gate.deviceNote': 'Data is stored only on this device.',

      'profile.err.fillBothMin2': 'Fill in both fields (at least 2 characters).',
      'profile.err.nicknameTaken': 'This nickname is already taken. Choose another one.',
      'profile.err.fillBoth': 'Fill in both fields.',
      'profile.err.notFound': 'Profile not found. Check nickname and flavour.',
      'profile.ok.signup': 'Sign-up successful! Welcome {{name}}. Reloading...',
      'profile.ok.login': 'Login successful! Welcome back {{name}}. Reloading...',

      'profile.switch.title': 'Switch profile',
      'profile.switch.text': 'Do you want to switch to another profile? Your current progress will stay saved.',
      'profile.switch.confirm': 'Yes, switch profile',
      'profile.switch.button': 'Switch profile',
    },

    es: {
      'lang.label': 'Idioma',
      'lang.it': 'Italiano',
      'lang.en': 'English',
      'lang.es': 'Español',
      'lang.fr': 'Français',

      'common.close': 'Cerrar',
      'toast.copied': 'Copiado al portapapeles ✅',

      'quiz.generic': 'Quiz',
      'carousel.headerAria': 'Desplaza el carrusel: desliza izquierda/derecha o haz clic (izquierda=anterior, derecha=siguiente)',

      'card.procedure': 'Procedimiento',
      'card.checklist': 'Checklist',
      'card.rules': 'Reglas',
      'card.table': 'Tabla',
      'card.routine': 'Rutina',
      'card.deepCleanSteps': 'Pasos de limpieza profunda',
      'card.stepsTips': 'Pasos y tips',
      'card.details': 'Detalles',
      'card.use': 'Uso',
      'card.notes': 'Notas',

      'gelatoLab.hero.badge': 'Línea de GELATO',
      'gelatoLab.hero.stars': '⭐ Estrellas: 8/8',
      'gelatoLab.hero.desc': 'Manual del banco de GELATO: porciones, servicio para llevar, copas “wow” y mantenimiento de la vitrina a -14/-15 °C.',
      'gelatoLab.carousel.products.category': 'Línea de GELATO',
      'gelatoLab.ops.title': 'Setup y conservación',
      'gelatoLab.ops.category': 'Apertura · Setup · Almacenaje · Scampoli · Cierre',

      'gelatoLab.cards.cups.desc': 'Vasitos en tres tamaños: Pequeño (1 sabor, 100 g), Mediano (1-2 sabores, 140 g), Grande (1-3 sabores, 180 g). La clave es dosificar bien y compactar para eliminar burbujas de aire y mantener una presentación uniforme.',
      'gelatoLab.cards.cups.stats': `<li>Pesaje: Pequeño 100-120g, Mediano 160-200g, Grande 200-240g (verifica siempre)</li><li>Técnica de scoop: lineal + bola para un look profesional</li><li>Compactado: presiona el GELATO contra el lateral del vaso para quitar aire</li><li>Espátula: caliéntala sobre el GELATO para facilitar el servicio</li><li>Final: ofrece siempre wafer y nata montada (upselling)</li><li>Temp. ideal del GELATO: -14/-15°C (si está más caliente es más difícil dosificar)</li>`,
      'gelatoLab.cards.cups.details': `<div class="steps"><span>1 · Calienta la espátula sobre el sabor para ablandarlo.</span><span>2 · Presiona el GELATO contra el lateral del vaso para eliminar aire.</span><span>3 · Ofrece wafer/nata y sonríe.</span></div><div class="tips">Los niños pueden elegir dos sabores incluso en el tamaño pequeño.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opción 1:</strong> "¿Quieres pasar a mediano? Añade otro sabor y nata"</span><span><strong>Opción 2:</strong> "¿Te añado nata montada y wafer crujiente?"</span><span><strong>Opción 3:</strong> "Con salsa de pistacho queda aún más goloso"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Pesa siempre para respetar el rango de gramos. Usa la técnica “scoop lineal + bola” para un look pro. Temp. ideal del GELATO: -14/-15°C.</div>`,

      'gelatoLab.cards.cones.desc': 'Conos en tres variantes: Clásico (1 sabor), Chocolate o Gluten Free (1-2 sabores). Envuelve siempre el cono con tissue para agarre y presentación. Mantén la zona de conos limpia para evitar contaminación de sabores.',
      'gelatoLab.cards.cones.stats': `<li>Envoltorio: tissue siempre, para agarre y look</li><li>Dosificación: 1 bola para cono clásico, 1-2 bolas para conos especiales (choco/GF)</li><li>Colocación: apoya la bola girando el cono para estabilidad</li><li>Limpieza: cada 30 min elimina migas (absorben humedad)</li><li>Rotación: FIFO estricto (los conos absorben humedad; usa primero los menos frescos)</li><li>Upgrade: cono chocolate (recubierto dentro y fuera), nata montada</li>`,
      'gelatoLab.cards.cones.details': `<div class="steps"><span>1 · Envuelve el cono con tissue.</span><span>2 · Prepara la bola y colócala girando.</span><span>3 · Propón upgrade a cono choco o nata montada.</span></div><div class="tips">Mantén la zona de conos limpia eliminando migas.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opción 1:</strong> "¿Upgrade al cono chocolate? Está recubierto por dentro y por fuera"</span><span><strong>Opción 2:</strong> "Cono gluten-free disponible (si hay)"</span><span><strong>Opción 3:</strong> "¿Añadimos nata montada arriba para look Instagram?"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Limpia la zona cada 30 min. FIFO estricto: los conos absorben humedad. Envuelve siempre con tissue para agarre.</div>`,

      'gelatoLab.cards.boxes.desc': 'GELATO para llevar en cajas térmicas de 500/750/1000 ml. Cada caja mantiene el GELATO en buen estado ~1 hora si va dentro de la bolsa térmica. Recuerda al cliente que lo ponga en el congelador en casa lo antes posible: el GELATO cambia de textura al descongelarse.',
      'gelatoLab.cards.boxes.stats': `<li>Pequeño: 500 ml (1-3 sabores)</li><li>Mediano: 750 ml (1-4 sabores)</li><li>Grande: 1000 ml (1-5 sabores)</li><li>Orden: empieza por sabores más blandos (sorbet primero) para evitar contaminación</li><li>Compactado: elimina aire; limpia bordes con espátula antes de sellar</li><li>Sellado: film + cinta Badiani; entrega en bolsa térmica</li><li>Autonomía: ~1 hora; recuerda siempre el congelador en casa</li>`,
      'gelatoLab.cards.boxes.details': `<div class="steps"><span>1 · Añade sabores empezando por los más blandos (sorbet primero).</span><span>2 · Compacta para eliminar aire y limpia los bordes.</span><span>3 · Sella con film + cinta Badiani y colócalo en la bolsa.</span></div><div class="tips">Upsell: caja más grande + pack de 10 waffles o conos.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opción 1:</strong> "La caja de 1L te permite probar más sabores"</span><span><strong>Opción 2:</strong> "¿Añadimos un pack de conos para servir en casa?"</span><span><strong>Opción 3:</strong> "Con bolsa térmica se mantiene perfecto hasta 2 horas"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Compacta bien para evitar cristales. Limpia bordes antes de sellar. Autonomía ~1h: recuerda congelador ASAP.</div>`,

      'gelatoLab.cards.coppa.desc': 'Tres bolas de GELATO en copa de vidrio, con nata montada, una salsa a elección, mini cono y wafer Badiani. Es la opción “wow”: construye con orden y sirve enseguida para mantener textura y topping limpio.',
      'gelatoLab.cards.coppa.stats': `<li>Base: copa de vidrio</li><li>Porción: 3 scoops con scooper redondo (pueden ser 3 sabores)</li><li>Top: nata montada + swirl de la salsa elegida</li><li>Final: mini cono + wafer Badiani</li><li>Servicio: cuchara de acero, entrega inmediata</li>`,
      'gelatoLab.cards.coppa.details': `<div class="steps"><span>1 · Usa una copa de vidrio y prepara 3 bolas regulares con scooper redondo.</span><span>2 · Completa con nata montada y un swirl de la salsa elegida (sin manchar el borde).</span><span>3 · Añade mini cono + wafer Badiani y sirve con cuchara de acero.</span></div><div class="tips">Sugiere pairing con Slitti dragée para un postre completo.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Opción 1:</strong> "¿Añadimos crumble de avellana tostada y dragée Slitti?"</span><span><strong>Opción 2:</strong> "Doble salsa (pistacho + chocolate) la hace signature"</span><span><strong>Opción 3:</strong> "Maridaje perfecto: Coppa + espresso affogato style"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Usa copas frías para mantener temperatura. Haz bolas uniformes. Sirve inmediatamente para evitar que la nata se derrita.</div>`,

      'gelatoLab.ops.displayPrep.title': 'Preparación vitrina (mañana)',
      'gelatoLab.ops.displayPrep.desc': 'Limpia, pule y prepara la vitrina antes de exponer. Expón solo cuando la máquina llegue a -14/-15 °C.',
      'gelatoLab.ops.displayPrep.stats': `<li>Limpieza: paño húmedo con agua caliente + sanitiser amarillo en manchas de GELATO</li><li>Metales: blue spray + blue roll para que brillen</li><li>Setup: coloca barras porta-bandejas, enciende, pon bandejas y sliding doors</li><li>Exposición: a -14/-15 °C, carga sabores y cierra sliding doors</li>`,
      'gelatoLab.ops.displayPrep.details': `<div class="steps"><span>1 · Limpia y pule (sobre todo metales y sliding doors).</span><span>2 · Enciende y coloca barras + bandejas.</span><span>3 · A -14/-15°C: expón GELATO y cierra las puertas.</span></div><div class="tips">Revisa primero el freezer de scampoli: si un sabor es recuperable, úsalo bien.</div>`,

      'gelatoLab.ops.tempDoors.title': 'Temperatura y puertas (standard)',
      'gelatoLab.ops.tempDoors.desc': 'Standard clave: vitrina a -14/-15 °C. Si la tienda no está busy, las sliding doors deben estar en posición para conservar la temperatura.',
      'gelatoLab.ops.tempDoors.stats': `<li>Target: -14/-15 °C (registra en HACCP si aplica)</li><li>Puertas: en posición cuando no hay servicio activo</li><li>Utensilios: las espátulas usadas para limpiar deben lavarse y secarse antes de otros sabores</li>`,
      'gelatoLab.ops.tempDoors.details': `<div class="steps"><span>1 · Controla temperatura y registra según estándar local.</span><span>2 · Mantén sliding doors cerradas entre servicios.</span><span>3 · Lava/seca utensilios tras cada limpieza para evitar contaminación.</span></div>`,

      'gelatoLab.ops.treatsShelfLife.title': 'Shelf life treats (tras exposición)',
      'gelatoLab.ops.treatsShelfLife.desc': 'Tabla rápida: días máximos tras exposición en la vitrina de treats.',
      'gelatoLab.ops.treatsShelfLife.stats': `<li>Cakes / Pinguinos / Mini semifreddo: 35 días</li><li>Mini cakes / Mini cones: 21 días</li><li>Cookies: 14 días</li>`,
      'gelatoLab.ops.treatsShelfLife.details': `<div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">Shelf life una vez expuestos</strong><span>Cakes / Pinguinos / Mini semifreddo: 35 días</span><span>Mini cakes / Mini cones: 21 días</span><span>Cookies: 14 días</span></div>`,

      'gelatoLab.ops.treatFreezer.title': 'Gestión treat freezer',
      'gelatoLab.ops.treatFreezer.desc': 'Vitrina vertical a -14 °C, defrost semanal, productos expuestos con guantes.',
      'gelatoLab.ops.treatFreezer.stats': `<li>Coloca cakes en la balda superior, cookies/pinguinos en la inferior (a la altura de los niños)</li><li>Shelf life tras exposición: cakes/pinguinos 35 días, mini semifreddi 35, mini cakes 21, mini cones 21, cookies 14</li>`,
      'gelatoLab.ops.treatFreezer.details': `<div class="steps"><span>1 · Maximiza espacio, FIFO.</span><span>2 · Recuerda que son productos de GELATO.</span><span>3 · Usa box térmico (~1h) para take away.</span></div><div class="tips">Quita hielo semanalmente para una visibilidad impecable.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Técnica 1:</strong> "Coloca treats a la altura de los niños para compras impulso"</span><span><strong>Técnica 2:</strong> "Box mixto pinguinos/cookies para fiestas (según tarifa local)"</span><span><strong>Técnica 3:</strong> "Mini semifreddi perfectos como postre de última hora"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Mantén -14°C constante. Retira hielo semanal con espátula de plástico. Usa guantes siempre.</div>`,

      'gelatoLab.ops.scampolo.title': 'Regla Scampolo (1/4 pan)',
      'gelatoLab.ops.scampolo.desc': 'Cuando un sabor tiene menos de 1/4 de bandeja es un scampolo y debe sustituirse. Puedes integrarlo poco a poco en la bandeja nueva, sin superar 5–7 cm.',
      'gelatoLab.ops.scampolo.stats': `<li>Definición: &lt; 1/4 pan = scampolo</li><li>Añadir: ~100 g cada vez (aprox. el lateral de un scoop)</li><li>Límite: máx. 5–7 cm de scampolo total</li>`,
      'gelatoLab.ops.scampolo.details': `<div class="steps"><span>1 · Toma el scampolo del freezer de scampoli.</span><span>2 · Añade pequeñas cantidades y nivela (no debe “parecer añadido”).</span><span>3 · No superes 5–7 cm de scampolo total.</span></div><div class="tips">Scampolo = control de desperdicio, respetando siempre el estándar visual.</div>`,

      'gelatoLab.ops.closeDeepClean.title': 'Cierre y limpieza profunda (vitrina)',
      'gelatoLab.ops.closeDeepClean.desc': 'Rutina: vitrina OFF cada noche. Limpieza profunda completa 1 vez por semana, incluida la limpieza de filtros.',
      'gelatoLab.ops.closeDeepClean.stats': `<li>Cada noche: switch off + limpieza diaria</li><li>Semanal: limpieza profunda + limpieza de filtros</li><li>Focus: eliminar nuts/crumbs y desinfectar superficies</li>`,
      'gelatoLab.ops.closeDeepClean.details': `<div class="steps"><span>1 · Retira paneles inferiores y limpia manchas de GELATO.</span><span>2 · Elimina nuts/crumbs; spray desinfectante + paño en todas las superficies.</span><span>3 · Blue spray + blue roll para pulir; deep clean en label stands; monta y enciende.</span></div><div class="tips">Sliding doors: si no está busy, mantenlas en posición para conservar la temperatura.</div>`,

      'gelatoLab.footer.tagline': 'El arte del GELATO florentino',
      'gelatoLab.footer.tempLabel': 'Temp. ideal',
      'gelatoLab.footer.heritageLabel': 'Herencia',

      'caffe.hero.badge': 'Bar & Drinks · 2025',
      'caffe.hero.stars': '⭐ Estrellas: 18/18',
      'caffe.hero.desc': 'La guía completa de bebidas Badiani: desde los clásicos de la cafetería italiana hasta el nuevo Matcha Bar, además de Smoothies y bebidas frías. Incluye procedimientos de servicio en mesa y Take Away (TW).',

      'sweetTreats.hero.badge': 'Línea de postres · 2025',
      'sweetTreats.hero.stars': '⭐ Estrellas: 13/13',
      'sweetTreats.hero.desc': 'Laboratorio digital de crepes, waffles, burger de GELATO y tea sets. Incluye gramajes, shelf life, orden de montaje y estilo de servicio para sorprender en boutique.',

      'sweetTreats.carousel.main.title': 'Sweet Crepes & Waffles',
      'sweetTreats.carousel.main.category': 'Tentaciones dulces',

      'sweetTreats.cards.crepeSauce.desc': 'Crepe clásica servida con una de nuestras salsas signature (Pistacho, Avellana, Chocolate). Base perfecta para cualquier extra.',
      'sweetTreats.cards.crepeSauce.stats': `<li><strong>Shelf life del mix:</strong> 3 días (frigo)</li><li><strong>Reposo:</strong> mínimo 2 horas (frigo)</li><li><strong>Cocción:</strong> 20s por lado</li>`,
      'sweetTreats.cards.crepeSauce.details': `<div class="steps"><span>1 · Extiende el mix; gira cuando esté dorada.</span><span>2 · Unta la salsa en la mitad, cierra en media luna y luego en abanico.</span><span>3 · Emplata, azúcar glas y drizzle de salsa por encima.</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> La plancha debe estar muy caliente pero sin humo. La primera suele ser de prueba.</div>`,

      'sweetTreats.cards.buontalentiCrepe.desc': 'Nuestro best seller: crepe con salsa a elección y un scoop de Buontalenti encima.',
      'sweetTreats.cards.buontalentiCrepe.stats': `<li><strong>GELATO:</strong> 1 scoop Buontalenti (70g)</li><li><strong>Salsa:</strong> 30g interior + decoración</li><li><strong>Servicio:</strong> Plato postre con cubiertos</li>`,
      'sweetTreats.cards.buontalentiCrepe.details': `<div class="steps"><span>1 · Prepara la crepe con salsa según estándar.</span><span>2 · Dobla en abanico y espolvorea azúcar glas.</span><span>3 · Coloca el scoop de Buontalenti encima y termina con salsa.</span></div><div class="tips">Añade el GELATO al último segundo para evitar que se derrita sobre la crepe caliente.</div>`,

      'sweetTreats.cards.waffles.desc': 'Waffle dorado y crujiente por fuera, suave por dentro. Servido con salsas, fruta o GELATO.',
      'sweetTreats.cards.waffles.stats': `<li><strong>Cocción:</strong> 2.5 min por lado (5 min total)</li><li><strong>Reposo:</strong> 45s para crujiente</li><li><strong>Batter:</strong> 1 scoop (177ml)</li>`,
      'sweetTreats.cards.waffles.details': `<div class="steps"><span>1 · Vierte el mix en la plancha caliente y cierra.</span><span>2 · Cocina 2.5 min, gira y cocina otros 2.5 min.</span><span>3 · Deja reposar en rejilla 45s antes de decorar.</span></div><div class="tips">El reposo es clave: si se sirve al momento queda blando.</div>`,

      'sweetTreats.cards.pancake.desc': 'Torre de 3 pancakes esponjosos. Se sirven con sirope de arce, fruta fresca o salsas Badiani.',
      'sweetTreats.cards.pancake.stats': `<li><strong>Porción:</strong> 3 piezas</li><li><strong>Cocción:</strong> hasta que aparezcan burbujas</li><li><strong>Topping:</strong> generoso</li>`,
      'sweetTreats.cards.pancake.details': `<div class="steps"><span>1 · Vierte 3 discos de masa en la plancha.</span><span>2 · Gira cuando aparezcan burbujas en la superficie.</span><span>3 · Apila y decora generosamente.</span></div>`,

      'sweetTreats.cards.italianaPlain.desc': 'Mozzarella, rúcula y tomates cherry sobre base clásica. Fresca y ligera.',
      'sweetTreats.cards.italianaPlain.stats': `<li><strong>Base:</strong> Clásica</li><li><strong>Relleno:</strong> Mozzarella, rúcula, cherry</li><li><strong>Aliño:</strong> Aceite EVO, sal, orégano</li>`,
      'sweetTreats.cards.italianaPlain.details': `<div class="steps"><span>1 · Cocina la crepe y gira.</span><span>2 · Añade mozzarella y deja que se funda un poco.</span><span>3 · Añade rúcula y cherry aliñados; cierra tipo sobre.</span></div>`,

      'sweetTreats.cards.italianaBeetroot.desc': 'La versión colorida: masa de remolacha para un look único y un toque dulce-terroso.',
      'sweetTreats.cards.italianaBeetroot.stats': `<li><strong>Base:</strong> Beetroot (remolacha)</li><li><strong>Relleno:</strong> Mozzarella, rúcula, cherry</li><li><strong>Visual:</strong> rojo/morado intenso</li>`,
      'sweetTreats.cards.italianaBeetroot.details': `<div class="steps"><span>1 · Usa el mix beetroot (3g de polvo por 250g de mix).</span><span>2 · Monta como la Italiana clásica.</span><span>3 · El contraste de color es el punto fuerte: deja ver el relleno.</span></div>`,

      'sweetTreats.cards.prosciuttoPlain.desc': 'Clásica con Prosciutto Crudo, mozzarella y rúcula.',
      'sweetTreats.cards.prosciuttoPlain.stats': `<li><strong>Base:</strong> Clásica</li><li><strong>Relleno:</strong> Crudo, mozzarella, rúcula</li><li><strong>Servicio:</strong> caliente y fundente</li>`,
      'sweetTreats.cards.prosciuttoPlain.details': `<div class="steps"><span>1 · Funde la mozzarella mientras cocina la crepe.</span><span>2 · Añade el prosciutto al final para no cocinarlo demasiado.</span><span>3 · Completa con rúcula y cierra.</span></div>`,

      'sweetTreats.cards.prosciuttoBeetroot.desc': 'Prosciutto Crudo sobre base de remolacha. Un twist moderno de un clásico.',
      'sweetTreats.cards.prosciuttoBeetroot.stats': `<li><strong>Base:</strong> Beetroot</li><li><strong>Relleno:</strong> Crudo, mozzarella, rúcula</li><li><strong>Sabor:</strong> salado + dulce (masa)</li>`,
      'sweetTreats.cards.prosciuttoBeetroot.details': `<div class="steps"><span>1 · Prepara la base beetroot.</span><span>2 · Rellena generosamente.</span><span>3 · Sirve cortada a la mitad para mostrar capas.</span></div>`,

      'sweetTreats.cards.gelatoBurger.desc': 'Un scoop de GELATO dentro de un pan brioche suave, cerrado en caliente en segundos: efecto “wow” y servicio rápido.',
      'sweetTreats.cards.gelatoBurger.stats': `<li><strong>Pan:</strong> brioche bun ligeramente caliente</li><li><strong>GELATO:</strong> 1 scoop (~70 g) a elección</li><li><strong>Sauce:</strong> 1 sola elección (standard)</li>`,
      'sweetTreats.cards.gelatoBurger.details': `<div class="steps"><span>1 · Calienta ligeramente la brioche (sin tostar demasiado).</span><span>2 · Añade un scoop de GELATO (~70 g) y termina con una sola salsa a elección.</span><span>3 · Cierra, sirve al momento y sugiere comer como un sándwich.</span></div>`,

      'sweetTreats.ops.title': 'Setup y conservación',
      'sweetTreats.ops.category': 'Apertura · Ajustes · Datos técnicos · Almacenaje · Cierre',

      'sweetTreats.ops.opening.title': 'Checklist de apertura (estaciones)',
      'sweetTreats.ops.opening.desc': 'Antes del servicio verifica que las máquinas estén listas y que mix/ingredientes estén en orden. La Gelato Burger Machine debe encenderse en apertura y apagarse en cierre.',
      'sweetTreats.ops.opening.stats': `<li>Waffle machine: enciende y espera ambas luces verdes (READY + POWER)</li><li>Gelato Burger Machine: ON en apertura; normalmente lista ~10 min después</li><li>Crepe mix: debe reposar en frigo al menos 2 horas antes de usar</li>`,
      'sweetTreats.ops.opening.details': `<div class="steps"><span>1 · Enciende máquinas y confirma temperatura/listo.</span><span>2 · Revisa mixes y stock (etiquetas, FIFO, fechas).</span><span>3 · Prepara blue roll y botellas de sauce para una estación limpia y rápida.</span></div><div class="tips">Objetivo: cero espera en el primer pedido y estaciones ya “service ready”.</div>`,

      'sweetTreats.ops.settings.title': 'Ajustes de máquinas (standard)',
      'sweetTreats.ops.settings.desc': 'Configura lo básico antes del rush: menos errores, menos desperdicio y productos más consistentes.',
      'sweetTreats.ops.settings.stats': `<li>Waffle: engrasa ligeramente con aceite de semillas; power nivel 3; cocción 2,5 min por lado (5 min total)</li><li>Waffle: reposo 45s antes de topping/GELATO (crujiente)</li><li>Gelato Burger: temporizador 12 segundos; no hace falta engrasar las placas</li>`,
      'sweetTreats.ops.settings.details': `<div class="steps"><span>1 · Waffle: set power 3 y no empieces hasta que READY + POWER estén activos.</span><span>2 · Gelato Burger: set timer 12s y usa solo blue-roll para goteos/salsas.</span><span>3 · Mantén la superficie limpia: migas = cae la calidad visual.</span></div><div class="tips">No oil en la Gelato Burger machine: no se engrasan las placas.</div>`,

      'sweetTreats.ops.storage.title': 'Shelf life y storage rápido',
      'sweetTreats.ops.storage.desc': 'Este módulo es “más storage que show”: controla siempre fechas y condiciones.',
      'sweetTreats.ops.storage.stats': `<li>Crepe mix: shelf life 3 días (frigo) + reposo mínimo 2 horas (frigo)</li><li>Waffle mix (pre-packed): shelf life 2 días</li><li>Gelato Burger: shelf life del bun una vez defrosted = 2 días</li><li>Gelato Croissant: shelf life del croissant plain = 2 días</li>`,
      'sweetTreats.ops.storage.details': `<div class="steps"><span>1 · Etiqueta con fecha de preparación/apertura y caducidad.</span><span>2 · FIFO estricto: usa primero lo que caduca antes.</span><span>3 · Fuera de rango/sin etiqueta: no servir.</span></div><div class="tips">Storage = training: consistencia = clientes que vuelven.</div>`,

      'sweetTreats.ops.portions.title': 'Porcionado y dosis (quick ref)',
      'sweetTreats.ops.portions.desc': 'Ficha de mostrador: dosis clave para velocidad y estándar.',
      'sweetTreats.ops.portions.stats': `<li>Waffle: 1 scoop entero de batter = 177 ml</li><li>Crepe: 1 scoop o 1,5 small ladle scoop de mix</li><li>Signature Buontalenti Crepe: Buontalenti 70 g + sauce top ~30 g</li><li>Gelato Burger: 1 scoop de GELATO = 70 g (uno solo) + una sola sauce</li>`,
      'sweetTreats.ops.portions.details': `<div class="steps"><span>1 · Usa scoops dedicados: reduces variación entre operadores.</span><span>2 · Si el producto sale fuera de estándar, corrige al momento (no “compenses” con extra).</span><span>3 · Anota errores recurrentes: son puntos de training.</span></div>`,

      'sweetTreats.ops.closing.title': 'Cierre y limpieza rápida',
      'sweetTreats.ops.closing.desc': 'Al final del día reduce residuos y riesgos: en la Gelato Burger Machine se usa solo blue-roll para goteos de GELATO/salsa y para retirar migas.',
      'sweetTreats.ops.closing.stats': `<li>Gelato Burger Machine: OFF al cierre; superficie sin residuos/partículas</li><li>Waffle: retira residuos y deja la estación lista para mañana</li><li>Mix: guarda en frigo con etiqueta (o desecha si supera shelf life)</li>`,
      'sweetTreats.ops.closing.details': `<div class="steps"><span>1 · Apaga máquinas y deja enfriar con seguridad.</span><span>2 · Limpia con blue-roll: nada de aceite en placas Gelato Burger.</span><span>3 · Frigo + etiquetas para mixes/ingredientes; desecha lo que exceda shelf life.</span></div><div class="tips">Limpio y seco hoy = apertura más rápida mañana.</div>`,

      'sweetTreats.footer.tagline': 'Crepes, Waffles & More',
      'sweetTreats.footer.stat1.value': '10+ Variantes',
      'sweetTreats.footer.stat1.label': 'Menú',
      'sweetTreats.footer.stat2.value': 'Sweet & Savory',
      'sweetTreats.footer.stat2.label': 'Sabores',

      'pastries.hero.badge': 'Pastelería de mostrador',
      'pastries.hero.stars': '⭐ Estrellas: 6/6',
      'pastries.hero.desc': 'Todas las referencias servidas en mostrador: cakes, brownies, loaf, croissants rellenos y scones con un scoop de Buontalenti. Cada ficha incluye shelf life, porciones y guion de upselling.',
      'pastries.hero.coverAlt': 'Cakes y brownie Badiani',

      'pastries.carousel.main.title': 'Pastry Lab',
      'pastries.carousel.main.category': 'Pastelería de mostrador',

      'pastries.cards.cakes.alt': 'Porción de tarta Badiani',
      'pastries.cards.cakes.desc': 'Chocolate (3g), Carrot (2g), Walnut (3g) respetando 14 porciones por tarta.',
      'pastries.cards.cakes.stats': `<li>Usa el cake slicer como guía</li><li>Sirve en plato con cubiertos</li><li>Upsell scoop Buontalenti + sauce</li>`,
      'pastries.cards.cakes.details': `<div class="steps"><span>1 → Coloca el cutter y marca las 14 porciones.</span><span>2 → Sirve la porción en plato y sugiere pairing con GELATO.</span><span>3 → Si el upsell funciona, añade un scoop con el milkshake scooper y drizzle sobre la porción.</span></div><div class="tips">Recordatorio al equipo: chocolate caliente + cake crea una combo premium.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💫 Upselling</strong><span><strong>Opción 1:</strong> "¿Quieres enriquecer la porción con un scoop de Buontalenti?"</span><span><strong>Opción 2:</strong> "¿Añadimos un drizzle de salsa de pistacho o caramelo?"</span><span><strong>Opción 3:</strong> "¿La combo perfecta? Cake + chocolate caliente"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> Mantén las cakes cubiertas con film entre cortes para evitar que se sequen. Temp. ambiente: máx. 2 horas fuera del frigo.</div>`,

      'pastries.cards.brownie.alt': 'Brownie Badiani',
      'pastries.cards.brownie.desc': 'Corte 4×3 (12 piezas) y servicio en plato con cubiertos.',
      'pastries.cards.brownie.stats': `<li>Display en el tray dedicado</li><li>Upsell GELATO + sauce</li><li>Comunicar shelf life</li>`,
      'pastries.cards.brownie.details': `<div class="steps"><span>1 - Corta 12 piezas iguales y expón en bandeja.</span><span>2 - Al pedido, emplata y ofrece un scoop de Buontalenti.</span><span>3 - Drizzle sobre el brownie y sobre el GELATO.</span></div><div class="tips">Usa el round scooper para mantener la porción perfecta.</div>`,

      'pastries.cards.loaf.alt': 'Banana Loaf',
      'pastries.cards.loaf.desc': 'Cada loaf debe dar 10 porciones. Servicio y upsell idénticos a las cakes.',
      'pastries.cards.loaf.stats': `<li>Corta grosores constantes</li><li>Sirve con cubiertos</li><li>Propón la sauce favorita</li>`,
      'pastries.cards.loaf.details': `<div class="steps"><span>1 - Corta 10 slices iguales y muestra la primera.</span><span>2 - Añade scoop + sauce si el cliente acepta.</span><span>3 - Mantén el loaf envuelto cuando no se use.</span></div><div class="tips">Indica la shelf life en la etiqueta para facilitar controles diarios.</div>`,

      'pastries.cards.croissants.alt': 'Croissant relleno',
      'pastries.cards.croissants.desc': 'Croissant ya laminado, para rellenar con la sauce que pida el cliente. Abre lateralmente, rellena y completa la presentación en plato con tenedor y cuchillo. Recuerda calentar ligeramente los croissants del día anterior para recuperar fragancia.',
      'pastries.cards.croissants.stats': `<li>Shelf life: 2 días desde defrost (revisa fecha)</li><li>Corte: usa cuchillo de sierra; abre el lateral en horizontal</li><li>Relleno: manga pastelera para uniformidad y precisión</li><li>Presentación: sauce inside + drizzle arriba, plato limpio, cubiertos siempre</li><li>Calentado (si hace falta): solo 8–10 segundos; nunca más de 15s (el relleno se derrite)</li>`,
      'pastries.cards.croissants.details': `<div class="steps"><span>1 - Abre el lateral con cuchillo de sierra.</span><span>2 - Rellena interior y topping exterior con la misma sauce.</span><span>3 - Emplata, añade cubiertos y sirve.</span></div><div class="tips">Comunica shelf life y rotación: 2 días desde defrost.</div>`,

      'pastries.cards.scone.alt': 'Scone relleno de GELATO',
      'pastries.cards.scone.desc': 'Calienta 15 s en la gelato burger machine, rellena con scoop Buontalenti y sauce.',
      'pastries.cards.scone.stats': `<li>Corta en horizontal</li><li>Usa el milkshake scooper</li><li>Acabado pistacho o chocolate</li>`,
      'pastries.cards.scone.details': `<div class="steps"><span>1 - Calienta 15 s.</span><span>2 - Corta, añade el scoop y cierra.</span><span>3 - Sauce top; emplata con cubiertos.</span></div><div class="tips">Recuerda al cliente el contraste caliente/frío para potenciar el upsell.</div>`,

      'pastries.ops.title': 'Setup y conservación',
      'pastries.ops.category': 'Apertura · Datos técnicos · Shelf life · FIFO · Cierre',

      'pastries.ops.display.alt': 'Vitrina pastry Badiani',
      'pastries.ops.display.desc': 'Objetivo de apertura: vitrina llena, ordenada y legible. Label siempre junto al tray correcto; las cakes en cake stand con una porción retirada para mostrar el interior.',
      'pastries.ops.display.stats': `<li>CAKES: cake stands + retirar 1 slice (visual interior)</li><li>CROISSANTS: en trays dedicados (filas limpias)</li><li>BROWNIES/PUDDING/TARTS/SCONES: en tray, alineados</li><li>LOAF: cortar y mostrar la primera porción en el tray</li>`,
      'pastries.ops.display.details': `<div class="steps"><span>1 · Restablece un “full look” (sin huecos visibles).</span><span>2 · Coloca las label junto al tray correcto (nunca genéricas).</span><span>3 · Verifica FIFO y shelf life antes del primer servicio.</span></div><div class="tips">Consistencia visual = ventas. Un mostrador “lleno” invita a comprar.</div>`,

      'pastries.ops.cuts.desc': 'Porciones consistentes = calidad consistente. Usa siempre los mismos cortes para controlar food cost y trabajar “en equipo”.',
      'pastries.ops.cuts.stats': `<li>Cake: usa el cake slicer guía (14 porciones)</li><li>Brownie tray: corte 4×3 = 12 piezas</li><li>Loaf: saca 10 slices de la pieza entera</li>`,
      'pastries.ops.cuts.details': `<div class="steps"><span>1 · Usa siempre la misma herramienta guía (slicer / regla visual).</span><span>2 · Si una porción sale fuera de estándar, corrige el siguiente corte.</span><span>3 · Mantén las cuchillas limpias: corte limpio = presentación premium.</span></div>`,

      'pastries.ops.shelf.desc': 'Lista de shelf life para controles diarios, rotación y labels correctas.',
      'pastries.ops.shelf.stats': `<li>Chocolate Cake: 3 días</li><li>Carrot Cake: 2 días</li><li>Walnut Cake: 3 días</li><li>Brownie: 4 días</li><li>Banana Loaf: 4 días</li><li>Croissants: 2 días</li><li>Scones: 2 días</li>`,
      'pastries.ops.shelf.details': `<div class="steps"><span>1 · Etiqueta siempre: fecha de defrost/apertura + caducidad.</span><span>2 · FIFO estricto (first in, first out).</span><span>3 · En caso de duda: no servir (pregunta al manager).</span></div>`,

      'pastries.ops.full.desc': 'Regla de vitrina: debe parecer siempre llena y ordenada. Las label van junto al tray correcto, siempre.',
      'pastries.ops.full.stats': `<li>Reubica productos para cerrar huecos (sin mezclar referencias)</li><li>Alinea frentes: brownie/loaf/croissant siempre “en formación”</li><li>Comprueba que las label sean legibles y coherentes con el tray</li>`,
      'pastries.ops.full.details': `<div class="steps"><span>1 · Rellena y realinea después de cada rush.</span><span>2 · Actualiza las label cuando cambie el tray (nunca dejes “antiguas”).</span><span>3 · Revisa caducidades durante los refills.</span></div><div class="tips">Visual merchandising = training: es una skill, no un detalle.</div>`,

      'pastries.ops.close.desc': 'Objetivo: restaurar orden y preparar un arranque rápido mañana, sin perder control de shelf life.',
      'pastries.ops.close.stats': `<li>Retira migas y residuos de los trays (antes de que se “peguen”)</li><li>Agrupa por referencia y verifica caducidades (FIFO)</li><li>Comprueba que todas las label estén presentes y correctas</li>`,
      'pastries.ops.close.details': `<div class="steps"><span>1 · Ordena por categoría, revisa fechas y desecha lo que supere shelf life.</span><span>2 · Limpia superficies y trays; seca antes de cerrar.</span><span>3 · Deja el mostrador “opening-ready”: label y layout ya listos.</span></div>`,

      'pastries.footer.tagline': 'Desayuno y merienda',
      'pastries.footer.stat1.value': 'Diario',
      'pastries.footer.stat1.label': 'Frecuencia',
      'pastries.footer.stat2.value': 'Fresco',
      'pastries.footer.stat2.label': 'Calidad',

      'nav.menu': 'Menú',
      'nav.homeAria': 'Volver al inicio de Badiani',
      'nav.profileAria': 'Perfil de usuario',
      'nav.profileLabel': 'Perfil',

      'menu.cluster.orbit': 'Orbit',
      'menu.cluster.beverage': 'Bebidas y dulces',
      'menu.cluster.gelato': 'Gelato y especiales',

      'menu.link.hub': 'Hub',
      'menu.link.storyOrbit': 'Story Orbit',
      'menu.link.operations': 'Operaciones y setup',
      'menu.link.caffe': 'Bar y bebidas',
      'menu.link.sweetTreats': 'Sweet Treat Atelier',
      'menu.link.pastries': 'Pastry Lab',
      'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
      'menu.link.gelatoLab': 'Gelato Lab',
      'menu.link.festive': 'Festive & Churros',

      'drawer.categories': 'Categorías',
      'drawer.close': 'Cerrar menú',

      'quizSolution.eyebrow': 'Quiz · Solución',
      'quizSolution.title': 'Revisa la respuesta correcta',
      'quizSolution.loadingQuestion': 'Cargando pregunta...',
      'quizSolution.loadingAnswer': 'Cargando respuesta correcta...',
      'quizSolution.explainLabel': 'Explicación:',
      'quizSolution.tipLabel': 'Sugerencia:',
      'quizSolution.backHub': '⬅ Volver al hub',
      'quizSolution.openSpecs': '📖 Abrir especificaciones',
      'quizSolution.back': '↩ Volver atrás',
      'quizSolution.correctAnswerPrefix': 'Respuesta correcta:',
      'quizSolution.openSuggestedCard': '📖 Abrir ficha sugerida',
      'quizSolution.noQuestion': 'No se recibió ninguna pregunta.',
      'quizSolution.retry': 'Vuelve al quiz e inténtalo de nuevo.',

      'hub.badge': 'Training Orbit',
      'hub.eyebrow': 'Hub operativo · actualizado a diario',
      'hub.title': 'Playbook operativo Badiani 1932',
      'hub.lede': 'Tradición florentina, rituales boutique y procedimientos digitalizados en una sola cabina: consulta, repasa y cierra los quizzes para canjear GELATO reales.',
      'hub.openCategories': 'Abrir categorías',
      'hub.rules': 'Reglas',
      'hub.pill.starsToday': '⭐ Estrellas hoy:',
      'hub.pill.gelatiWon': '🍨 GELATO ganados:',
      'hub.pill.quizCorrect': '🎯 Quizzes correctos:',

      'page.starsBadge': '⭐ Estrellas: {{count}}/{{total}}',

      'cockpit.eyebrow': 'Orbit cockpit',
      'cockpit.title': 'Panorama en vivo',
      'cockpit.sub': 'Desliza las tarjetas y mantente al día.',
      'cockpit.indicatorsAria': 'Indicadores de panorama',

      'cockpit.daily.eyebrow': 'Training',
      'cockpit.daily.badge': 'En vivo',
      'cockpit.daily.title': 'Training diario',
      'cockpit.daily.loading': 'Cargando la pregunta del día...',
      'cockpit.daily.hint': 'Abre una tarjeta, responde y gana estrellas extra.',

      'cockpit.perf.eyebrow': 'Hoy',
      'cockpit.perf.badge': 'Actualizado',
      'cockpit.perf.title': 'Rendimiento de hoy',
      'cockpit.stat.stars': 'Estrellas',
      'cockpit.stat.bonusPoints': 'Puntos bonus',
      'cockpit.stat.gelatiWon': 'GELATO ganados',
      'cockpit.stat.quizCorrect': 'Quizzes correctos',
      'cockpit.stat.quizWrong': 'Quizzes fallados',

      'cockpit.totals.eyebrow': 'Histórico',
      'cockpit.totals.badge': 'Total',
      'cockpit.totals.title': 'Totales',
      'cockpit.totals.stars': 'Estrellas totales',
      'cockpit.totals.gelati': 'GELATO totales',
      'cockpit.totals.bonus': 'Bonus total',

      'cockpit.wrong.eyebrow': 'Errores recientes',
      'cockpit.wrong.badge': 'Últimos 10',
      'cockpit.wrong.title': 'Errores recientes',
      'cockpit.wrong.empty': 'Sin errores recientes — ¡así se hace! ✨',
      'cockpit.wrong.viewAll': 'Ver todo',

      'cockpit.wrong.total': 'Total: {{count}}',
      'cockpit.wrong.reviewAria': 'Abrir revisión de error: {{title}}',

      'wrongLog.tip': 'Tip: si la lista es larguísima, usa la búsqueda. Los errores más antiguos por encima del límite (300 eventos) se descartan automáticamente.',
      'wrongLog.searchNoResults': 'No hay resultados para esta búsqueda.',

      'cockpit.history.eyebrow': 'Histórico de días',
      'cockpit.history.badge': '14 días',
      'cockpit.history.title': 'Histórico de días',
      'cockpit.history.empty': 'Aún no hay historial.',

      'cockpit.profile.eyebrow': 'Perfil',
      'cockpit.profile.badge': 'Tú',
      'cockpit.profile.title': 'Perfil',
      'cockpit.profile.nickname': 'Nickname',
      'cockpit.profile.gelato': 'Sabor de gelato favorito',
      'cockpit.profile.changeGelato': 'Cambiar sabor',
      'cockpit.profile.switchProfile': 'Cambiar perfil',

      'assistant.aria': 'Asistente BERNY',
      'assistant.eyebrow': 'Asistente',
      'assistant.title': 'Habla con BERNY',
      'assistant.sub': 'Pregunta por procedimientos, recetas y dónde encontrar una tarjeta. Te llevo al punto correcto.',
      'assistant.placeholder': 'Ej. Conos: ¿cuántos sabores y cuántos gramos?',
      'assistant.ariaInput': 'Habla con BERNY',
      'assistant.send': 'Preguntar',

      'mood.1': 'Coraje: cada servicio es un relato.',
      'mood.2': 'Brilla: los detalles marcan la diferencia.',
      'mood.3': 'Energía amable: sonríe y guía la experiencia.',
      'mood.4': 'Precisión hoy, excelencia mañana.',
      'mood.5': 'Sirve belleza: cuidado, ritmo, calidez humana.',
      'mood.6': 'Cada café es una promesa cumplida.',

      'tokens.stars': 'Estrellas',
      'tokens.stars.detailsAria': 'Detalles de estrellas',
      'tokens.progress': 'Progreso',
      'tokens.stars.text': 'Abre las pestañas dentro de una tarjeta: cada pestaña revela 1 cristal de azúcar. Cada {{perStar}} cristales (por tarjeta) se convierten en 1 estrella.',
      'tokens.stars.crystalsHint': 'Cristales: progreso por tarjeta (0/{{perStar}}). Si hay menos de {{perStar}} pestañas, completamos la diferencia al abrir la tarjeta de info.',
      'tokens.stars.miniHint': '3 estrellas = mini quiz (1 pregunta). Si aciertas desbloqueas “Test me”.',
      'tokens.rulesFull': 'Reglas completas',
      'tokens.testMe': 'Test me',
      'tokens.gelati': 'GELATO',
      'tokens.gelati.detailsAria': 'Detalles de GELATO',
      'tokens.gelati.text': 'Tres quizzes perfectos = un GELATO real para canjear con el trainer. El temporizador evita sprints consecutivos.',
      'tokens.cooldown': 'Cooldown',
      'tokens.seeRules': 'Ver reglas',
      'tokens.bonus': 'Bonus',
      'tokens.bonus.detailsAria': 'Detalles de puntos bonus',
      'tokens.bonus.text': '65 estrellas reinician el ciclo y asignan +{{points}} puntos bonus canjeables por cash o productos Badiani.',
      'tokens.howUnlock': 'Cómo se desbloquea',

      'game.mini.title': 'Cómo funciona el mini juego',
      'game.mini.text1': 'Abre las pestañas dentro de una tarjeta: cada pestaña = 1 cristal de azúcar. {{perStar}} cristales se convierten en 1 estrella (si hay menos de {{perStar}} pestañas, completamos los cristales en la última pestaña). Cada 3 estrellas se activa un mini quiz (1 pregunta).',
      'game.mini.text2': 'Mini quiz correcto = desbloqueas “Test me” (quiz más difícil). “Test me” perfecto = gelato añadido al contador y cuenta atrás de 24h (reducible con 12 y 30 estrellas). Mini quiz fallado = -3 estrellas. Reset automático: domingo a medianoche.',
      'game.mini.text3': 'Completando las 65 estrellas ganas puntos bonus reales para convertir en cash o productos Badiani.',
      'game.mini.ok': 'Ok, jugamos',

      'game.milestone.title.ready': 'Tres estrellas: ¡mini quiz desbloqueado!',
      'game.milestone.title.waiting': 'Tres estrellas: mini quiz (luego espera el cooldown)',
      'game.milestone.text.ready': 'Haz el mini quiz sobre lo que abriste: si respondes bien, desbloqueas “Test me” (el quiz difícil que asigna el gelato).',
      'game.milestone.text.waiting': 'Puedes hacer el mini quiz ahora. Si lo apruebas, desbloqueas “Test me”, pero podrás hacerlo solo cuando termine la cuenta atrás del gelato.',
      'game.milestone.hint': 'Cierra este aviso para iniciar el mini quiz.',
      'game.milestone.start': 'Iniciar mini quiz',
      'game.milestone.later': 'Más tarde',

      'game.bonus.title': '¡65 estrellas completadas!',
      'game.bonus.ok': 'Empezar de nuevo',

      'challenge.eyebrow': 'Desafío continuo',
      'challenge.hint': 'Responde ya: error = -3 estrellas.',
      'challenge.toast.lost': 'Desafío perdido: -3 estrellas. Revisa la especificación ahora.',
      'challenge.result.winTitle': 'Desafío superado',
      'challenge.result.loseTitle': 'Desafío perdido: -3 estrellas',
      'challenge.result.winText': '¡Genial! Conoces el playbook Badiani: sigue sumando estrellas sin perder ritmo.',
      'challenge.result.loseText': 'Sin pánico: abre nuevas tarjetas y vuelve al ciclo de estrellas.',
      'challenge.result.winBtn': 'Continuar',
      'challenge.result.loseBtn': 'Reintentar',

      'profile.gate.signup': 'Registro',
      'profile.gate.login': 'Acceder',
      'profile.gate.signupLead': 'Crea un nuevo perfil con tu nickname y sabor de gelato favorito.',
      'profile.gate.loginLead': 'Accede con tu nickname y sabor de gelato.',
      'profile.gate.nickname': 'Nickname',
      'profile.gate.nicknamePh': 'Ej. StellaRosa',
      'profile.gate.gelatoLabel': 'Sabor de gelato favorito',
      'profile.gate.gelatoPh': 'Ej. Buontalenti',
      'profile.gate.signupBtn': 'Registrarse',
      'profile.gate.loginBtn': 'Acceder',
      'profile.gate.deviceNote': 'Los datos se guardan solo en este dispositivo.',

      'profile.err.fillBothMin2': 'Completa ambos campos (mínimo 2 caracteres).',
      'profile.err.nicknameTaken': 'Este nickname ya está en uso. Elige otro.',
      'profile.err.fillBoth': 'Completa ambos campos.',
      'profile.err.notFound': 'Perfil no encontrado. Revisa nickname y sabor.',
      'profile.ok.signup': '¡Registro completado! Bienvenido/a {{name}}. Recargando...',
      'profile.ok.login': '¡Acceso correcto! Bienvenido/a de nuevo {{name}}. Recargando...',

      'profile.switch.title': 'Cambiar perfil',
      'profile.switch.text': '¿Quieres pasar a otro perfil? El progreso del perfil actual seguirá guardado.',
      'profile.switch.confirm': 'Sí, cambiar perfil',
      'profile.switch.button': 'Cambiar perfil',
    },

    fr: {
      'lang.label': 'Langue',
      'lang.it': 'Italiano',
      'lang.en': 'English',
      'lang.es': 'Español',
      'lang.fr': 'Français',

      'common.close': 'Fermer',
      'toast.copied': 'Copié dans le presse-papiers ✅',

      'quiz.generic': 'Quiz',
      'carousel.headerAria': 'Faites défiler le carrousel : glissez à gauche/droite ou cliquez (gauche=précédent, droite=suivant)',

      'card.procedure': 'Procédure',
      'card.checklist': 'Checklist',
      'card.rules': 'Règles',
      'card.table': 'Tableau',
      'card.routine': 'Routine',
      'card.deepCleanSteps': 'Étapes de nettoyage profond',
      'card.stepsTips': 'Étapes & conseils',
      'card.details': 'Détails',
      'card.use': 'Utilisation',
      'card.notes': 'Notes',

      'gelatoLab.hero.badge': 'Ligne de GELATO',
      'gelatoLab.hero.stars': '⭐ Étoiles : 8/8',
      'gelatoLab.hero.desc': 'Manuel du comptoir GELATO : portions, service à emporter, coupes “wow” et maintenance de la vitrine à -14/-15 °C.',
      'gelatoLab.carousel.products.category': 'Ligne de GELATO',
      'gelatoLab.ops.title': 'Mise en place & conservation',
      'gelatoLab.ops.category': 'Ouverture · Setup · Stockage · Scampoli · Fermeture',

      'gelatoLab.cards.cups.desc': 'Coupelles en trois tailles : Petit (1 parfum, 100 g), Moyen (1-2 parfums, 140 g), Grand (1-3 parfums, 180 g). La clé : doser correctement et bien compacter pour éliminer les bulles d\'air et garder une présentation uniforme.',
      'gelatoLab.cards.cups.stats': `<li>Pesée : Petit 100-120g, Moyen 160-200g, Grand 200-240g (toujours vérifier)</li><li>Technique : scoop linéaire + boule pour un look pro</li><li>Compactage : presser le GELATO contre le côté de la coupelle</li><li>Spatule : la chauffer sur le GELATO pour faciliter le service</li><li>Final : proposer wafer et chantilly (upselling)</li><li>Temp. idéale du GELATO : -14/-15°C (plus chaud = plus difficile à portionner)</li>`,
      'gelatoLab.cards.cups.details': `<div class="steps"><span>1 · Chauffe la spatule sur le parfum pour l\'assouplir.</span><span>2 · Presse le GELATO contre le côté de la coupelle pour enlever l\'air.</span><span>3 · Propose wafer/chantilly et souris.</span></div><div class="tips">Les enfants peuvent choisir deux parfums même en petit.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1 :</strong> "Passer au moyen ? Ajoute un parfum + chantilly"</span><span><strong>Option 2 :</strong> "J\'ajoute de la chantilly et un wafer croustillant ?"</span><span><strong>Option 3 :</strong> "Avec sauce pistache, c\'est encore plus gourmand"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Pèse toujours pour respecter la fourchette de grammes. Utilise “scoop linéaire + boule” pour un look pro. Temp. idéale du GELATO : -14/-15°C.</div>`,

      'gelatoLab.cards.cones.desc': 'Cornets en trois variantes : Classique (1 parfum), Chocolat ou Gluten Free (1-2 parfums). Envelopper chaque cornet avec un tissue pour la prise en main et la présentation. Garder la zone cornets propre pour éviter les contaminations.',
      'gelatoLab.cards.cones.stats': `<li>Envelopper : tissue toujours, pour grip et look</li><li>Portion : 1 boule pour cornet classique, 1-2 boules pour cornet spécial (choco/GF)</li><li>Placement : poser la boule en tournant le cornet</li><li>Propreté : toutes les 30 min enlever les miettes (humidité)</li><li>Rotation : FIFO strict (les cornets absorbent l\'humidité)</li><li>Upgrade : cornet chocolat (enrobé dedans/dehors), chantilly</li>`,
      'gelatoLab.cards.cones.details': `<div class="steps"><span>1 · Enveloppe le cornet avec un tissue.</span><span>2 · Prépare la boule et pose-la en tournant.</span><span>3 · Propose upgrade cornet choco ou chantilly.</span></div><div class="tips">Garde la zone cornets propre en retirant les miettes.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1 :</strong> "Upgrade cornet chocolat ? Enrobé dedans et dehors"</span><span><strong>Option 2 :</strong> "Cornet gluten-free disponible (si en stock)"</span><span><strong>Option 3 :</strong> "Ajouter de la chantilly pour un look Instagram ?"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Nettoie la zone cornets toutes les 30 min. FIFO strict : les cornets prennent l\'humidité. Toujours envelopper avec tissue.</div>`,

      'gelatoLab.cards.boxes.desc': 'GELATO à emporter en box isolées 500/750/1000 ml. Chaque box garde le GELATO en bon état ~1h dans le sac isotherme. Toujours rappeler au client de le mettre rapidement au freezer : le GELATO change de texture en fondant.',
      'gelatoLab.cards.boxes.stats': `<li>Petit : 500 ml (1-3 parfums)</li><li>Moyen : 750 ml (1-4 parfums)</li><li>Grand : 1000 ml (1-5 parfums)</li><li>Ordre : commencer par les parfums plus souples (sorbet d\'abord)</li><li>Compactage : enlever l\'air ; nettoyer les bords avant de sceller</li><li>Scellement : film + ruban Badiani, remettre dans sac isotherme</li><li>Autonomie : ~1h ; rappeler le freezer à la maison</li>`,
      'gelatoLab.cards.boxes.details': `<div class="steps"><span>1 · Ajouter les parfums en commençant par les plus souples (sorbet d\'abord).</span><span>2 · Compacter pour enlever l\'air et nettoyer les bords.</span><span>3 · Sceller avec film + ruban Badiani et mettre dans le sac.</span></div><div class="tips">Upsell : box plus grande + pack de 10 waffles ou cornets.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1 :</strong> "La box 1L te permet de tester plus de parfums"</span><span><strong>Option 2 :</strong> "On ajoute un pack de cornets pour servir à la maison ?"</span><span><strong>Option 3 :</strong> "Avec un sac isotherme, tout reste parfait jusqu\'à 2h"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Bien compacter pour éviter les cristaux. Nettoyer les bords avant de sceller. Autonomie ~1h : rappeler freezer ASAP.</div>`,

      'gelatoLab.cards.coppa.desc': 'Trois boules de GELATO en coupe en verre, avec chantilly, une sauce au choix, mini cornet et wafer Badiani. Option “wow” : monter dans l\'ordre et servir immédiatement pour garder la texture et un topping propre.',
      'gelatoLab.cards.coppa.stats': `<li>Base : coupe en verre</li><li>Portion : 3 scoops avec cuillère ronde (peut être 3 parfums)</li><li>Top : chantilly + swirl de sauce</li><li>Finition : mini cornet + wafer Badiani</li><li>Service : cuillère inox, service immédiat</li>`,
      'gelatoLab.cards.coppa.details': `<div class="steps"><span>1 · Prendre une coupe en verre et former 3 boules régulières.</span><span>2 · Ajouter la chantilly et un swirl de sauce (bord propre).</span><span>3 · Ajouter mini cornet + wafer Badiani, servir avec cuillère inox.</span></div><div class="tips">Proposer un pairing avec Slitti dragée pour un dessert complet.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Option 1 :</strong> "Ajouter crumble de noisette toastée + dragée Slitti ?"</span><span><strong>Option 2 :</strong> "Double sauce (pistache + chocolat) = signature"</span><span><strong>Option 3 :</strong> "Accord parfait : Coppa + espresso affogato style"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Utiliser des coupes froides. Boules uniformes. Servir tout de suite pour éviter que la chantilly fonde.</div>`,

      'gelatoLab.ops.displayPrep.title': 'Préparation vitrine (matin)',
      'gelatoLab.ops.displayPrep.desc': 'Nettoyer, polir et préparer avant d\'exposer. Exposer seulement quand la machine atteint -14/-15 °C.',
      'gelatoLab.ops.displayPrep.stats': `<li>Nettoyage : chiffon humide eau chaude + sanitiser jaune sur traces de GELATO</li><li>Métaux : blue spray + blue roll pour faire briller</li><li>Setup : placer barres, allumer, positionner bacs et sliding doors</li><li>Exposition : à -14/-15 °C, charger les parfums et fermer les sliding doors</li>`,
      'gelatoLab.ops.displayPrep.details': `<div class="steps"><span>1 · Nettoyer et polir (métaux et sliding doors).</span><span>2 · Allumer et placer barres + bacs.</span><span>3 · À -14/-15°C : exposer GELATO et fermer.</span></div><div class="tips">Vérifier d\'abord le scampoli freezer : si un parfum est récupérable, l\'utiliser correctement.</div>`,

      'gelatoLab.ops.tempDoors.title': 'Température & portes (standard)',
      'gelatoLab.ops.tempDoors.desc': 'Standard clé : vitrine à -14/-15 °C. Si le store n\'est pas busy, les sliding doors doivent être en place pour préserver la température.',
      'gelatoLab.ops.tempDoors.stats': `<li>Cible : -14/-15 °C (noter sur HACCP si nécessaire)</li><li>Portes : en position hors service actif</li><li>Outils : les spatules de nettoyage doivent être lavées et séchées avant d\'autres parfums</li>`,
      'gelatoLab.ops.tempDoors.details': `<div class="steps"><span>1 · Contrôler la température et noter selon standard local.</span><span>2 · Garder les sliding doors fermées entre services.</span><span>3 · Laver/sécher les outils après chaque nettoyage.</span></div>`,

      'gelatoLab.ops.treatsShelfLife.title': 'Shelf life treats (après exposition)',
      'gelatoLab.ops.treatsShelfLife.desc': 'Tableau rapide : jours max après exposition en vitrine treats.',
      'gelatoLab.ops.treatsShelfLife.stats': `<li>Cakes / Pinguinos / Mini semifreddo : 35 jours</li><li>Mini cakes / Mini cones : 21 jours</li><li>Cookies : 14 jours</li>`,
      'gelatoLab.ops.treatsShelfLife.details': `<div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">Shelf life une fois exposés</strong><span>Cakes / Pinguinos / Mini semifreddo : 35 jours</span><span>Mini cakes / Mini cones : 21 jours</span><span>Cookies : 14 jours</span></div>`,

      'gelatoLab.ops.treatFreezer.title': 'Gestion treat freezer',
      'gelatoLab.ops.treatFreezer.desc': 'Vitrine verticale à -14 °C, defrost hebdo, produits exposés avec gants.',
      'gelatoLab.ops.treatFreezer.stats': `<li>Placer cakes en haut, cookies/pinguinos en bas (à hauteur enfants)</li><li>Shelf life après exposition : cakes/pinguinos 35 jours, mini semifreddi 35, mini cakes 21, mini cones 21, cookies 14</li>`,
      'gelatoLab.ops.treatFreezer.details': `<div class="steps"><span>1 · Optimiser l\'espace, FIFO.</span><span>2 · Rappeler que ce sont des produits GELATO.</span><span>3 · Utiliser box isotherme (~1h) pour take-away.</span></div><div class="tips">Retrait de glace hebdo pour une visibilité impeccable.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💰 Upselling</strong><span><strong>Technique 1 :</strong> "Mettre les treats à hauteur enfants pour l\'impulse"</span><span><strong>Technique 2 :</strong> "Box mix pinguinos/cookies pour fêtes (selon tarif local)"</span><span><strong>Technique 3 :</strong> "Mini semifreddi : dessert parfait last-minute"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">🛠️ Pro tip:</strong> Garder -14°C constant. Retirer la glace chaque semaine avec une spatule plastique. Toujours utiliser des gants.</div>`,

      'gelatoLab.ops.scampolo.title': 'Règle Scampolo (1/4 pan)',
      'gelatoLab.ops.scampolo.desc': 'Quand un parfum a moins de 1/4 de bac, c\'est un scampolo à remplacer. Tu peux l\'intégrer petit à petit dans le bac neuf, sans dépasser 5–7 cm.',
      'gelatoLab.ops.scampolo.stats': `<li>Définition : &lt; 1/4 pan = scampolo</li><li>Ajout : ~100 g à la fois (env. un côté de scoop)</li><li>Limite : max 5–7 cm de scampolo total</li>`,
      'gelatoLab.ops.scampolo.details': `<div class="steps"><span>1 · Prendre le scampolo dans le scampoli freezer.</span><span>2 · Ajouter de petites quantités et lisser (ne doit pas “faire ajouté”).</span><span>3 · Ne pas dépasser 5–7 cm au total.</span></div><div class="tips">Scampolo = contrôle du gaspillage, tout en gardant le standard visuel.</div>`,

      'gelatoLab.ops.closeDeepClean.title': 'Fermeture & nettoyage profond (vitrine)',
      'gelatoLab.ops.closeDeepClean.desc': 'Routine : vitrine OFF chaque nuit. Nettoyage profond complet 1 fois/semaine, y compris les filtres.',
      'gelatoLab.ops.closeDeepClean.stats': `<li>Chaque soir : switch off + nettoyage quotidien</li><li>Hebdo : nettoyage profond + nettoyage filtres</li><li>Focus : enlever nuts/crumbs et désinfecter</li>`,
      'gelatoLab.ops.closeDeepClean.details': `<div class="steps"><span>1 · Retirer les panneaux du bas et nettoyer les traces de GELATO.</span><span>2 · Enlever nuts/crumbs ; spray désinfectant + chiffon sur toutes les surfaces.</span><span>3 · Blue spray + blue roll pour polir ; deep clean des label stands ; remonter et rallumer.</span></div><div class="tips">Sliding doors : si le store n\'est pas busy, les garder en position pour préserver la température.</div>`,

      'gelatoLab.footer.tagline': "L'art du GELATO florentin",
      'gelatoLab.footer.tempLabel': 'Temp. idéale',
      'gelatoLab.footer.heritageLabel': 'Héritage',

      'caffe.hero.badge': 'Bar & Drinks · 2025',
      'caffe.hero.stars': '⭐ Étoiles : 18/18',
      'caffe.hero.desc': 'Le guide complet des boissons Badiani : des classiques du café italien au nouveau Matcha Bar, en passant par les Smoothies et les boissons froides. Inclut les procédures de service à table et Take Away (TW).',

      'sweetTreats.hero.badge': 'Ligne desserts · 2025',
      'sweetTreats.hero.stars': '⭐ Étoiles : 13/13',
      'sweetTreats.hero.desc': 'Laboratoire digital pour crêpes, waffles, burger de GELATO et tea sets. Inclut grammes, shelf life, ordre d\'assemblage et mise en scène de service pour surprendre en boutique.',

      'sweetTreats.carousel.main.title': 'Sweet Crepes & Waffles',
      'sweetTreats.carousel.main.category': 'Tentations sucrées',

      'sweetTreats.cards.crepeSauce.desc': 'Crêpe classique servie avec une de nos sauces signature (Pistache, Noisette, Chocolat). Base parfaite pour toute addition.',
      'sweetTreats.cards.crepeSauce.stats': `<li><strong>Shelf life du mix :</strong> 3 jours (frigo)</li><li><strong>Repos :</strong> minimum 2 heures (frigo)</li><li><strong>Cuisson :</strong> 20s par côté</li>`,
      'sweetTreats.cards.crepeSauce.details': `<div class="steps"><span>1 · Étale le mix; retourne quand c'est doré.</span><span>2 · Étale la sauce sur la moitié, plie en demi-lune puis en éventail.</span><span>3 · Dresse, sucre glace et drizzle de sauce dessus.</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> La plaque doit être bien chaude sans fumer. La première est souvent un test.</div>`,

      'sweetTreats.cards.buontalentiCrepe.desc': 'Notre best seller : crêpe avec sauce au choix et un scoop de Buontalenti on top.',
      'sweetTreats.cards.buontalentiCrepe.stats': `<li><strong>GELATO :</strong> 1 scoop Buontalenti (70g)</li><li><strong>Sauce :</strong> 30g à l'intérieur + décoration</li><li><strong>Service :</strong> Assiette dessert avec couverts</li>`,
      'sweetTreats.cards.buontalentiCrepe.details': `<div class="steps"><span>1 · Prépare la crêpe sauce selon le standard.</span><span>2 · Plie en éventail et saupoudre de sucre glace.</span><span>3 · Pose le scoop de Buontalenti dessus et termine avec la sauce.</span></div><div class="tips">Ajoute le GELATO au tout dernier moment pour éviter qu'il fonde sur la crêpe chaude.</div>`,

      'sweetTreats.cards.waffles.desc': 'Waffle doré et croustillant dehors, moelleux dedans. Servi avec sauces, fruits ou GELATO.',
      'sweetTreats.cards.waffles.stats': `<li><strong>Cuisson :</strong> 2.5 min par côté (5 min total)</li><li><strong>Repos :</strong> 45s pour le croustillant</li><li><strong>Batter :</strong> 1 scoop (177ml)</li>`,
      'sweetTreats.cards.waffles.details': `<div class="steps"><span>1 · Verse le mix sur la plaque chaude et ferme.</span><span>2 · Cuis 2.5 min, retourne puis 2.5 min.</span><span>3 · Laisse reposer sur grille 45s avant de décorer.</span></div><div class="tips">Le repos est essentiel : servi tout de suite il devient mou.</div>`,

      'sweetTreats.cards.pancake.desc': 'Tour de 3 pancakes moelleux. Servis avec sirop d\'érable, fruits frais ou sauces Badiani.',
      'sweetTreats.cards.pancake.stats': `<li><strong>Portion :</strong> 3 pièces</li><li><strong>Cuisson :</strong> jusqu'à l'apparition de bulles</li><li><strong>Topping :</strong> généreux</li>`,
      'sweetTreats.cards.pancake.details': `<div class="steps"><span>1 · Verse 3 disques de pâte sur la plaque.</span><span>2 · Retourne quand les bulles apparaissent à la surface.</span><span>3 · Empile et décore généreusement.</span></div>`,

      'sweetTreats.cards.italianaPlain.desc': 'Mozzarella, roquette et tomates cerise sur base classique. Fraîche et légère.',
      'sweetTreats.cards.italianaPlain.stats': `<li><strong>Base :</strong> Classique</li><li><strong>Garniture :</strong> Mozzarella, roquette, tomates cerise</li><li><strong>Assaisonnement :</strong> Huile EVO, sel, origan</li>`,
      'sweetTreats.cards.italianaPlain.details': `<div class="steps"><span>1 · Cuis la crêpe et retourne.</span><span>2 · Ajoute la mozzarella et fais fondre légèrement.</span><span>3 · Ajoute roquette et tomates assaisonnées, plie en portefeuille.</span></div>`,

      'sweetTreats.cards.italianaBeetroot.desc': 'La version colorée : pâte à la betterave pour un look unique et une note douce-terreuse.',
      'sweetTreats.cards.italianaBeetroot.stats': `<li><strong>Base :</strong> Betterave</li><li><strong>Garniture :</strong> Mozzarella, roquette, tomates cerise</li><li><strong>Visuel :</strong> rouge/violet intense</li>`,
      'sweetTreats.cards.italianaBeetroot.details': `<div class="steps"><span>1 · Utilise le mix betterave (3g poudre pour 250g mix).</span><span>2 · Procède comme la classique Italiana.</span><span>3 · Le contraste de couleurs est la force : laisse la garniture visible.</span></div>`,

      'sweetTreats.cards.prosciuttoPlain.desc': 'Classique avec Prosciutto Crudo, mozzarella et roquette.',
      'sweetTreats.cards.prosciuttoPlain.stats': `<li><strong>Base :</strong> Classique</li><li><strong>Garniture :</strong> Crudo, mozzarella, roquette</li><li><strong>Service :</strong> chaude et filante</li>`,
      'sweetTreats.cards.prosciuttoPlain.details': `<div class="steps"><span>1 · Fais fondre la mozzarella pendant la cuisson.</span><span>2 · Ajoute le prosciutto en fin pour ne pas trop le cuire.</span><span>3 · Termine avec roquette et plie.</span></div>`,

      'sweetTreats.cards.prosciuttoBeetroot.desc': 'Prosciutto Crudo sur base betterave. Un twist moderne sur un classique.',
      'sweetTreats.cards.prosciuttoBeetroot.stats': `<li><strong>Base :</strong> Betterave</li><li><strong>Garniture :</strong> Crudo, mozzarella, roquette</li><li><strong>Goût :</strong> salé + doux (pâte)</li>`,
      'sweetTreats.cards.prosciuttoBeetroot.details': `<div class="steps"><span>1 · Prépare la base betterave.</span><span>2 · Garnis généreusement.</span><span>3 · Sers coupée en deux pour montrer les couches.</span></div>`,

      'sweetTreats.cards.gelatoBurger.desc': 'Un scoop de GELATO dans une brioche bun moelleuse, scellée à chaud en quelques secondes : effet “wow” et service rapide.',
      'sweetTreats.cards.gelatoBurger.stats': `<li><strong>Pain :</strong> brioche bun légèrement chauffée</li><li><strong>GELATO :</strong> 1 scoop (~70 g) au choix</li><li><strong>Sauce :</strong> 1 seul choix (standard)</li>`,
      'sweetTreats.cards.gelatoBurger.details': `<div class="steps"><span>1 · Chauffe légèrement la brioche (sans trop toaster).</span><span>2 · Ajoute un scoop de GELATO (~70 g) et termine avec une seule sauce.</span><span>3 · Ferme, sers tout de suite et conseille de manger comme un sandwich.</span></div>`,

      'sweetTreats.ops.title': 'Mise en place & conservation',
      'sweetTreats.ops.category': 'Ouverture · Réglages · Données techniques · Stockage · Fermeture',

      'sweetTreats.ops.opening.title': 'Checklist ouverture (stations)',
      'sweetTreats.ops.opening.desc': 'Avant le service, vérifie que les machines sont prêtes et que les mix/ingrédients sont en ordre. La Gelato Burger Machine doit être ON à l\'ouverture et OFF à la fermeture.',
      'sweetTreats.ops.opening.stats': `<li>Waffle machine : allume et attends les deux lumières vertes (READY + POWER)</li><li>Gelato Burger Machine : ON à l'ouverture ; généralement prête ~10 min après</li><li>Crepe mix : doit reposer au frigo au moins 2 heures avant utilisation</li>`,
      'sweetTreats.ops.opening.details': `<div class="steps"><span>1 · Allume les machines et confirme qu'elles sont en température/prêtes.</span><span>2 · Vérifie mix et stocks (labels, FIFO, dates).</span><span>3 · Prépare blue roll et bouteilles de sauce pour une station propre et rapide.</span></div><div class="tips">Objectif : zéro attente au premier ordre et stations déjà “service ready”.</div>`,

      'sweetTreats.ops.settings.title': 'Réglages machines (standard)',
      'sweetTreats.ops.settings.desc': 'Règle le standard avant le rush : moins d\'erreurs, moins de gaspillage et produits plus réguliers.',
      'sweetTreats.ops.settings.stats': `<li>Waffle : huile légère (huile neutre) ; power niveau 3 ; cuisson 2,5 min par côté (5 min total)</li><li>Waffle : repos 45s avant topping/GELATO (croustillant)</li><li>Gelato Burger : timer 12 secondes ; pas besoin d'huiler les plaques</li>`,
      'sweetTreats.ops.settings.details': `<div class="steps"><span>1 · Waffle : set power 3 et ne commence pas tant que READY + POWER ne sont pas allumés.</span><span>2 · Gelato Burger : set timer 12s et utilise seulement blue-roll pour gouttes/sauce.</span><span>3 · Surface toujours propre : miettes = baisse de qualité visuelle.</span></div><div class="tips">Pas d'huile sur la Gelato Burger machine : plaques non graissées.</div>`,

      'sweetTreats.ops.storage.title': 'Shelf life & stockage rapide',
      'sweetTreats.ops.storage.desc': 'Module “plus stockage que show” : contrôle toujours dates et conditions.',
      'sweetTreats.ops.storage.stats': `<li>Crepe mix : shelf life 3 jours (frigo) + repos minimum 2 heures (frigo)</li><li>Waffle mix (pre-packed) : shelf life 2 jours</li><li>Gelato Burger : shelf life bun une fois defrosted = 2 jours</li><li>Gelato Croissant : shelf life croissant plain = 2 jours</li>`,
      'sweetTreats.ops.storage.details': `<div class="steps"><span>1 · Étiquette avec date préparation/ouverture et expiration.</span><span>2 · FIFO strict : utiliser d'abord ce qui expire le plus tôt.</span><span>3 · Hors standard/sans label : ne pas servir.</span></div><div class="tips">Le stockage, c'est du training : constance = clients fidèles.</div>`,

      'sweetTreats.ops.portions.title': 'Portion & doses (quick ref)',
      'sweetTreats.ops.portions.desc': 'Référence comptoir : doses clés pour vitesse et standard.',
      'sweetTreats.ops.portions.stats': `<li>Waffle : 1 scoop complet de batter = 177 ml</li><li>Crepe : 1 scoop ou 1,5 petite louche de mix</li><li>Signature Buontalenti Crepe : Buontalenti 70 g + sauce top ~30 g</li><li>Gelato Burger : 1 scoop de GELATO = 70 g (un seul) + une seule sauce</li>`,
      'sweetTreats.ops.portions.details': `<div class="steps"><span>1 · Utilise des scoops dédiés : réduit les variations entre opérateurs.</span><span>2 · Si c'est hors standard, corrige tout de suite (ne “compense” pas).</span><span>3 · Note les erreurs récurrentes : ce sont des points training.</span></div>`,

      'sweetTreats.ops.closing.title': 'Fermeture & nettoyage rapide',
      'sweetTreats.ops.closing.desc': 'En fin de journée, réduit résidus et risques : sur la Gelato Burger Machine, utilise seulement blue-roll pour les gouttes de GELATO/sauce et pour enlever les miettes.',
      'sweetTreats.ops.closing.stats': `<li>Gelato Burger Machine : OFF à la fermeture ; surface sans résidus/particules</li><li>Waffle : enlève les résidus et prépare la station pour demain</li><li>Mix : remettre au frigo avec label (ou jeter si au-delà shelf life)</li>`,
      'sweetTreats.ops.closing.details': `<div class="steps"><span>1 · Éteins les machines et laisse refroidir en sécurité.</span><span>2 · Nettoie au blue-roll : pas d'huile sur les plaques Gelato Burger.</span><span>3 · Frigo + labels pour mix/ingrédients ; jette ce qui dépasse la shelf life.</span></div><div class="tips">Propre et sec aujourd'hui = ouverture plus rapide demain.</div>`,

      'sweetTreats.footer.tagline': 'Crepes, Waffles & More',
      'sweetTreats.footer.stat1.value': '10+ Variantes',
      'sweetTreats.footer.stat1.label': 'Menu',
      'sweetTreats.footer.stat2.value': 'Sweet & Savory',
      'sweetTreats.footer.stat2.label': 'Saveurs',

      'pastries.hero.badge': 'Pâtisserie comptoir',
      'pastries.hero.stars': '⭐ Étoiles : 6/6',
      'pastries.hero.desc': 'Toutes les références servies au comptoir : cakes, brownies, loaf, croissants garnis et scones avec un scoop de Buontalenti. Chaque fiche inclut shelf life, portions et scripts d\'upselling.',
      'pastries.hero.coverAlt': 'Cakes et brownies Badiani',

      'pastries.carousel.main.title': 'Pastry Lab',
      'pastries.carousel.main.category': 'Pâtisserie comptoir',

      'pastries.cards.cakes.alt': 'Part de gâteau Badiani',
      'pastries.cards.cakes.desc': 'Chocolate (3g), Carrot (2g), Walnut (3g) en respectant 14 parts par gâteau.',
      'pastries.cards.cakes.stats': `<li>Utilise le cake slicer comme guide</li><li>Serre sur assiette avec couverts</li><li>Upsell scoop Buontalenti + sauce</li>`,
      'pastries.cards.cakes.details': `<div class="steps"><span>1 → Place le cutter et marque 14 parts.</span><span>2 → Serre la part sur assiette et propose un pairing avec GELATO.</span><span>3 → Si l\'upsell passe, ajoute un scoop avec le milkshake scooper et un drizzle sur la part.</span></div><div class="tips">Rappel équipe : chocolat chaud + cake = combo premium.</div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="steps"><strong style="color: var(--brand-gold); display: block; margin-bottom: 8px;">💫 Upselling</strong><span><strong>Option 1:</strong> "On ajoute un scoop de Buontalenti sur la part ?"</span><span><strong>Option 2:</strong> "On met un drizzle de sauce pistache ou caramel ?"</span><span><strong>Option 3:</strong> "Combo parfaite ? Cake + chocolat chaud"</span></div><hr style="margin: 12px 0; border: none; border-top: 1px dashed rgba(33, 64, 152, 0.2);"><div class="tips"><strong style="color: var(--brand-rose);">✨ Pro tip:</strong> Garde les cakes couverts avec du film entre les coupes pour éviter qu\'ils sèchent. Temp. ambiante : max 2 heures hors frigo.</div>`,

      'pastries.cards.brownie.alt': 'Brownie Badiani',
      'pastries.cards.brownie.desc': 'Découpe 4×3 (12 pièces) et service sur assiette avec couverts.',
      'pastries.cards.brownie.stats': `<li>Display sur le tray dédié</li><li>Upsell GELATO + sauce</li><li>Communiquer la shelf life</li>`,
      'pastries.cards.brownie.details': `<div class="steps"><span>1 - Coupe 12 pièces égales, expose sur plateau.</span><span>2 - À la commande, dresse et propose un scoop Buontalenti.</span><span>3 - Drizzle sur le brownie et sur le GELATO.</span></div><div class="tips">Utilise le round scooper pour garder une portion régulière.</div>`,

      'pastries.cards.loaf.alt': 'Banana Loaf',
      'pastries.cards.loaf.desc': 'Chaque loaf doit donner 10 tranches. Service et upsell identiques aux cakes.',
      'pastries.cards.loaf.stats': `<li>Coupe des épaisseurs constantes</li><li>Serre avec couverts</li><li>Propose la sauce préférée</li>`,
      'pastries.cards.loaf.details': `<div class="steps"><span>1 - Coupe 10 slices égales, expose la première.</span><span>2 - Ajoute scoop + sauce si le client accepte.</span><span>3 - Garde le loaf emballé quand il n\'est pas utilisé.</span></div><div class="tips">Indique la shelf life sur la label pour faciliter les contrôles quotidiens.</div>`,

      'pastries.cards.croissants.alt': 'Croissant garni',
      'pastries.cards.croissants.desc': 'Croissant déjà laminé, à garnir avec la sauce demandée. Ouvre sur le côté, remplis et termine la présentation sur assiette avec fourchette et couteau. Pense à réchauffer légèrement les croissants de la veille pour raviver la fragrance.',
      'pastries.cards.croissants.stats': `<li>Shelf life : 2 jours depuis le defrost (vérifie la date)</li><li>Découpe : couteau dentelé, ouverture latérale à l\'horizontale</li><li>Garniture : poche à douille pour uniformité et précision</li><li>Présentation : sauce inside + drizzle dessus, assiette propre, couverts toujours</li><li>Réchauffage (si besoin) : 8–10 secondes seulement ; jamais plus de 15s (la garniture fond)</li>`,
      'pastries.cards.croissants.details': `<div class="steps"><span>1 - Incise le côté avec un couteau dentelé.</span><span>2 - Garnis l\'intérieur et le topping avec la même sauce.</span><span>3 - Dresse, ajoute les couverts et sers.</span></div><div class="tips">Rappelle shelf life et rotation : 2 jours depuis le defrost.</div>`,

      'pastries.cards.scone.alt': 'Scone garni de GELATO',
      'pastries.cards.scone.desc': 'Chauffe 15 s dans la gelato burger machine, garnis avec un scoop Buontalenti et sauce.',
      'pastries.cards.scone.stats': `<li>Coupe à l\'horizontale</li><li>Utilise le milkshake scooper</li><li>Finition pistache ou chocolat</li>`,
      'pastries.cards.scone.details': `<div class="steps"><span>1 - Chauffe 15 s.</span><span>2 - Coupe, ajoute le scoop et referme.</span><span>3 - Sauce top, dresse avec couverts.</span></div><div class="tips">Rappelle le contraste chaud/froid pour booster l\'upsell.</div>`,

      'pastries.ops.title': 'Setup & conservation',
      'pastries.ops.category': 'Ouverture · Données techniques · Shelf life · FIFO · Fermeture',

      'pastries.ops.display.alt': 'Vitrine pastry Badiani',
      'pastries.ops.display.desc': 'Objectif ouverture : vitrine pleine, ordonnée et lisible. Label toujours près du tray correct ; cakes sur cake stands avec une part retirée pour montrer l\'intérieur.',
      'pastries.ops.display.stats': `<li>CAKES: cake stands + retire 1 slice (visual intérieur)</li><li>CROISSANTS: trays dédiés (lignes propres)</li><li>BROWNIES/PUDDING/TARTS/SCONES: sur trays, alignés</li><li>LOAF: coupe et montre la première tranche sur le tray</li>`,
      'pastries.ops.display.details': `<div class="steps"><span>1 · Restaure un “full look” (sans trous visuels).</span><span>2 · Place les label près du bon tray (jamais génériques).</span><span>3 · Vérifie FIFO et shelf life avant le premier service.</span></div><div class="tips">Cohérence visuelle = ventes. Un comptoir “plein” donne envie.</div>`,

      'pastries.ops.cuts.desc': 'Portions constantes = qualité constante. Utilise toujours les mêmes découpes pour contrôler le food cost et travailler “en équipe”.',
      'pastries.ops.cuts.stats': `<li>Cake: cake slicer guide 14 parts</li><li>Brownie tray: découpe 4×3 = 12 pièces</li><li>Loaf: 10 slices par loaf</li>`,
      'pastries.ops.cuts.details': `<div class="steps"><span>1 · Utilise toujours le même outil guide (slicer / repère visuel).</span><span>2 · Si une portion est hors standard, corrige dès la coupe suivante.</span><span>3 · Lames propres : coupe nette = présentation premium.</span></div>`,

      'pastries.ops.shelf.desc': 'Liste shelf life pour contrôles quotidiens, rotation et labels correctes.',
      'pastries.ops.shelf.stats': `<li>Chocolate Cake: 3 jours</li><li>Carrot Cake: 2 jours</li><li>Walnut Cake: 3 jours</li><li>Brownie: 4 jours</li><li>Banana Loaf: 4 jours</li><li>Croissants: 2 jours</li><li>Scones: 2 jours</li>`,
      'pastries.ops.shelf.details': `<div class="steps"><span>1 · Label toujours : date defrost/ouverture + expiration.</span><span>2 · FIFO strict (first in, first out).</span><span>3 · En cas de doute : ne pas servir (demande au manager).</span></div>`,

      'pastries.ops.full.desc': 'Règle vitrine : elle doit toujours paraître pleine et ordonnée. Les label sont près du tray correct, toujours.',
      'pastries.ops.full.stats': `<li>Repositionne pour fermer les vides (sans mélanger les références)</li><li>Aligne les fronts : brownie/loaf/croissant toujours “en formation”</li><li>Vérifie que les label sont lisibles et cohérentes avec le tray</li>`,
      'pastries.ops.full.details': `<div class="steps"><span>1 · Refill et réaligne après chaque rush.</span><span>2 · Mets à jour les label quand le tray change (ne laisse jamais les “anciennes”).</span><span>3 · Vérifie les dates pendant les refills.</span></div><div class="tips">Visual merchandising = training : c\'est une skill, pas un détail.</div>`,

      'pastries.ops.close.desc': 'Objectif : remettre en ordre et préparer un départ rapide demain, sans perdre le contrôle de la shelf life.',
      'pastries.ops.close.stats': `<li>Retire miettes et résidus des trays (avant qu\'ils ne “collent”)</li><li>Groupe par référence et vérifie les dates (FIFO)</li><li>Vérifie que toutes les label sont présentes et correctes</li>`,
      'pastries.ops.close.details': `<div class="steps"><span>1 · Range par catégorie, vérifie les dates et jette ce qui dépasse la shelf life.</span><span>2 · Nettoie surfaces et trays ; sèche avant de fermer.</span><span>3 · Laisse le comptoir “opening-ready” : labels et layout déjà prêts.</span></div>`,

      'pastries.footer.tagline': 'Petit-déj & goûter',
      'pastries.footer.stat1.value': 'Quotidien',
      'pastries.footer.stat1.label': 'Fréquence',
      'pastries.footer.stat2.value': 'Frais',
      'pastries.footer.stat2.label': 'Qualité',

      'nav.menu': 'Menu',
      'nav.homeAria': 'Retour à l’accueil Badiani',
      'nav.profileAria': 'Profil utilisateur',
      'nav.profileLabel': 'Profil',

      'menu.cluster.orbit': 'Orbit',
      'menu.cluster.beverage': 'Boissons & douceurs',
      'menu.cluster.gelato': 'Gelato & spéciaux',

      'menu.link.hub': 'Hub',
      'menu.link.storyOrbit': 'Story Orbit',
      'menu.link.operations': 'Opérations & setup',
      'menu.link.caffe': 'Bar & boissons',
      'menu.link.sweetTreats': 'Sweet Treat Atelier',
      'menu.link.pastries': 'Pastry Lab',
      'menu.link.slittiYoyo': 'Slitti & Yo-Yo',
      'menu.link.gelatoLab': 'Gelato Lab',
      'menu.link.festive': 'Festive & Churros',

      'drawer.categories': 'Catégories',
      'drawer.close': 'Fermer le menu',

      'quizSolution.eyebrow': 'Quiz · Solution',
      'quizSolution.title': 'Revoir la bonne réponse',
      'quizSolution.loadingQuestion': 'Chargement de la question...',
      'quizSolution.loadingAnswer': 'Chargement de la bonne réponse...',
      'quizSolution.explainLabel': 'Explication :',
      'quizSolution.tipLabel': 'Astuce :',
      'quizSolution.backHub': '⬅ Retour au hub',
      'quizSolution.openSpecs': '📖 Ouvrir les spécifications',
      'quizSolution.back': '↩ Retour',
      'quizSolution.correctAnswerPrefix': 'Bonne réponse :',
      'quizSolution.openSuggestedCard': '📖 Ouvrir la fiche suggérée',
      'quizSolution.noQuestion': 'Aucune question reçue.',
      'quizSolution.retry': 'Retourne au quiz et réessaie.',

      'hub.badge': 'Training Orbit',
      'hub.eyebrow': 'Hub opérationnel · mis à jour chaque jour',
      'hub.title': 'Playbook opérationnel Badiani 1932',
      'hub.lede': 'Héritage florentin, rituels boutique et procédures digitalisées dans une seule console : consulte, révise et termine les quizzes pour échanger des GELATO réels.',
      'hub.openCategories': 'Ouvrir les catégories',
      'hub.rules': 'Règlement',
      'hub.pill.starsToday': '⭐ Étoiles aujourd’hui :',
      'hub.pill.gelatiWon': '🍨 GELATO gagnés :',
      'hub.pill.quizCorrect': '🎯 Quizzes réussis :',

      'page.starsBadge': '⭐ Étoiles : {{count}}/{{total}}',

      'cockpit.eyebrow': 'Orbit cockpit',
      'cockpit.title': 'Aperçu en direct',
      'cockpit.sub': 'Fais défiler les cartes et reste au top.',
      'cockpit.indicatorsAria': 'Indicateurs d’aperçu',

      'cockpit.daily.eyebrow': 'Training',
      'cockpit.daily.badge': 'Live',
      'cockpit.daily.title': 'Training quotidien',
      'cockpit.daily.loading': 'Chargement de la question du jour…',
      'cockpit.daily.hint': 'Ouvre une carte, réponds et gagne des étoiles en plus.',

      'cockpit.perf.eyebrow': 'Aujourd’hui',
      'cockpit.perf.badge': 'Mis à jour',
      'cockpit.perf.title': 'Performance du jour',
      'cockpit.stat.stars': 'Étoiles',
      'cockpit.stat.bonusPoints': 'Points bonus',
      'cockpit.stat.gelatiWon': 'GELATO gagnés',
      'cockpit.stat.quizCorrect': 'Quizzes réussis',
      'cockpit.stat.quizWrong': 'Quizzes ratés',

      'cockpit.totals.eyebrow': 'Historique',
      'cockpit.totals.badge': 'Total',
      'cockpit.totals.title': 'Totaux',
      'cockpit.totals.stars': 'Étoiles totales',
      'cockpit.totals.gelati': 'GELATO totaux',
      'cockpit.totals.bonus': 'Bonus total',

      'cockpit.wrong.eyebrow': 'Erreurs récentes',
      'cockpit.wrong.badge': '10 dernières',
      'cockpit.wrong.title': 'Erreurs récentes',
      'cockpit.wrong.empty': 'Aucune erreur récente — continue comme ça ! ✨',
      'cockpit.wrong.viewAll': 'Tout voir',

      'cockpit.wrong.total': 'Total : {{count}}',
      'cockpit.wrong.reviewAria': 'Ouvrir la révision d’erreur : {{title}}',

      'wrongLog.tip': 'Astuce : si la liste est très longue, utilisez la recherche. Les erreurs les plus anciennes au-delà de la limite (300 événements) sont supprimées automatiquement.',
      'wrongLog.searchNoResults': 'Aucun résultat pour cette recherche.',

      'cockpit.history.eyebrow': 'Historique des jours',
      'cockpit.history.badge': '14 jours',
      'cockpit.history.title': 'Historique des jours',
      'cockpit.history.empty': 'Pas encore d’historique.',

      'cockpit.profile.eyebrow': 'Profil',
      'cockpit.profile.badge': 'Toi',
      'cockpit.profile.title': 'Profil',
      'cockpit.profile.nickname': 'Nickname',
      'cockpit.profile.gelato': 'Parfum de gelato préféré',
      'cockpit.profile.changeGelato': 'Changer le parfum',
      'cockpit.profile.switchProfile': 'Changer de profil',

      'assistant.aria': 'Assistant BERNY',
      'assistant.eyebrow': 'Assistant',
      'assistant.title': 'Parle avec BERNY',
      'assistant.sub': 'Demande des procédures, des recettes et où trouver une carte. Je t’emmène au bon endroit.',
      'assistant.placeholder': 'Ex. Cornets : combien de parfums et combien de grammes ?',
      'assistant.ariaInput': 'Parle avec BERNY',
      'assistant.send': 'Demander',

      'mood.1': 'Courage : chaque service raconte une histoire.',
      'mood.2': 'Brille : les détails font la différence.',
      'mood.3': 'Énergie douce : souris et guide l’expérience.',
      'mood.4': 'Précision aujourd’hui, excellence demain.',
      'mood.5': 'Sers la beauté : soin, rythme, chaleur humaine.',
      'mood.6': 'Chaque café est une promesse tenue.',

      'tokens.stars': 'Étoiles',
      'tokens.stars.detailsAria': 'Détails des étoiles',
      'tokens.progress': 'Progrès',
      'tokens.stars.text': 'Ouvre les onglets dans une carte : chaque onglet révèle 1 cristal de sucre. Chaque {{perStar}} cristaux (par carte info) se transforment en 1 étoile.',
      'tokens.stars.crystalsHint': 'Cristaux : progression par carte (0/{{perStar}}). Si les onglets sont moins de {{perStar}}, on complète la différence à l\'ouverture de la carte info.',
      'tokens.stars.miniHint': '3 étoiles = mini quiz (1 question). Si c\'est juste tu débloques “Test me”.',
      'tokens.rulesFull': 'Règles complètes',
      'tokens.testMe': 'Test me',
      'tokens.gelati': 'GELATO',
      'tokens.gelati.detailsAria': 'Détails des GELATO',
      'tokens.gelati.text': 'Trois quizzes parfaits = un GELATO réel à échanger avec le trainer. Le timer empêche les sprints consécutifs.',
      'tokens.cooldown': 'Cooldown',
      'tokens.seeRules': 'Voir le règlement',
      'tokens.bonus': 'Bonus',
      'tokens.bonus.detailsAria': 'Détails des points bonus',
      'tokens.bonus.text': '65 étoiles réinitialisent la boucle et attribuent +{{points}} points bonus convertibles en cash ou produits Badiani.',
      'tokens.howUnlock': 'Comment débloquer',

      'game.mini.title': 'Comment fonctionne le mini jeu',
      'game.mini.text1': 'Ouvre les onglets dans une carte : chaque onglet = 1 cristal de sucre. {{perStar}} cristaux deviennent 1 étoile (si les onglets sont moins de {{perStar}}, on complète les cristaux au dernier onglet). Toutes les 3 étoiles, un mini quiz démarre (1 question).',
      'game.mini.text2': 'Mini quiz juste = tu débloques “Test me” (quiz plus difficile). “Test me” parfait = gelato ajouté au compteur et compte à rebours de 24h (réductible à 12 et 30 étoiles). Mini quiz faux = -3 étoiles. Reset automatique : dimanche à minuit.',
      'game.mini.text3': 'En complétant les 65 étoiles, tu gagnes des points bonus réels convertibles en cash ou produits Badiani.',
      'game.mini.ok': 'Ok, on joue',

      'game.milestone.title.ready': 'Trois étoiles : mini quiz débloqué !',
      'game.milestone.title.waiting': 'Trois étoiles : mini quiz (puis attendre le cooldown)',
      'game.milestone.text.ready': 'Fais le mini quiz sur ce que tu as ouvert : si tu réponds juste, tu débloques “Test me” (le quiz difficile qui attribue le gelato).',
      'game.milestone.text.waiting': 'Tu peux faire le mini quiz maintenant. Si tu réussis, tu débloques “Test me”, mais tu ne pourras le faire qu’à la fin du compte à rebours gelato.',
      'game.milestone.hint': 'Ferme cette notification pour lancer le mini quiz.',
      'game.milestone.start': 'Démarrer le mini quiz',
      'game.milestone.later': 'Plus tard',

      'game.bonus.title': '65 étoiles complétées !',
      'game.bonus.ok': 'Repartir de zéro',

      'challenge.eyebrow': 'Défi continu',
      'challenge.hint': 'Réponds tout de suite : erreur = -3 étoiles.',
      'challenge.toast.lost': 'Défi perdu : -3 étoiles. Relis la spécification tout de suite.',
      'challenge.result.winTitle': 'Défi réussi',
      'challenge.result.loseTitle': 'Défi perdu : -3 étoiles',
      'challenge.result.winText': 'Bravo ! Tu connais le playbook Badiani : continue à collecter des étoiles sans perdre le rythme.',
      'challenge.result.loseText': 'Pas de panique : ouvre de nouvelles cartes et reviens dans la boucle des étoiles.',
      'challenge.result.winBtn': 'Continuer',
      'challenge.result.loseBtn': 'Réessayer',

      'profile.gate.signup': 'Inscription',
      'profile.gate.login': 'Connexion',
      'profile.gate.signupLead': 'Crée un nouveau profil avec ton nickname et ton parfum de gelato préféré.',
      'profile.gate.loginLead': 'Connecte-toi avec ton nickname et ton parfum de gelato.',
      'profile.gate.nickname': 'Nickname',
      'profile.gate.nicknamePh': 'Ex. StellaRosa',
      'profile.gate.gelatoLabel': 'Parfum de gelato préféré',
      'profile.gate.gelatoPh': 'Ex. Buontalenti',
      'profile.gate.signupBtn': 'S’inscrire',
      'profile.gate.loginBtn': 'Se connecter',
      'profile.gate.deviceNote': 'Les données sont enregistrées uniquement sur cet appareil.',

      'profile.err.fillBothMin2': 'Renseigne les deux champs (au moins 2 caractères).',
      'profile.err.nicknameTaken': 'Ce nickname est déjà utilisé. Choisis-en un autre.',
      'profile.err.fillBoth': 'Renseigne les deux champs.',
      'profile.err.notFound': 'Profil introuvable. Vérifie le nickname et le parfum.',
      'profile.ok.signup': 'Inscription réussie ! Bienvenue {{name}}. Rechargement…',
      'profile.ok.login': 'Connexion réussie ! Bon retour {{name}}. Rechargement…',

      'profile.switch.title': 'Changer de profil',
      'profile.switch.text': 'Souhaites-tu passer à un autre profil ? La progression du profil actuel restera enregistrée.',
      'profile.switch.confirm': 'Oui, changer de profil',
      'profile.switch.button': 'Changer de profil',
    },
  };

  const template = (value, vars) => {
    let out = String(value ?? '');
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k]));
      });
    }
    return out;
  };

  const normalizeLang = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (SUPPORTED.includes(v)) return v;
    if (v.startsWith('en')) return 'en';
    if (v.startsWith('es')) return 'es';
    if (v.startsWith('fr')) return 'fr';
    if (v.startsWith('it')) return 'it';
    return '';
  };

  const getLang = () => {
    try {
      const stored = normalizeLang(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch {}

    try {
      const fromHtml = normalizeLang(document.documentElement.getAttribute('lang'));
      if (fromHtml) return fromHtml;
    } catch {}

    try {
      const nav = normalizeLang(navigator.language || navigator.userLanguage);
      if (nav) return nav;
    } catch {}

    return DEFAULT_LANG;
  };

  const t = (key, vars) => {
    const lang = getLang();
    const table = dict[lang] || dict[DEFAULT_LANG] || {};
    const fallback = (dict[DEFAULT_LANG] || {})[key];
    const raw = (table && table[key] != null) ? table[key] : (fallback != null ? fallback : key);
    return template(raw, vars);
  };

  const applyTranslations = (root = document) => {
    if (!root) return;
    const scope = root instanceof Element || root instanceof Document || root instanceof DocumentFragment ? root : document;

    // Text nodes
    scope.querySelectorAll?.('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!key) return;
      node.textContent = t(key);
    });

    // HTML nodes (trusted, internal)
    scope.querySelectorAll?.('[data-i18n-html]').forEach((node) => {
      const key = node.getAttribute('data-i18n-html');
      if (!key) return;
      node.innerHTML = t(key);
    });

    // Attributes
    scope.querySelectorAll?.('[data-i18n-attr]').forEach((node) => {
      const raw = node.getAttribute('data-i18n-attr');
      if (!raw) return;
      // format: "attr:key|attr2:key2"
      raw.split('|').map((s) => s.trim()).filter(Boolean).forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx <= 0) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;
        try { node.setAttribute(attr, t(key)); } catch {}
      });
    });

    updateLangUi(scope);
  };

  const updateLangUi = (root = document) => {
    const lang = getLang();

    // Current label
    root.querySelectorAll?.('[data-lang-current]').forEach((el) => {
      el.textContent = t(`lang.${lang}`);
    });

    // Options
    root.querySelectorAll?.('[data-lang-option]').forEach((btn) => {
      const opt = normalizeLang(btn.getAttribute('data-lang-option'));
      const active = opt === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
      // Translate button label, but keep language names native.
      btn.textContent = t(`lang.${opt}`);
    });

    // Label
    root.querySelectorAll?.('[data-lang-label]').forEach((el) => {
      el.textContent = t('lang.label');
    });
  };

  const setLang = (nextLang) => {
    const lang = normalizeLang(nextLang) || DEFAULT_LANG;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}

    try {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.dataset.lang = lang;
    } catch {}

    applyTranslations(document);

    try {
      document.dispatchEvent(new CustomEvent('badiani:lang-changed', { detail: { lang } }));
    } catch {}
  };

  const bindLanguageControls = (root = document) => {
    root.querySelectorAll?.('[data-lang-option]').forEach((btn) => {
      if (btn.dataset.langBound === 'true') return;
      btn.dataset.langBound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const opt = btn.getAttribute('data-lang-option');
        if (!opt) return;
        setLang(opt);
      });
    });
  };

  const startObserver = () => {
    try {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (!m.addedNodes || !m.addedNodes.length) continue;
          m.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            // Translate only if the subtree contains i18n markers.
            if (node.matches?.('[data-i18n],[data-i18n-html],[data-i18n-attr],[data-lang-option],[data-lang-current],[data-lang-label]')
              || node.querySelector?.('[data-i18n],[data-i18n-html],[data-i18n-attr],[data-lang-option],[data-lang-current],[data-lang-label]')) {
              bindLanguageControls(node);
              applyTranslations(node);
            }
          });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch {}
  };

  const init = () => {
    bindLanguageControls(document);
    setLang(getLang());
    startObserver();
  };

  // expose API
  window.BadianiI18n = {
    dict,
    t,
    getLang,
    setLang,
    applyTranslations,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
