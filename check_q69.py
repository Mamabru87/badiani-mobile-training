
def check_q69(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.splitlines()
    q_count = 0
    current_q = ""
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        if line.startswith('Soluzione:'):
            if q_count == 69:
                print(f"Question at index 69 (sm-069): {current_q}")
            q_count += 1
            current_q = ""
        elif not line.startswith('A)') and not line.startswith('B)') and not line.startswith('C)') and not line.startswith('D)') and not line.startswith('Motivazione:'):
            current_q += line + " "

    print(f"Total questions found: {q_count}")

check_q69('q&a very-easy mode -italiano.txt')
