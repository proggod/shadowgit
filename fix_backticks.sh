#\!/bin/bash
# Script to fix malformed string literals where backticks were replaced with double quotes
# Usage: ./fix_backticks.sh path/to/file.ts

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

# Replace "); with `); at the end of template literals
sed -i '' 's/\(`.*\)");/\1`);/g' "$FILE"

echo "Fixed malformed string literals in $FILE"
echo "Original file backed up as ${FILE}.bak"
