#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open SVG Tester Report (Default Views)
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🧪
# @raycast.argument1 { "type": "text", "placeholder": "Branch" }

# Documentation:
# @raycast.author sophiamersmann
# @raycast.authorURL https://raycast.com/sophiamersmann

cd ~/code/owid/owid-grapher-svgs

git fetch && git checkout -f $1 && git reset --hard origin/$1 && git clean -fd

if test -f report_default-views.html; then
    open -a Google\ Chrome.app report_default-views.html
    echo "Report opened in Chrome"
else
    echo "No report found"
fi
