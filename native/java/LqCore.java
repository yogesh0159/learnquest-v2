import java.util.*;
import java.util.regex.Pattern;

/**
 * LearnQuest engine core, Java port (for Android / desktop / backend reuse).
 * Same pure logic as frontend/js/game/jungle-run (native-reference.js, device-profile.js, adaptive-resolution.js).
 * GoldenTest proves every result is identical to the JavaScript reference (float32 buffers are float[], math is done in double).
 */
public final class LqCore {
    private LqCore() {}

    static final double TWO_PI = 6.283185307179586, INV_TWO_PI = 0.15915494309189535, PI = 3.141592653589793, HALF_PI = 1.5707963267948966;
    static final double C3 = -0.16666666666666666, C5 = 0.008333333333333333, C7 = -0.0001984126984126984, C9 = 2.7557319223985893e-06, C11 = -2.505210838544172e-08;
    static final int MAX_ITEMS = 128, MAX_OBSTACLES = 64, ITEM_STRIDE = 5, OBS_STRIDE = 6;

    public static double fastSin(double x) {
        x = x - TWO_PI * Math.floor(x * INV_TWO_PI + 0.5);
        if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
        double x2 = x * x;
        return x * (1.0 + x2 * (C3 + x2 * (C5 + x2 * (C7 + x2 * (C9 + x2 * C11)))));
    }

    /** xorshift32 -> [0,1) */
    public static final class Rng {
        private int s;
        public Rng(long seed) { int v = (int) (seed & 0xFFFFFFFFL); s = v != 0 ? v : (int) 2463534242L; }
        public double next() {
            int x = s;
            x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
            s = x;
            return (x & 0xFFFFFFFFL) / 4294967296.0;
        }
    }

    public static void ambientStep(float[] pos, float[] base, float[] seed, int n, double t, double dz, Rng rng) {
        for (int i = 0; i < n; i++) {
            double z = base[i * 3 + 2] + dz;
            if (z > 8.0) { z -= 78.0; base[i * 3] = (float) ((rng.next() - 0.5) * 34.0); }
            base[i * 3 + 2] = (float) z;
            double s = seed[i];
            pos[i * 3] = (float) (base[i * 3] + fastSin(t * 0.7 + s) * 0.6);
            pos[i * 3 + 1] = (float) (base[i * 3 + 1] + fastSin(t * 1.1 + s * 2.0) * 0.35);
            pos[i * 3 + 2] = (float) z;
        }
    }

    public static void fxStep(float[] pos, float[] col, float[] vel, float[] base, float[] life, float[] maxLife, int n, double dt, double dz) {
        for (int i = 0; i < n; i++) {
            if (life[i] <= 0) continue;
            life[i] = (float) (life[i] - dt);
            int j = i * 3;
            if (life[i] <= 0) { pos[j + 1] = -999.0f; continue; }
            vel[j + 1] = (float) (vel[j + 1] - 6.0 * dt);
            pos[j] = (float) (pos[j] + vel[j] * dt);
            pos[j + 1] = (float) (pos[j + 1] + vel[j + 1] * dt);
            pos[j + 2] = (float) (pos[j + 2] + (vel[j + 2] * dt + dz));
            double f = (double) life[i] / (double) maxLife[i];
            col[j] = (float) (base[j] * f); col[j + 1] = (float) (base[j + 1] * f); col[j + 2] = (float) (base[j + 2] * f);
        }
    }

    public static List<Integer> collideCollectibles(double[] items, int n, double px, double py, double height, double reachZ) {
        List<Integer> out = new ArrayList<>();
        for (int i = 0; i < n && i < MAX_ITEMS; i++) {
            int o = i * ITEM_STRIDE;
            if (items[o + 4] != 0) continue;
            boolean enigma = items[o + 3] != 0;
            double rx = enigma ? 0.95 : 0.75;
            if (Math.abs(items[o] - px) > rx) continue;
            if (Math.abs(items[o + 2]) > reachZ + (enigma ? 0.3 : 0.0)) continue;
            if (items[o + 1] < py - 0.35 || items[o + 1] > py + height + 0.35) continue;
            out.add(i);
        }
        return out;
    }

