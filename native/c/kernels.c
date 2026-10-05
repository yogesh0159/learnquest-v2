/*
 * LearnQuest native core, part 1 (C): bulk particle kernels.
 *
 * Freestanding C (no libc) compiled to WebAssembly. The buffers live inside the module's memory, and JavaScript wraps
 * them as Float32Array views that three.js uses directly (BufferAttribute), so there is NO copying between JS and C.
 * Every operation mirrors frontend/js/game/jungle-run/native-reference.js step by step (same double-precision arithmetic,
 * same order, same constants), so the C and JS results are identical bit for bit. This is tested in scripts/test-native-core.mjs.
 */
typedef double f64;
typedef unsigned int u32;

#define EXPORT(name) __attribute__((export_name(name)))
#define AMB_MAX 256
#define FX_MAX 512

#define TWO_PI      6.283185307179586
#define INV_TWO_PI  0.15915494309189535
#define PI          3.141592653589793
#define HALF_PI     1.5707963267948966
#define C3  -0.16666666666666666
#define C5   0.008333333333333333
#define C7  -0.0001984126984126984
#define C9   2.7557319223985893e-06
#define C11 -2.505210838544172e-08

static float amb_pos[AMB_MAX * 3], amb_base[AMB_MAX * 3], amb_seed[AMB_MAX];
static float fx_pos[FX_MAX * 3], fx_col[FX_MAX * 3], fx_vel[FX_MAX * 3], fx_base[FX_MAX * 3], fx_life[FX_MAX], fx_maxlife[FX_MAX];
static u32 rng_state = 2463534242u;

/* Deterministic xorshift32 -> [0,1).  (JS uses the identical function.) */
static f64 rnd(void) {
  u32 x = rng_state;
  x ^= x << 13; x ^= x >> 17; x ^= x << 5;
  rng_state = x;
  return (f64)x / 4294967296.0;
}

/* Polynomial sine (max error ~6e-8), identical in JS: cheap and fully deterministic. */
static f64 fast_sin(f64 x) {
  x = x - TWO_PI * __builtin_floor(x * INV_TWO_PI + 0.5);
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
  f64 x2 = x * x;
  return x * (1.0 + x2 * (C3 + x2 * (C5 + x2 * (C7 + x2 * (C9 + x2 * C11)))));
}

EXPORT("amb_pos_ptr")  float *amb_pos_ptr(void)  { return amb_pos; }
EXPORT("amb_base_ptr") float *amb_base_ptr(void) { return amb_base; }
EXPORT("amb_seed_ptr") float *amb_seed_ptr(void) { return amb_seed; }
EXPORT("fx_pos_ptr")   float *fx_pos_ptr(void)   { return fx_pos; }
EXPORT("fx_col_ptr")   float *fx_col_ptr(void)   { return fx_col; }
EXPORT("fx_vel_ptr")   float *fx_vel_ptr(void)   { return fx_vel; }
EXPORT("fx_base_ptr")  float *fx_base_ptr(void)  { return fx_base; }
EXPORT("fx_life_ptr")  float *fx_life_ptr(void)  { return fx_life; }
EXPORT("fx_maxlife_ptr") float *fx_maxlife_ptr(void) { return fx_maxlife; }
EXPORT("rng_seed") void rng_seed(u32 s) { rng_state = s ? s : 2463534242u; }
EXPORT("fast_sin_export") f64 fast_sin_export(f64 x) { return fast_sin(x); }
EXPORT("rnd_export") f64 rnd_export(void) { return rnd(); }

/* Fireflies / pollen: drift with the world (dz), wrap behind the camera, sway with t. */
EXPORT("ambient_step")
void ambient_step(int n, f64 t, f64 dz) {
  for (int i = 0; i < n; i++) {
    f64 z = (f64)amb_base[i * 3 + 2] + dz;
    if (z > 8.0) { z -= 78.0; amb_base[i * 3] = (float)((rnd() - 0.5) * 34.0); }
    amb_base[i * 3 + 2] = (float)z;
    f64 s = (f64)amb_seed[i];
    amb_pos[i * 3]     = (float)((f64)amb_base[i * 3] + fast_sin(t * 0.7 + s) * 0.6);
    amb_pos[i * 3 + 1] = (float)((f64)amb_base[i * 3 + 1] + fast_sin(t * 1.1 + s * 2.0) * 0.35);
    amb_pos[i * 3 + 2] = (float)z;
  }
}

/* Sparkles / bursts / trails: gravity, motion with the world (dz), fade by remaining life. */
EXPORT("fx_step")
void fx_step(int n, f64 dt, f64 dz) {
  for (int i = 0; i < n; i++) {
    if (fx_life[i] <= 0.0f) continue;
    fx_life[i] = (float)((f64)fx_life[i] - dt);
    int j = i * 3;
    if (fx_life[i] <= 0.0f) { fx_pos[j + 1] = -999.0f; continue; }
    fx_vel[j + 1] = (float)((f64)fx_vel[j + 1] - 6.0 * dt);
    fx_pos[j]     = (float)((f64)fx_pos[j] + (f64)fx_vel[j] * dt);
    fx_pos[j + 1] = (float)((f64)fx_pos[j + 1] + (f64)fx_vel[j + 1] * dt);
    fx_pos[j + 2] = (float)((f64)fx_pos[j + 2] + ((f64)fx_vel[j + 2] * dt + dz));
    f64 f = (f64)fx_life[i] / (f64)fx_maxlife[i];
    fx_col[j]     = (float)((f64)fx_base[j] * f);
    fx_col[j + 1] = (float)((f64)fx_base[j + 1] * f);
    fx_col[j + 2] = (float)((f64)fx_base[j + 2] * f);
  }
}
