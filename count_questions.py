
def count_questions(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by double newlines or look for "Soluzione:"
    blocks = content.split('Soluzione:')
    # The last block might not have a next question, but the split removes "Soluzione:"
    # Actually, let's split by question blocks.
    # A question block ends with "Motivazione: ... \n"
    
    import re
    # Pattern: Question text... A)... B)... C)... D)... Soluzione: X Motivazione: ...
    # We can just count the occurrences of "Soluzione:" which indicates a completed question block (mostly).
    
    count = 0
    questions = []
    
    # Split by "Motivazione:" to get blocks
    parts = content.split('Motivazione:')
    
    for i, part in enumerate(parts):
        if i == len(parts) - 1: continue # Last part is empty or just newline
        
        # The question text is at the beginning of the block (or after the previous Motivazione)
        # We can try to extract the question text.
        
        # Let's just print the index and a snippet of the question to identify sm-069
        # We need to reconstruct the question from the previous part's end?
        pass

    # Simpler approach: Read line by line and detect new questions
    lines = content.splitlines()
    q_count = 0
    current_q = ""
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        # If line starts with A) it's an option.
        # If line starts with Soluzione: it's solution.
        # If line starts with Motivazione: it's motivation.
        # If it's none of these and previous was Motivazione (or start of file), it's a new question.
        
        if line.startswith('Soluzione:'):
            q_count += 1
            # Check if this question is the one we are looking for
            if "Mini panettone in negozio" in current_q:
                print(f"FOUND 'Mini panettone in negozio' at index {q_count-1} (sm-{q_count-1:03d}?)")
            if "Mini stuffed panettone" in current_q:
                 print(f"FOUND 'Mini stuffed panettone' at index {q_count-1}")
            
            # Reset current_q for next iteration (though we capture lines before)
            current_q = ""
        elif not line.startswith('A)') and not line.startswith('B)') and not line.startswith('C)') and not line.startswith('D)') and not line.startswith('Motivazione:'):
            current_q += line + " "

    print(f"Total questions found: {q_count}")

count_questions('q&a very-easy mode -italiano.txt')
