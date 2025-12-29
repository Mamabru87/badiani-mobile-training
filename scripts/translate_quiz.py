#!/usr/bin/env python3
"""
Script to extract quiz questions from site.js and generate i18n translations.
Outputs JavaScript code ready to paste into i18n.js
"""
import re
import json

# Read the site.js file
with open('site.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the QUIZ_QUESTIONS array
match = re.search(r'const QUIZ_QUESTIONS = \[(.*?)\n  \];', content, re.DOTALL)
if not match:
    print("Could not find QUIZ_QUESTIONS array")
    exit(1)

quiz_text = match.group(1)

# Extract all questions - improved regex to handle multi-line
questions = []
# Split by question objects
parts = re.split(r'\n    \{', quiz_text)
for part in parts[1:]:  # Skip first empty part
    # Extract id
    id_match = re.search(r"id: '(tm-\d+)'", part)
    if not id_match:
        continue
    qid = id_match.group(1)
    
    # Extract question
    q_match = re.search(r"question: '([^']+(?:\\'[^']*)*)'", part)
    if not q_match:
        continue
    question = q_match.group(1).replace("\\'", "'")
    
    # Extract options
    opts_match = re.search(r"options: \[(.*?)\]", part, re.DOTALL)
    if not opts_match:
        continue
    opts_str = opts_match.group(1)
    options = re.findall(r"'([^']+(?:\\'[^']*)*)'", opts_str)
    options = [opt.replace("\\'", "'") for opt in options]
    
    # Extract correct
    correct_match = re.search(r"correct: (\d+)", part)
    correct_idx = int(correct_match.group(1)) if correct_match else 0
    
    # Extract explain
    exp_match = re.search(r"explain: '([^']+(?:\\'[^']*)*)'", part)
    explain = exp_match.group(1).replace("\\'", "'") if exp_match else ""
    
    questions.append({
        'id': qid,
        'question': question,
        'options': options,
        'correct': correct_idx,
        'explain': explain
    })

print(f"Extracted {len(questions)} questions\n")

# Generate i18n keys for Italian (to add to i18n.js)
print("// ============ QUIZ QUESTIONS - ADD TO ITALIAN SECTION ============")
for q in questions:
    print(f"      'quiz.q.{q['id']}.question': '{q['question']}',")
    for i, opt in enumerate(q['options']):
        print(f"      'quiz.q.{q['id']}.option.{i}': '{opt}',")
    print(f"      'quiz.q.{q['id']}.explain': '{q['explain']}',")

print(f"\n\n// Total: {len(questions)} questions with ~{len(questions)*7} translation keys")
print("// Copy the above to the 'it' section of i18n.js")
print("// Then translate manually or use a translation service for en/es/fr")

# Save JSON for easier translation
output = {'questions': questions}
with open('quiz_questions.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nSaved to quiz_questions.json for easier translation")

