#!/usr/bin/env python3
"""
Parse very-easy mode files and generate correct answers for SUPER_EASY_QUESTIONS.
Output: Array of correct indexes for sm-001 to sm-100
"""

import re

def parse_correct_answers(filepath):
    """Parse a very-easy Q&A file and return list of correct indexes."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split into question blocks
    blocks = content.split('\n\n')
    
    correct_indexes = []
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        
        block_lines = block.split('\n')
        if len(block_lines) < 7:  # Need Q + 4 options + answer + motivation
            continue
        
        # Find the answer line (contains "Réponse :" or "Solution:" or "Solución:")
        for line in block_lines:
            if any(marker in line for marker in ['Réponse :', 'Solution:', 'Solución:']):
                # Extract the answer letter
                answer_part = line.split(':')[1].strip() if ':' in line else line
                answer_letter = answer_part.strip()
                # Convert A/B/C/D to 0/1/2/3
                answer_idx = ord(answer_letter) - ord('A')
                correct_indexes.append(answer_idx)
                break
    
    return correct_indexes

# Parse French file (use as reference - all languages have same structure)
filepath = r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\q&a very-easy mode -french.txt"
correct_indexes = parse_correct_answers(filepath)

print(f"// Parsed {len(correct_indexes)} questions")
print(f"const SM_CORRECT_ANSWERS = {correct_indexes};")
print()
print("// To use: SUPER_EASY_QUESTIONS[i].correct = SM_CORRECT_ANSWERS[i];")
