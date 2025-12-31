
import os

file_path = 'scripts/site.js'

# Read the file
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Define replacements for the remaining issues found via grep
replacements = [
    ('Vin Brul鿽', 'Vin Brulé'),
    ('Vin Brulée]', 'Vin Brulé'),
    ('Vin Brul\ufffd', 'Vin Brulé'), # Just in case
]

# Apply replacements
for old, new in replacements:
    content = content.replace(old, new)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Successfully updated {file_path}")