    public static int collideObstacle(double[] obs, int n, double px, double py, double halfW, double halfD, double height) {
        for (int i = 0; i < n && i < MAX_OBSTACLES; i++) {
            int o = i * OBS_STRIDE;
            if (Math.abs(obs[o] - px) > obs[o + 2] + halfW * 0.8) continue;
            if (Math.abs(obs[o + 1]) > obs[o + 3] + halfD) continue;
            if (py + height <= obs[o + 4] + 0.02 || py >= obs[o + 5] - 0.05) continue;
            return i;
        }
        return -1;
    }

    // ------------------------------------------------------------------ device analysis
    public static final String[] TIER_ORDER = {"minimal", "low", "balanced", "high", "ultra"};
    static double budget(String tier) {
        switch (tier) { case "ultra": return 3840.0 * 2160; case "high": return 2560.0 * 1440; case "low": return 1280.0 * 720; case "minimal": return 960.0 * 540; default: return 1920.0 * 1080; }
    }
    static final Pattern SOFTWARE = Pattern.compile("swiftshader|llvmpipe|software|microsoft basic");
    static final Pattern ENTRY = Pattern.compile("geforce\\s*(gt|gts|mx)\\s*\\d|\\bgt\\s?\\d{3,4}\\b|geforce\\s*(gtx\\s*)?[6-7]\\d{2}\\b|geforce\\s*(gtx\\s*)?10[0-3]0\\b|geforce\\s*(8|9)\\d{2}(m|mx)?\\b|quadro\\s*[kpmnv]?\\d{2,4}\\b|radeon\\s*(hd\\s*\\d{4}|r[2-5]\\b|r7\\s*2\\d{2})|nvidia\\s*nvs|geforce\\s*mx");
    static final Pattern DISCRETE = Pattern.compile("nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\\d|apple m\\d|apple gpu");
    static final Pattern INTEGRATED = Pattern.compile("intel|uhd|hd graphics|iris|mali|adreno|powervr|vega \\d|radeon\\(tm\\) graphics|radeon graphics|videocore");

    public static int tierIndex(String t) { return Arrays.asList(TIER_ORDER).indexOf(t); }
    public static String lowerOf(String a, String b) { return tierIndex(a) <= tierIndex(b) ? a : b; }
    public static String stepDown(String t) { return TIER_ORDER[Math.max(0, tierIndex(t) - 1)]; }

    public static String detectGpuClass(String renderer) {
        String s = renderer == null ? "" : renderer.toLowerCase(Locale.ROOT);
        if (SOFTWARE.matcher(s).find()) return "software";
        if (ENTRY.matcher(s).find()) return "entry";
        if (DISCRETE.matcher(s).find()) return "discrete";
        if (INTEGRATED.matcher(s).find()) return "integrated";
        return "unknown";
    }

    /** Device facts. Use null for unknown memory / cores / textures / battery. */
    public static final class Facts {
        public String gpu = ""; public double screenW = 0, screenH = 0, dpr = 1;
        public Double deviceMemory, cores, maxTexture; public boolean touch, mobile, saveData;
        public Boolean batteryCharging; public Double batteryLevel;
    }
    public static final class Analysis { public String gpuClass, cap, start; public long nativeW, nativeH; }

