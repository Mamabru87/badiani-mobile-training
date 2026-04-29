"""Splice new operations carousel content into operations.html."""
import re

src = "operations.html"
new_content_path = "build-tools/_ops_new_content.html"

with open(src, "r", encoding="utf-8") as f:
    html = f.read()

with open(new_content_path, "r", encoding="utf-8") as f:
    new_block = f.read()

# Strip leading marker comment line from new_block
new_block = new_block.split("\n", 1)[1] if new_block.startswith("<!--") else new_block

# Find start: '      <section class="carousel" data-carousel="operations">'
start_marker = '      <section class="carousel" data-carousel="operations">'
start = html.find(start_marker)
assert start != -1, "start marker not found"

# Find end: the closing '      </div>' immediately followed by the footer
end_marker = '      <footer class="category-footer">'
end_idx = html.find(end_marker, start)
assert end_idx != -1, "end marker not found"

# Walk back to include the '      </div>\n\n' that closes hero-stack
# The structure is: ...</section>\n\n      </div>\n\n      <footer...
# We want to replace up to but NOT including the </div> that closes hero-stack? Actually new_block ends with '      </div>' so we should consume up through that closing </div>.
# Let's replace from start through the line before <footer.
# Easiest: find last occurrence of '      </div>' before <footer
chunk_before_footer = html[:end_idx]
# find last '      </div>'
last_div = chunk_before_footer.rfind("      </div>")
assert last_div > start, "div boundary not found"
# include trailing newline
end_replace = last_div + len("      </div>")
# preserve newlines after
trailing = html[end_replace:end_idx]  # whitespace/newlines

new_html = html[:start] + new_block.rstrip() + "\n" + trailing + html[end_idx:]

with open(src, "w", encoding="utf-8") as f:
    f.write(new_html)

print(f"Spliced. Old content removed: {end_replace - start} chars. New: {len(new_block)} chars.")
