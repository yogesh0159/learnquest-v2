// LearnQuest native core, part 2 (C++): collision rules.
//
// Compiled to freestanding WebAssembly. Same rules, same double arithmetic and same order of tests as
// frontend/js/game/jungle-run/collision-manager.js / native-reference.js (checked for exact agreement on 200,000 random cases).
// Inputs are written by JavaScript into fixed buffers inside the module (Float64Array views); no allocation, no copies of results.
#define EXPORT(name) __attribute__((export_name(name)))

namespace lq {
using f64 = double;
constexpr int MAX_ITEMS = 128, MAX_OBSTACLES = 64;
constexpr int ITEM_STRIDE = 5;      // x, y, z, kind (0 coin, 1 enigma), collected (0/1)
constexpr int OBS_STRIDE = 6;       // x, z, halfX, halfZ, yBottom, yTop

static f64 items[MAX_ITEMS * ITEM_STRIDE];
static f64 obstacles[MAX_OBSTACLES * OBS_STRIDE];
static int hits[MAX_ITEMS];

template <typename T> constexpr T absval(T v) { return v < T(0) ? -v : v; }

// Which collectibles touch the player this frame?  Returns how many, indices in hits[].
static int collectibles(int n, f64 px, f64 py, f64 height, f64 reachZ) {
  int count = 0;
  for (int i = 0; i < n && i < MAX_ITEMS; i++) {
    const f64 *it = &items[i * ITEM_STRIDE];
    if (it[4] != 0.0) continue;                                   // already collected
    const bool enigma = it[3] != 0.0;
    const f64 rx = enigma ? 0.95 : 0.75;
    if (absval(it[0] - px) > rx) continue;                        // wrong lane
    if (absval(it[2]) > reachZ + (enigma ? 0.3 : 0.0)) continue;  // not at the player yet
    if (it[1] < py - 0.35 || it[1] > py + height + 0.35) continue; // above / below
    hits[count++] = i;
  }
  return count;
}

// First obstacle the player runs into, or -1.
static int obstacle(int n, f64 px, f64 py, f64 halfW, f64 halfD, f64 height) {
  for (int i = 0; i < n && i < MAX_OBSTACLES; i++) {
    const f64 *o = &obstacles[i * OBS_STRIDE];
    if (absval(o[0] - px) > o[2] + halfW * 0.8) continue;
    if (absval(o[1]) > o[3] + halfD) continue;
    if (py + height <= o[4] + 0.02 || py >= o[5] - 0.05) continue;  // passes under / jumps over
    return i;
  }
  return -1;
}
}  // namespace lq

extern "C" {
EXPORT("items_ptr")     double *items_ptr()     { return lq::items; }
EXPORT("obstacles_ptr") double *obstacles_ptr() { return lq::obstacles; }
EXPORT("hits_ptr")      int *hits_ptr()         { return lq::hits; }
EXPORT("collide_collectibles") int collide_collectibles(int n, double px, double py, double height, double reachZ) { return lq::collectibles(n, px, py, height, reachZ); }
EXPORT("collide_obstacle")     int collide_obstacle(int n, double px, double py, double halfW, double halfD, double height) { return lq::obstacle(n, px, py, halfW, halfD, height); }
}
