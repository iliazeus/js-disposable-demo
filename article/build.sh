#!/bin/bash -E

{
  echo 'cat <<EOF'
  sed -e 's/[`\]/\\\0/g' -e 's/\$[^(]/\\\0/g' < ./article.template.md
  echo 'EOF'
} | bash > ./article.md
