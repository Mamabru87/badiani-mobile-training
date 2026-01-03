
const normalizeText = (value) => {
    const s = String(value ?? '').trim().toLowerCase();
    if (!s) return '';
    try {
      return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return s.replace(/\s+/g, ' ').trim();
    }
};

const hasWord = (needle, msgNorm) => {
    const n = String(needle || '').trim();
    if (!n) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return new RegExp(`\\b${esc}\\b`, 'i').test(msgNorm); } catch { return false; }
};

const scoreTitle = (title, userMessage) => {
    const msgNorm = normalizeText(userMessage);
    const t = normalizeText(title);
    const stop = new Set(['della','delle','degli','dello','dell','d','del','dei','di','da','a','al','allo','alla','alle','ai','il','lo','la','i','gli','le','un','uno','una','and','or','the','of','to','in','on','for']);

    let score = 0;
    // 1) Exact match or full substring (high confidence)
    if (msgNorm === t) {
        score += 15;
    } else if (msgNorm.includes(t)) {
        score += 12;
    } else if (t.includes(msgNorm) && msgNorm.length >= 4) {
        score += 10;
    }

    // 2) Token matching (word boundaries)
    const tokens = t.split(' ').filter(tok => tok.length >= 3 && !stop.has(tok));
    let hits = 0;
    for (const tok of tokens) {
        if (hasWord(tok, msgNorm) || (msgNorm.length >= 4 && tok.includes(msgNorm)) || (tok.length >= 4 && msgNorm.includes(tok))) {
            hits++;
            score += 4;
            console.log(`  Match token: ${tok}`);
        }
    }

    // 3) Bonus for matching more tokens
    if (hits > 0 && hits === tokens.length) {
        score += 5;
    }

    // 4) If user message is exactly one of the tokens (e.g. "Panettone")
    if (tokens.length > 1 && tokens.some(tok => tok === msgNorm)) {
        score += 8;
    }

    return score;
};

const titles = [
    "Smoothie Giallo Passion",
    "Smoothie Rosso Berry",
    "Smoothie Verde Boost"
];

const query = "smoothie berry";

console.log(`Query: "${query}"`);
titles.forEach(title => {
    console.log(`Title: "${title}"`);
    const score = scoreTitle(title, query);
    console.log(`Score: ${score}`);
    console.log('---');
});
