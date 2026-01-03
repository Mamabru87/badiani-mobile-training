
import re
import json

def find_missing_titles(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract the dictionary object
    # This is a bit hacky since it's JS, but we can look for keys
    # Pattern: 'key': 'value'
    pattern = re.compile(r"['\"]([^'\"]+)['\"]\s*:\s*[`'\"]", re.MULTILINE)
    keys = pattern.findall(content)

    # Group keys by language and prefix
    langs = ['it', 'en', 'es', 'fr']
    missing = {lang: [] for lang in langs}

    # We are interested in keys like <prefix>.(cards|ops).<id>.(desc|stats|details)
    # that don't have a corresponding .title
    
    for lang in langs:
        # Find all keys for this language
        # This is hard because the JS structure is nested
        # Let's just look for all keys that look like they should have a title
        
        # Actually, let's just look for all keys ending in .desc and check if .title exists
        desc_keys = [k for k in keys if k.endswith('.desc')]
        title_keys = set([k for k in keys if k.endswith('.title')])
        
        for dk in desc_keys:
            tk = dk.replace('.desc', '.title')
            if tk not in title_keys:
                missing[lang].append(tk)

    return missing

missing = find_missing_titles('scripts/i18n.js')
for lang, keys in missing.items():
    if keys:
        print(f"Missing in {lang}:")
        for k in keys:
            print(f"  {k}")
