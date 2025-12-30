#!/usr/bin/env python3
"""
Parse very-easy mode Q&A files and convert to i18n.js format.
Creates sm-001 to sm-100 question IDs.
"""

import re

def parse_veryeasy_file(filepath, lang_code):
    """Parse a very-easy Q&A file and return i18n format lines."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Determine the solution/answer marker based on language
    if lang_code == 'en':
        solution_marker = '\nSolution:'
        motivation_marker = '\nMotivation:'
    elif lang_code == 'es':
        solution_marker = '\nSolución:'
        motivation_marker = '\nMotivación:'
    elif lang_code == 'fr':
        solution_marker = '\nRéponse :'
        motivation_marker = '\nMotivation :'
    
    # Split into question blocks
    blocks = content.split('\n\n')
    
    lines = []
    q_num = 1
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        
        block_lines = block.split('\n')
        if len(block_lines) < 7:  # Need Q + 4 options + answer + motivation
            continue
        
        # Parse question (first line)
        question = block_lines[0].strip()
        
        # Parse options (lines starting with A) B) C) D))
        options = []
        answer_idx = -1
        
        for i, line in enumerate(block_lines[1:], 1):
            if re.match(r'^[A-D]\)', line):
                opt_text = re.sub(r'^[A-D]\)\s*', '', line).strip()
                options.append(opt_text)
            elif solution_marker.strip() in line:
                # Extract the answer letter
                answer_part = line.split(':')[1].strip() if ':' in line else line
                answer_letter = answer_part.strip()
                # Convert A/B/C/D to 0/1/2/3
                answer_idx = ord(answer_letter) - ord('A')
                break
        
        # Parse motivation/explanation
        explanation = ""
        for line in block_lines[1:]:
            if motivation_marker.strip() in line:
                explanation = line.split(':', 1)[1].strip()
                break
        
        if len(options) == 4 and answer_idx >= 0:
            # Build i18n lines
            q_id = f"sm-{q_num:03d}"
            
            # Escape special characters for JSON
            def escape_json(s):
                return s.replace('\\', '\\\\').replace('"', '\\"')
            
            lines.append(f"      'quiz.q.{q_id}.question': \"{escape_json(question)}\",")
            lines.append(f"      'quiz.q.{q_id}.option.0': \"{escape_json(options[0])}\",")
            lines.append(f"      'quiz.q.{q_id}.option.1': \"{escape_json(options[1])}\",")
            lines.append(f"      'quiz.q.{q_id}.option.2': \"{escape_json(options[2])}\",")
            lines.append(f"      'quiz.q.{q_id}.option.3': \"{escape_json(options[3])}\",")
            lines.append(f"      'quiz.q.{q_id}.explain': \"{escape_json(explanation)}\",")
            lines.append("")  # Blank line separator
            
            q_num += 1
    
    return lines

# Parse all three language files
en_lines = parse_veryeasy_file(
    r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -english.txt",
    'en'
)
es_lines = parse_veryeasy_file(
    r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -spanish.txt",
    'es'
)
fr_lines = parse_veryeasy_file(
    r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -french.txt",
    'fr'
)

# Write output files
with open(r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\scripts\quiz_i18n_sm_en.txt", 'w', encoding='utf-8') as f:
    f.write("// Super-easy (sm-) quiz translations - English\n")
    f.write('\n'.join(en_lines))

with open(r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\scripts\quiz_i18n_sm_es.txt", 'w', encoding='utf-8') as f:
    f.write("// Super-easy (sm-) quiz translations - Spanish\n")
    f.write('\n'.join(es_lines))

with open(r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\scripts\quiz_i18n_sm_fr.txt", 'w', encoding='utf-8') as f:
    f.write("// Super-easy (sm-) quiz translations - French\n")
    f.write('\n'.join(fr_lines))

print(f"✅ English: {len(en_lines)//7} questions parsed")
print(f"✅ Spanish: {len(es_lines)//7} questions parsed")
print(f"✅ French: {len(fr_lines)//7} questions parsed")
print("Files written:")
print("  - quiz_i18n_sm_en.txt")
print("  - quiz_i18n_sm_es.txt")
print("  - quiz_i18n_sm_fr.txt")
