#!/usr/bin/env python3
"""
Parse the translated Q&A files and convert to i18n.js format.
Format expected:
  Question text
  A) Option 1
  B) Option 2
  C) Option 3
  D) Option 4
  Solution: X
  Explanation: ...
  
  [NEXT QUESTION]
"""

import re
import json

def parse_qa_file(filepath):
    """Parse a Q&A file and return list of questions with answers."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by double newlines to get question blocks
    blocks = [b.strip() for b in content.split('\n\n') if b.strip()]
    
    questions = []
    for block in blocks:
        lines = block.split('\n')
        if len(lines) < 6:  # Need at least Q + 4 options + answer + explanation
            continue
        
        # Parse question (first line)
        question = lines[0]
        
        # Parse options (lines with A) B) C) D))
        options = []
        answer_line_idx = -1
        for i, line in enumerate(lines[1:], 1):
            if line.startswith(('A)', 'B)', 'C)', 'D)')):
                # Extract option text (remove "A) " prefix)
                opt_text = re.sub(r'^[A-D]\)\s*', '', line).strip()
                options.append(opt_text)
            elif re.match(r'(Solution|Solución|Réponse)\s*:', line):
                answer_line_idx = i
                break
        
        if len(options) != 4 or answer_line_idx == -1:
            continue
        
        # Parse answer (A=0, B=1, C=2, D=3)
        answer_text = lines[answer_line_idx]
        answer_match = re.search(r'[A-D]', answer_text)
        if answer_match:
            answer_letter = answer_match.group(0)
            correct_idx = ord(answer_letter) - ord('A')
        else:
            continue
        
        # Parse explanation (line immediately after answer line, starting with Explication/Explicación/Explanation)
        explanation = ""
        if answer_line_idx + 1 < len(lines):
            next_line = lines[answer_line_idx + 1].strip()
            # Extract explanation text after "Explication: " or "Explicación: " or "Explanation: "
            explanation = re.sub(r'^(Explanation|Explicación|Explication)\s*:\s*', '', next_line)
        
        questions.append({
            'question': question,
            'options': options,
            'correct': correct_idx,
            'explain': explanation
        })
    
    return questions

# Parse all three files
print("Parsing English...")
en_questions = parse_qa_file('../q&a easy mode -english.txt')
print(f"  Found {len(en_questions)} questions")

print("Parsing Spanish...")
es_questions = parse_qa_file('../q&a easy mode -spanish.txt')
print(f"  Found {len(es_questions)} questions")

print("Parsing French...")
fr_questions = parse_qa_file('../q&a easy mode -french.txt')
print(f"  Found {len(fr_questions)} questions")

# Generate i18n format for each language
def generate_i18n_output(questions, language_code):
    """Generate i18n.js format for quiz questions."""
    output = []
    for idx, q in enumerate(questions, 1):
        qid = f"tm-{idx:03d}"
        output.append(f"      'quiz.q.{qid}.question': {json.dumps(q['question'])},")
        for opt_idx, opt in enumerate(q['options']):
            output.append(f"      'quiz.q.{qid}.option.{opt_idx}': {json.dumps(opt)},")
        output.append(f"      'quiz.q.{qid}.explain': {json.dumps(q['explain'])},")
        output.append("")  # Blank line for readability
    return '\n'.join(output)

# Generate outputs
print("\n=== GENERATING i18n OUTPUT ===")
en_i18n = generate_i18n_output(en_questions, 'en')
es_i18n = generate_i18n_output(es_questions, 'es')
fr_i18n = generate_i18n_output(fr_questions, 'fr')

# Save to files
with open('quiz_i18n_en.txt', 'w', encoding='utf-8') as f:
    f.write("// English quiz translations - add to i18n.js 'en' section\n")
    f.write(en_i18n)
    print(f"✅ Saved English translations to quiz_i18n_en.txt ({len(en_questions)} questions)")

with open('quiz_i18n_es.txt', 'w', encoding='utf-8') as f:
    f.write("// Spanish quiz translations - add to i18n.js 'es' section\n")
    f.write(es_i18n)
    print(f"✅ Saved Spanish translations to quiz_i18n_es.txt ({len(es_questions)} questions)")

with open('quiz_i18n_fr.txt', 'w', encoding='utf-8') as f:
    f.write("// French quiz translations - add to i18n.js 'fr' section\n")
    f.write(fr_i18n)
    print(f"✅ Saved French translations to quiz_i18n_fr.txt ({len(fr_questions)} questions)")

print("\nFiles ready to integrate into i18n.js!")
