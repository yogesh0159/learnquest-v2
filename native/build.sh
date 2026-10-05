#!/bin/sh
# Rebuilds frontend/wasm/lq_core.wasm from the C and C++ sources.  Needs clang >= 14 and wasm-ld (e.g. `apt install clang lld`).
# The compiled file is already included in the project, so you only need this when you change native/c or native/cpp.
set -e
cd "$(dirname "$0")"
FLAGS="--target=wasm32 -O3 -nostdlib -ffreestanding -fno-builtin -ffp-contract=off -fno-exceptions -fno-rtti -fvisibility=hidden"
mkdir -p build
clang   $FLAGS -std=c11   -c c/kernels.c     -o build/kernels.o
clang++ $FLAGS -std=c++17 -c cpp/collide.cpp -o build/collide.o
wasm-ld --no-entry --export-dynamic --initial-memory=1048576 --max-memory=1048576 -z stack-size=65536 build/kernels.o build/collide.o -o ../frontend/wasm/lq_core.wasm
ls -l ../frontend/wasm/lq_core.wasm
