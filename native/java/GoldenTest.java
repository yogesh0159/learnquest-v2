import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Checks LqCore against native/golden/golden.txt (written by the JavaScript reference).  javac -d out LqCore.java GoldenTest.java && java -cp out GoldenTest */
public class GoldenTest {
    static final Map<String, Integer> counts = new LinkedHashMap<>();
    static final List<String> fails = new ArrayList<>();
    static void check(String kind, boolean ok, String msg) { counts.merge(kind, 1, Integer::sum); if (!ok && fails.size() < 8) fails.add(kind + ": " + msg); }
    static double[] nums(String s) { s = s.trim(); if (s.isEmpty()) return new double[0]; String[] t = s.split("\\s+"); double[] d = new double[t.length]; for (int i = 0; i < t.length; i++) d[i] = Double.parseDouble(t[i]); return d; }
    static boolean same(float[] a, double[] b) { for (int i = 0; i < b.length; i++) if (!(a[i] == (float) b[i] || (Float.isNaN(a[i]) && Double.isNaN(b[i])))) return false; return true; }
    static Double nul(String s) { return s.equals("null") ? null : Double.valueOf(s); }

    public static void main(String[] args) throws Exception {
        Path p = Paths.get(args.length > 0 ? args[0] : "native/golden/golden.txt");
        for (String line : Files.readAllLines(p, StandardCharsets.UTF_8)) {
            String kind = line.split("[ \t]", 2)[0];
            switch (kind) {
                case "SIN": { String[] t = line.split(" "); check("SIN", LqCore.fastSin(Double.parseDouble(t[1])) == Double.parseDouble(t[2]), t[1]); break; }
                case "RNG": { String[] t = line.split(" "); LqCore.Rng r = new LqCore.Rng(Long.parseLong(t[1])); boolean ok = true; for (int i = 3; i < t.length; i++) if (r.next() != Double.parseDouble(t[i])) ok = false; check("RNG", ok, t[1]); break; }
                case "AMB": {
                    String[] s = line.split("\\|", -1); String[] h = s[0].trim().split(" "); int n = Integer.parseInt(h[1]), steps = Integer.parseInt(h[2]); long seed = Long.parseLong(h[3]); double t0 = Double.parseDouble(h[4]), dz = Double.parseDouble(h[5]);
                    double[] v = nums(s[1]); float[] pos = new float[n * 3], base = new float[n * 3], sd = new float[n];
                    for (int i = 0; i < n; i++) { base[i * 3] = (float) v[i * 4]; base[i * 3 + 1] = (float) v[i * 4 + 1]; base[i * 3 + 2] = (float) v[i * 4 + 2]; sd[i] = (float) v[i * 4 + 3]; }
                    LqCore.Rng r = new LqCore.Rng(seed); for (int k = 0; k < steps; k++) LqCore.ambientStep(pos, base, sd, n, k * 0.016 + t0, dz, r);
                    check("AMB", same(pos, nums(s[2])) && same(base, nums(s[3])), line.substring(0, 30)); break; }
                case "FX": {
                    String[] s = line.split("\\|", -1); String[] h = s[0].trim().split(" "); int n = Integer.parseInt(h[1]), steps = Integer.parseInt(h[2]); double dt = Double.parseDouble(h[3]), dz = Double.parseDouble(h[4]);
                    double[] v = nums(s[1]); float[] pos = new float[n * 3], col = new float[n * 3], vel = new float[n * 3], base = new float[n * 3], life = new float[n], ml = new float[n];
                    for (int i = 0; i < n; i++) { int o = i * 10; for (int k = 0; k < 3; k++) { pos[i * 3 + k] = (float) v[o + k]; vel[i * 3 + k] = (float) v[o + 3 + k]; base[i * 3 + k] = (float) v[o + 6 + k]; } life[i] = ml[i] = (float) v[o + 9]; }
                    for (int k = 0; k < steps; k++) LqCore.fxStep(pos, col, vel, base, life, ml, n, dt, dz);
                    check("FX", same(pos, nums(s[2])) && same(col, nums(s[3])) && same(life, nums(s[4])), line.substring(0, 30)); break; }
                case "COLL": {
                    String[] s = line.split("\\|", -1); String[] h = s[0].trim().split(" "); int n = Integer.parseInt(h[1]);
                    List<Integer> got = LqCore.collideCollectibles(nums(s[1]), n, Double.parseDouble(h[2]), Double.parseDouble(h[3]), Double.parseDouble(h[4]), Double.parseDouble(h[5]));
                    double[] e = nums(s[2]); boolean ok = (int) e[0] == got.size(); for (int i = 0; ok && i < got.size(); i++) if (got.get(i) != (int) e[i + 1]) ok = false; check("COLL", ok, line.substring(0, 30)); break; }
                case "OBS": {
                    String[] s = line.split("\\|", -1); String[] h = s[0].trim().split(" "); int n = Integer.parseInt(h[1]);
                    int got = LqCore.collideObstacle(nums(s[1]), n, Double.parseDouble(h[2]), Double.parseDouble(h[3]), Double.parseDouble(h[4]), Double.parseDouble(h[5]), Double.parseDouble(h[6]));
                    check("OBS", got == (int) nums(s[2])[0], line.substring(0, 30)); break; }
                case "DEVICE": {
                    String[] t = line.split("\t", -1); LqCore.Facts f = new LqCore.Facts();
                    f.gpu = t[1]; f.screenW = Double.parseDouble(t[2]); f.screenH = Double.parseDouble(t[3]); f.dpr = Double.parseDouble(t[4]); f.deviceMemory = nul(t[5]); f.cores = nul(t[6]); f.maxTexture = nul(t[7]);
                    f.touch = t[8].equals("1"); f.mobile = t[9].equals("1"); f.saveData = t[10].equals("1"); if (!t[11].equals("null")) { f.batteryCharging = t[11].equals("1"); f.batteryLevel = Double.valueOf(t[12]); }
                    LqCore.Analysis a = LqCore.analyseDevice(f);
                    check("DEVICE", a.gpuClass.equals(t[13]) && a.cap.equals(t[14]) && a.start.equals(t[15]) && a.nativeW == Long.parseLong(t[16]) && a.nativeH == Long.parseLong(t[17]), t[1] + " -> " + a.gpuClass + "/" + a.cap + "/" + a.start + " expected " + t[13] + "/" + t[14] + "/" + t[15]); break; }
                case "RSZ": { String[] t = line.split(" "); long[] r = LqCore.renderSizeFor(t[1], Double.parseDouble(t[2]), Double.parseDouble(t[3]), Double.parseDouble(t[4])); check("RSZ", r[0] == Long.parseLong(t[5]) && r[1] == Long.parseLong(t[6]), line); break; }
                case "PASS": { String[] t = line.split(" "); check("PASS", LqCore.passes(Integer.parseInt(t[1]), Double.parseDouble(t[2]), Double.parseDouble(t[3]), Double.parseDouble(t[4])) == t[5].equals("1"), line); break; }
                case "CAL": {
                    String[] s = line.split("\\|"); String[] t = s[0].trim().split(" "); Map<String, Double> fps = new HashMap<>(); for (int i = 0; i < 5; i++) fps.put(LqCore.TIER_ORDER[i], t[3 + i].equals("null") ? null : Double.valueOf(t[3 + i]));
                    LqCore.Calibration c = LqCore.calibrateTiers(t[1], t[2], tier -> { Double f = fps.get(tier); return f == null ? new double[] {0, 0, 0} : new double[] {60, f, f >= 55 ? 18 : 40}; }, 60, 5);
                    String[] e = s[1].trim().split(" "); check("CAL", c.tier.equals(e[0]) && (c.conclusive ? "1" : "0").equals(e[1]) && String.join(",", c.probed).equals(e[2]), s[0].trim() + " -> " + c.tier + " " + c.probed + " expected " + s[1].trim()); break; }
                default: break;
            }
        }
        int total = counts.values().stream().mapToInt(Integer::intValue).sum();
        System.out.println("Java port vs JavaScript reference: " + counts);
        if (!fails.isEmpty()) { System.out.println("FAILURES:"); fails.forEach(f -> System.out.println("   " + f)); System.exit(1); }
        System.out.println("OK - all " + total + " records identical");
    }
}
