
def parse_italian_quiz_file(content, prefix):
    entries = {}
    # Split by double newlines (simulating JS split(/\n\s*\n/))
    import re
    blocks = re.split(r'\n\s*\n', content.strip())
    blocks = [b.strip() for b in blocks if b.strip()]

    for idx, block in enumerate(blocks):
        qid = f"{prefix}-{str(idx + 1).zfill(3)}"
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if not lines: continue

        question = lines[0]
        options = [''] * 4
        answer_idx = None
        explain = ''

        for line in lines[1:]:
            opt_match = re.match(r'^([A-D])\)\s*(.*)$', line)
            if opt_match:
                letter = opt_match.group(1)
                text = opt_match.group(2) or ''
                pos = {'A': 0, 'B': 1, 'C': 2, 'D': 3}.get(letter)
                if pos is not None:
                    options[pos] = text
                continue

            sol_match = re.match(r'^Soluzione:\s*([A-D])\b', line, re.IGNORECASE)
            if sol_match:
                letter = sol_match.group(1).upper()
                answer_idx = {'A': 0, 'B': 1, 'C': 2, 'D': 3}.get(letter)
                continue
            
            mot_match = re.match(r'^Motivazione:\s*(.+)$', line, re.IGNORECASE)
            if mot_match:
                explain = mot_match.group(1) or ''

        entries[f"quiz.q.{qid}.question"] = question
        for i, opt in enumerate(options):
            entries[f"quiz.q.{qid}.option.{i}"] = opt
        entries[f"quiz.q.{qid}.explain"] = explain
        if answer_idx is not None:
            entries[f"quiz.q.{qid}.correct"] = answer_idx
            
    return entries

with open('q&a very-easy mode -italiano.txt', 'r', encoding='utf-8') as f:
    content = f.read()

entries = parse_italian_quiz_file(content, 'sm')
print(f"sm-069 option 0: '{entries.get('quiz.q.sm-069.option.0')}'")
print(f"sm-069 option 1: '{entries.get('quiz.q.sm-069.option.1')}'")
print(f"sm-069 question: '{entries.get('quiz.q.sm-069.question')}'")
