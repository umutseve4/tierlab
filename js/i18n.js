// Tiny i18n: t("key", {var}) with TR / EN dictionaries.
const DICT = {
  en: {
    tagline: "Rank anything. Smarter.",
    heroTitle: "Tier lists that think back.",
    heroSub: "Drag & drop, let the This-or-That duel rank for you, auto-tier from real stats, then see how hot your takes really are.",
    explore: "Explore topics", newList: "Create your own", all: "All",
    customTitle: "Create a custom list", titlePh: "Title (e.g. Best pizza toppings)",
    linesPh: "One item per line. Optional image:\nPepperoni | https://example.com/pep.jpg\nMushroom\nPineapple",
    preset: "Tier style", create: "Create", cancel: "Cancel",
    board: "Board", duel: "This or That", auto: "Auto-tier", compare: "Compare",
    pool: "Unranked", poolHint: "Drag items into tiers — or tap an item, then tap a tier. Keys 1–9 place the selected item, 0 sends it back.",
    share: "Share link", png: "Download PNG", reset: "Reset", shuffle: "Shuffle", undo: "Undo",
    exportJson: "Export JSON", importJson: "Import JSON", addItem: "Add item", addItemPh: "Name (| image URL optional)",
    addTier: "+ Tier", tierLabel: "Tier label", del: "Delete", home: "All topics",
    copied: "Link copied!", copyFail: "Copy this link:", saved: "Saved locally",
    resetConfirm: "Move every item back to Unranked?",
    duelIntro: "Answer quick head-to-heads. A binary insertion sort ranks {n} items in about {q} questions instead of {all}.",
    duelStart: "Start the duel", which: "Which is better?", tie: "Equal", skip: "Stop & use partial",
    asked: "{a} asked · ~{r} left", shape: "Tier shape", pyramid: "Pyramid (elite top)", balanced: "Balanced", bell: "Bell curve",
    duelDone: "Done! Your ranking:", applyBoard: "Apply to board", restart: "Restart",
    autoIntro: "Weight the stats you care about. Items are normalized, combined into a 0–100 score, then split by natural breaks (Jenks) — tiers form where the real gaps are.",
    noStats: "This topic has no stats. Auto-tier works with data topics like NBA Greats or Planets.",
    normalize: "Normalization", minmax: "Min–max", rank: "Percentile rank", log: "Logarithmic",
    breaks: "Tier breaks", jenks: "Natural breaks (Jenks)", equal: "Equal-sized", score: "Score", source: "Source",
    compareIntro: "How close is your list to the reference — and where are your hottest takes?",
    vsRef: "vs. TierLab's take", vsLink: "vs. a friend's link", pastePh: "Paste a TierLab share link",
    agreement: "Agreement", spearman: "Rank correlation (Spearman ρ)", hotTakes: "Your hottest takes",
    youHigher: "You rate it higher", youLower: "You rate it lower", same: "Same tier",
    placeMore: "Place at least 3 items that also exist in the reference to compare.",
    noRef: "This list has no reference. Compare with a friend's link instead.",
    p0: "🧊 NPC energy — you agree with everyone.", p1: "🙂 Reasonable human.", p2: "🌶️ Spicy — you have opinions.",
    p3: "🔥 Contrarian — the comments will be wild.", p4: "☢️ Chaos agent. Respect.",
    items: "items", tiers: "tiers", wiki: "Wikipedia",
    loadFail: "Could not open that link.", footer: "Static site · no tracking · your lists stay in your browser and your links.",
  },
  tr: {
    tagline: "Her şeyi sırala. Daha akıllıca.",
    heroTitle: "Sana karşılık veren tier listler.",
    heroSub: "Sürükle-bırak yap, \"Bu mu O mu\" düellosu senin yerine sıralasın, gerçek istatistiklerden otomatik tier çıkar, sonra fikirlerin ne kadar \"aykırı\" gör.",
    explore: "Konuları keşfet", newList: "Kendi listeni yap", all: "Hepsi",
    customTitle: "Özel liste oluştur", titlePh: "Başlık (ör. En iyi pizza malzemeleri)",
    linesPh: "Her satıra bir öğe. İsteğe bağlı görsel:\nSucuk | https://ornek.com/sucuk.jpg\nMantar\nAnanas",
    preset: "Tier stili", create: "Oluştur", cancel: "Vazgeç",
    board: "Tahta", duel: "Bu mu O mu", auto: "Otomatik", compare: "Karşılaştır",
    pool: "Sıralanmamış", poolHint: "Öğeleri tierlara sürükle — ya da bir öğeye dokun, sonra bir tiera dokun. 1–9 tuşları seçili öğeyi yerleştirir, 0 geri gönderir.",
    share: "Link paylaş", png: "PNG indir", reset: "Sıfırla", shuffle: "Karıştır", undo: "Geri al",
    exportJson: "JSON dışa aktar", importJson: "JSON içe aktar", addItem: "Öğe ekle", addItemPh: "İsim (| görsel URL isteğe bağlı)",
    addTier: "+ Tier", tierLabel: "Tier adı", del: "Sil", home: "Tüm konular",
    copied: "Link kopyalandı!", copyFail: "Bu linki kopyala:", saved: "Tarayıcıya kaydedildi",
    resetConfirm: "Tüm öğeler Sıralanmamış'a dönsün mü?",
    duelIntro: "Hızlı ikili sorulara cevap ver. İkili eklemeli sıralama {n} öğeyi {all} yerine yaklaşık {q} soruda sıralar.",
    duelStart: "Düelloyu başlat", which: "Hangisi daha iyi?", tie: "Eşit", skip: "Durdur & bu kadarını kullan",
    asked: "{a} soru · ~{r} kaldı", shape: "Tier dağılımı", pyramid: "Piramit (zirve seçkin)", balanced: "Dengeli", bell: "Çan eğrisi",
    duelDone: "Bitti! Senin sıralaman:", applyBoard: "Tahtaya uygula", restart: "Yeniden başla",
    autoIntro: "Önem verdiğin istatistikleri ağırlıklandır. Değerler normalize edilir, 0–100 skora birleştirilir ve doğal kırılmalarla (Jenks) bölünür — tierlar gerçek boşlukların olduğu yerde oluşur.",
    noStats: "Bu konuda istatistik yok. Otomatik mod NBA veya Gezegenler gibi veri konularında çalışır.",
    normalize: "Normalizasyon", minmax: "Min–max", rank: "Yüzdelik sıra", log: "Logaritmik",
    breaks: "Tier sınırları", jenks: "Doğal kırılma (Jenks)", equal: "Eşit boyutlu", score: "Skor", source: "Kaynak",
    compareIntro: "Listen referansa ne kadar yakın — ve en aykırı fikirlerin neler?",
    vsRef: "TierLab'in görüşüne karşı", vsLink: "Arkadaşının linkine karşı", pastePh: "Bir TierLab paylaşım linki yapıştır",
    agreement: "Uyum", spearman: "Sıra korelasyonu (Spearman ρ)", hotTakes: "En aykırı fikirlerin",
    youHigher: "Sen daha yükseğe koymuşsun", youLower: "Sen daha aşağı koymuşsun", same: "Aynı tier",
    placeMore: "Karşılaştırmak için referansta da olan en az 3 öğe yerleştir.",
    noRef: "Bu listenin referansı yok. Bir arkadaşının linkiyle karşılaştır.",
    p0: "🧊 NPC enerjisi — herkesle aynı fikirdesin.", p1: "🙂 Makul insan.", p2: "🌶️ Acılı — fikirlerin var.",
    p3: "🔥 Aykırı — yorumlar karışacak.", p4: "☢️ Kaos ajanı. Saygı.",
    items: "öğe", tiers: "tier", wiki: "Vikipedi",
    loadFail: "Link açılamadı.", footer: "Statik site · takip yok · listelerin tarayıcında ve linklerinde kalır.",
  },
};

let lang = "en";
export function setLang(l) { lang = DICT[l] ? l : "en"; }
export function getLang() { return lang; }
export function detectLang(stored, navLang) {
  if (stored && DICT[stored]) return stored;
  return String(navLang || "").toLowerCase().startsWith("tr") ? "tr" : "en";
}
export function t(key, vars = {}) {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}
export const LANGS = Object.keys(DICT);
export const DICTIONARY = DICT;
