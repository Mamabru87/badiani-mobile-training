#!/usr/bin/env python3
"""Count very-easy mode questions in all language files."""

import os

files = [
    r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -english.txt",
    r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -spanish.txt",
    r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -french.txt",
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Count solution lines (different patterns for different languages)
    en_count = content.count('\nSolution:')
    es_count = content.count('\nSolución:')
    fr_count = content.count('\nRéponse :')
    
    count = max(en_count, es_count, fr_count)  # Use whichever is greater
    lang = filepath.split(' -')[-1].replace('.txt', '')
    print(f"{lang}: {count} questions")
