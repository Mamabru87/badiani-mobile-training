
import re

def normalize_text(value):
    s = str(value or '').strip().lower()
    if not s: return ''
    # Simple normalization for python
    s = s.replace("’", "'")
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def has_word(needle, msg_norm):
    n = str(needle or '').strip()
    if not n: return False
    esc = re.escape(n)
    try:
        return re.search(r'\b' + esc + r'\b', msg_norm, re.IGNORECASE) is not None
    except:
        return False

def score_title(title, user_message):
    msg_norm = normalize_text(user_message)
    t = normalize_text(title)
    stop = set(['della','delle','degli','dello','dell','d','del','dei','di','da','a','al','allo','alla','alle','ai','il','lo','la','i','gli','le','un','uno','una','and','or','the','of','to','in','on','for'])

    score = 0
    # 1) Exact match or full substring (high confidence)
    if msg_norm == t:
        score += 15
    elif t in msg_norm:
        score += 12
    elif msg_norm in t and len(msg_norm) >= 4:
        score += 10

    # 2) Token matching (word boundaries)
    tokens = [tok for tok in t.split(' ') if len(tok) >= 3 and tok not in stop]
    hits = 0
    for tok in tokens:
        if has_word(tok, msg_norm) or (len(msg_norm) >= 4 and msg_norm in tok) or (len(tok) >= 4 and tok in msg_norm):
            hits += 1
            score += 4
            print(f"  Match token: {tok}")

    # 3) Bonus for matching more tokens
    if hits > 0 and hits == len(tokens):
        score += 5

    # 4) If user message is exactly one of the tokens
    if len(tokens) > 1 and any(tok == msg_norm for tok in tokens):
        score += 8

    return score

titles = [
    "Smoothie Giallo Passion",
    "Smoothie Rosso Berry",
    "Smoothie Verde Boost"
]

query = "smoothie berry"

print(f'Query: "{query}"')
for title in titles:
    print(f'Title: "{title}"')
    score = score_title(title, query)
    print(f'Score: {score}')
    print('---')
