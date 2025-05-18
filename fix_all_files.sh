#\!/bin/bash
# Script to fix malformed string literals in all TypeScript files
# Where closing backticks were replaced with double quotes

# Make backup directory
mkdir -p backups

# Find all TypeScript files in the src directory
FILES=$(find src -type f -name "*.ts")

# Counter for fixed files
FIXED_COUNT=0

# Process each file
for file in $FILES; do
  # Skip files that don't need fixing
  if \! grep -q '`.*\${.*}");' "$file" && \! grep -q '`.*");' "$file"; then
    continue
  fi
  
  # Make a backup of the original file
  cp "$file" "backups/$(basename "$file").bak"
  
  # Fix the two common patterns:
  # 1. Replace (`...${var}"); with (`...${var}`);
  sed -i '' 's/\(`[^`]*\${[^}]*}\)");/\1`);/g' "$file"
  
  # 2. Replace (`..."); with (`...`);
  sed -i '' 's/\(`[^`]*\)");/\1`);/g' "$file"
  
  # 3. Special edge case for strings with double quotes inside like: "...\"...\"");
  sed -i '' 's/\(`[^`]*\"[^\"]*\"[^`]*\)");/\1`);/g' "$file"

  echo "Fixed: $file"
  FIXED_COUNT=$((FIXED_COUNT + 1))
done

echo "Fixed $FIXED_COUNT files."
echo "Backups saved in ./backups directory"
