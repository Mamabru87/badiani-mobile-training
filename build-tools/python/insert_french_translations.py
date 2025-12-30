#!/usr/bin/env python3
"""
Insert French translations into i18n.js at the correct location.
Safe insertion by splitting the operation into manageable parts.
"""

import os

# File paths
i18n_path = r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\scripts\i18n.js"
french_path = r"c:\Users\Mamabru\Documents\GitHub\Nuova cartella\badiani-mobile\scripts\quiz_i18n_fr.txt"

# Read the French translations (skip first line which is just a comment)
with open(french_path, 'r', encoding='utf-8') as f:
    french_lines = f.readlines()

# Skip the comment line and join the rest
french_content = ''.join(french_lines[1:]).rstrip()

# Read the entire i18n.js file
with open(i18n_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact insertion point: before the 'modal.tab.overview' key in the French section
# The line we're looking for is: '      'modal.tab.overview': 'Aperçu',"
# We need to find this AFTER the caffe.ops.closingMatchaBlender.details line

# Split by lines to find the exact location
lines = content.split('\n')

# Find the line number where 'modal.tab.overview' appears in the French section
insertion_line = -1
for i in range(len(lines) - 1, -1, -1):  # Search from bottom to top
    if "'modal.tab.overview': 'Aperçu'," in lines[i]:
        insertion_line = i
        break

if insertion_line == -1:
    print("ERROR: Could not find 'modal.tab.overview' key in French section")
    exit(1)

print(f"Found insertion point at line {insertion_line + 1}")
print(f"Line content: {lines[insertion_line][:80]}...")

# Insert the French content before this line
lines.insert(insertion_line, '')  # Add blank line before
lines.insert(insertion_line, french_content)

# Reconstruct the file
new_content = '\n'.join(lines)

# Write back
with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"✅ Successfully inserted {len(french_lines) - 1} lines of French translations")
print(f"File now has {len(new_content.split(chr(10)))} lines total")
print("Done!")
