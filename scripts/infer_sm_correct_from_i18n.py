#!/usr/bin/env python3
"""
Infer correct answers for SUPER_EASY_QUESTIONS from i18n.js translations.
Uses the explanation text to match against options.
"""

import re

def infer_correct(options, explain, qid):
    """Infer which option matches the explanation."""
    if not options or not explain:
        return None
    
    explain_lower = explain.lower()
    
    # Try to find strong matches
    best_idx = None
    best_score = 0
    
    for idx, opt in enumerate(options):
        if not opt:
            continue
        opt_lower = opt.lower()
        score = 0
        
        # Direct substring match (option appears in explanation)
        if len(opt_lower) > 10 and opt_lower in explain_lower:
            score += 10
        
        # Check for key phrases from option in explanation
        opt_words = set(re.findall(r'\b\w+\b', opt_lower))
        explain_words = set(re.findall(r'\b\w+\b', explain_lower))
        common_words = opt_words & explain_words
        # Filter out common words
        meaningful = common_words - {'the', 'a', 'an', 'is', 'are', 'with', 'of', 'to', 'in', 'on', 'for'}
        score += len(meaningful) * 2
        
        # Check for numeric matches
        numbers_in_opt = re.findall(r'\b\d+(?:[\.,]\d+)?\b', opt_lower)
        numbers_in_explain = re.findall(r'\b\d+(?:[\.,]\d+)?\b', explain_lower)
        
        if numbers_in_opt:
            for num in numbers_in_opt:
                if num in numbers_in_explain:
                    score += 5
        
        if score > best_score:
            best_score = score
            best_idx = idx
    
    return best_idx if best_score >= 3 else None

# Read i18n.js
with open('scripts/i18n.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all sm-XXX questions by searching for quiz.q.sm-XXX patterns
correct_answers = []

for i in range(1, 101):
    qid = f"sm-{i:03d}"
    
    # Find options - search anywhere in file
    options = []
    for opt_idx in range(4):
        pattern = rf"'quiz\.q\.{qid}\.option\.{opt_idx}':\s*['\"]([^'\"]+)['\"]"
        match = re.search(pattern, content)
        if match:
            options.append(match.group(1))
        else:
            options.append('')
    
    # Find explanation
    explain_pattern = rf"'quiz\.q\.{qid}\.explain':\s*\"([^\"]+)\""
    explain_match = re.search(explain_pattern, content)
    explain = explain_match.group(1) if explain_match else ''
    
    # Infer correct answer
    correct = infer_correct(options, explain, qid)
    
    if correct is None:
        print(f"// WARNING: Could not infer correct answer for {qid}")
        print(f"// Options: {options}")
        print(f"// Explain: {explain[:100]}...")
        correct = 0  # Default to first option
    
    correct_answers.append(correct)

# Output JavaScript array
print(f"\n// Inferred from i18n.js explanations")
print(f"const SM_CORRECT_ANSWERS = {correct_answers};")
