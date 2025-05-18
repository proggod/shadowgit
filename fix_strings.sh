#\!/bin/bash
# Script to fix malformed string literals in a single TypeScript file
# Usage: ./fix_strings.sh path/to/file.ts

if [ $# -ne 1 ]; then
  echo "Usage: $0 path/to/file.ts"
  exit 1
fi

FILE="$1"

if [ \! -f "$FILE" ]; then
  echo "Error: File $FILE not found"
  exit 1
fi

# Make a backup of the original file
cp "$FILE" "${FILE}.bak"

# Use a more direct approach with sed
sed -i '' 's/\${.*}");/&`);/g; s/");/`);/g' "$FILE"

echo "Fixed malformed string literals in $FILE"
echo "Original file backed up as ${FILE}.bak"