    public static Analysis analyseDevice(Facts f) {
        Analysis a = new Analysis();
        double dpr = f.dpr > 0 ? f.dpr : 1;
        double sw = f.screenW != 0 ? f.screenW : 1280, sh = f.screenH != 0 ? f.screenH : 720;
        a.nativeW = Math.round(sw * dpr); a.nativeH = Math.round(sh * dpr);
        String cls = detectGpuClass(f.gpu); a.gpuClass = cls;
        String cap, start;
        switch (cls) { case "software": cap = "low"; start = "low"; break; case "entry": cap = "balanced"; start = "balanced"; break; case "integrated": cap = "high"; start = "balanced"; break; case "discrete": cap = "ultra"; start = "high"; break; default: cap = "high"; start = "balanced"; }
        Double mem = (f.deviceMemory != null && f.deviceMemory != 0) ? f.deviceMemory : null;
        Double cores = (f.cores != null && f.cores != 0) ? f.cores : null;
        Double tex = (f.maxTexture != null && f.maxTexture != 0) ? f.maxTexture : null;
        if (mem != null) { if (mem <= 1) cap = lowerOf(cap, "minimal"); else if (mem <= 2) cap = lowerOf(cap, "low"); else if (mem <= 4) cap = lowerOf(cap, "balanced"); else if (mem <= 6) cap = lowerOf(cap, "high"); }
        if (cores != null) { if (cores <= 2) cap = lowerOf(cap, "low"); else if (cores <= 4) cap = lowerOf(cap, "high"); }
        if (tex != null) { if (tex < 4096) cap = lowerOf(cap, "low"); else if (tex < 8192) cap = lowerOf(cap, "high"); }
        if (f.touch || f.mobile) cap = lowerOf(cap, (mem != null && mem >= 6) ? "high" : "balanced");
        if (f.saveData) cap = lowerOf(cap, "balanced");
        if (f.batteryCharging != null && !f.batteryCharging && f.batteryLevel != null && f.batteryLevel < 0.2) cap = lowerOf(cap, stepDown(cap));
        a.cap = cap; a.start = lowerOf(start, cap);
        return a;
    }

    public static long[] renderSizeFor(String tier, double nw, double nh, double maxTexture) {
        double fit = Math.min(1.0, Math.sqrt(budget(tier) / Math.max(1, nw * nh)));
        fit = Math.min(fit, maxTexture / Math.max(nw, nh));
        return new long[] {Math.max(1, Math.round(nw * fit)), Math.max(1, Math.round(nh * fit))};
    }

    public static boolean passes(int frames, double avgFps, double p95Ms, double refreshHz) {
        double target = Math.min(refreshHz != 0 ? refreshHz : 60, 60);
        return frames >= 8 && avgFps >= target * 0.9 && p95Ms <= 26;
    }

    /** measure.apply(tier) -> {frames, avgFps, p95Ms} */
    public interface Measure { double[] apply(String tier); }
    public static final class Calibration { public String tier; public boolean conclusive; public List<String> probed = new ArrayList<>(); }

    public static Calibration calibrateTiers(String start, String cap, Measure measure, double refreshHz, int maxProbes) {
        Calibration out = new Calibration();
        int[] left = {maxProbes};
        List<boolean[]> probes = new ArrayList<>();      // {pass, conclusive}
        java.util.function.Function<String, boolean[]> run = tier -> {
            double[] m = measure.apply(tier); out.probed.add(tier);
            boolean[] r = {passes((int) m[0], m[1], m[2], refreshHz), m[0] >= 8};
            probes.add(r); left[0]--; return r;
        };
        int idx = tierIndex(lowerOf(start, cap)); Integer best = null;
        boolean[] p = run.apply(TIER_ORDER[idx]);
        if (!p[1]) { out.tier = lowerOf(start, cap); out.conclusive = false; return out; }
        if (p[0]) {
            best = idx;
            while (left[0] > 0 && idx < tierIndex(cap)) { idx++; p = run.apply(TIER_ORDER[idx]); if (!p[1] || !p[0]) break; best = idx; }
        } else {
            while (left[0] > 0 && idx > 0) { idx--; p = run.apply(TIER_ORDER[idx]); if (!p[1]) break; if (p[0]) { best = idx; break; } }
            if (best == null) { boolean anyInconclusive = false; for (boolean[] q : probes) if (!q[1]) anyInconclusive = true; best = anyInconclusive ? idx : 0; }
        }
        out.tier = TIER_ORDER[best != null ? best : idx]; out.conclusive = true;
        return out;
    }
}
