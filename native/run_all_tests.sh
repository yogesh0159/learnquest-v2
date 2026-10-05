#!/bin/sh
# Runs every language against the same golden vectors:  JavaScript (reference) -> C / C++ (WebAssembly) -> Python -> Java.
set -e
cd "$(dirname "$0")/.."
echo "== JavaScript reference: regenerate golden vectors"; node native/golden/make_golden.mjs; node native/golden/make_golden_questions.mjs
echo "== C / C++ (WebAssembly) vs JavaScript"; node scripts/test-native-core.mjs | grep -E "tests passed|ambient|effect|collision"
echo "== Python"; python3 native/python/test_golden.py
if command -v javac >/dev/null 2>&1; then echo "== Java"; rm -rf native/java/out; javac -d native/java/out native/java/LqCore.java native/java/GoldenTest.java; java -cp native/java/out GoldenTest native/golden/golden.txt; else echo "== Java: javac not installed, skipped"; fi
