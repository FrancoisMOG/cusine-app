// Fonction Supabase « import-recipe » : lit une page, une photo ou un texte
// et demande à Gemini d'en extraire la recette au format de l'app.
// Secrets attendus (Edge Functions > Secrets) : GEMINI_API_KEY, et GEMINI_MODELS en option.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const AISLES = ["Fruits et légumes", "Boucherie et poisson", "Crèmerie et œufs", "Boulangerie", "Épicerie salée",
  "Épicerie sucrée", "Épices et condiments", "Surgelés", "Boissons", "Autres"];
const MODELS = (Deno.env.get("GEMINI_MODELS") ||
  "gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite")
  .split(",").map((s) => s.trim()).filter(Boolean);

class Fail extends Error {
  constructor(message: string, public status = 500, public code = "error") { super(message); }
}
const reply = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function parseJson(t: string) {
  const s = t.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch (_) { /* on tente l'objet le plus large */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Fail("Réponse illisible du modèle.", 502, "parse");
}

async function gemini(parts: unknown[]) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Fail("Le secret GEMINI_API_KEY manque dans Supabase (voir le guide, étape 3).", 500, "config");
  let last = "", quota = false;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    if (r.ok) {
      const j = await r.json();
      const text = (j?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      if (!text) { last = `${model} : réponse vide`; continue; }
      return parseJson(text);
    }
    last = `${model} : ${r.status} ${(await r.text()).slice(0, 300)}`;
    if (r.status === 429) { quota = true; continue; }          // quota de ce modèle épuisé : on essaie le suivant
    if (r.status === 404 || r.status >= 500) continue;          // modèle inconnu ou indisponible
    break;                                                      // clé invalide, requête refusée...
  }
  console.error("Gemini", last);
  if (quota) throw new Fail("Quota gratuit Gemini atteint.", 429, "quota");
  throw new Fail("Gemini a refusé la demande (" + last.slice(0, 160) + ").", 502, "gemini");
}

function extractPrompt(source: string, text: string) {
  return `Voici ${source}. Extrais la recette qu'il contient.
Réponds uniquement par un objet JSON de cette forme :
{"found": true, "title": "Spaghetti carbonara", "servings": 4, "time": 25, "tags": ["dîner","italien"], "ingredients": [{"group": null, "q": 400, "q2": null, "unit": "g", "name": "spaghetti", "note": null, "aisle": "Épicerie salée"}], "steps": ["Faire cuire les pâtes…"]}
Règles :
- Écris tout en français, en traduisant si la recette est dans une autre langue.
- q est un nombre (fractions en décimal : 1/2 donne 0.5) ou null s'il n'y a pas de quantité ; q2 sert aux fourchettes (« 2 à 3 »).
- unit est l'unité de la recette, abrégée : g, kg, ml, cl, l, c. à soupe, c. à café, cup, oz, lb, pincée, gousse, tranche, boîte, sachet… ou null. Ne convertis pas les unités.
- name est l'ingrédient seul, sans « de » ni « d' » devant ; note contient les précisions (« haché finement »).
- group nomme le sous-ensemble quand la recette en a (« Pour la sauce »), sinon null.
- aisle vaut exactement l'un de : ${AISLES.join(", ")}.
- steps : une étape par élément, sans numéro.
- servings et time (durée totale en minutes) valent null s'ils manquent. tags : 3 au plus (type de repas, cuisine, régime).
- S'il n'y a pas de recette, réponds {"found": false}.
${text ? `Contenu :\n"""\n${text}\n"""` : ""}`;
}

function decode(s: string) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function meta(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? tag?.match(/content="([^"]*)"/i)?.[1];
  return c ? decode(c) : "";
}
function findRecipe(node: unknown): unknown {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const o = node as Record<string, unknown>;
  const t = o["@type"];
  if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return o;
  return findRecipe(o["@graph"]) || findRecipe(o["mainEntity"]);
}

async function readPage(url: string) {
  let u: URL;
  try { u = new URL(url); } catch (_) { throw new Fail("Adresse invalide.", 400, "url"); }
  if (!/^https?:$/.test(u.protocol)) throw new Fail("Adresse invalide.", 400, "url");
  const r = await fetch(u.href, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml",
    },
  }).catch(() => { throw new Fail("La page ne répond pas.", 502, "fetch"); });
  const html = (await r.text()).slice(0, 2_000_000);

  // 1. Les sites de recettes décrivent souvent la recette en données structurées (schema.org)
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const rec = findRecipe(JSON.parse(m[1].trim()));
      if (rec) return { text: JSON.stringify(rec).slice(0, 30000), kind: "les données structurées d'une page de recette", structured: true };
    } catch (_) { /* bloc JSON invalide, on passe au suivant */ }
  }
  // 2. Sinon : titre, description (légende Instagram / Facebook) et texte visible
  const head = [meta(html, "og:title"), meta(html, "og:description"), meta(html, "description"), meta(html, "twitter:description")]
    .filter(Boolean);
  const body = decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
  const text = [...new Set(head)].join("\n") + "\n\n" + body.slice(0, 25000);
  return { text: text.trim(), kind: `le texte d'une page web (${u.hostname})`, structured: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Méthode non acceptée." }, 405);
  try {
    const body = await req.json();
    const mode = body?.mode;

    if (mode === "nutrition") {
      const x = await gemini([{ text:
        `Estime les valeurs nutritionnelles d'une portion de cette recette (${body.servings || "nombre de portions inconnu, suppose 4"} portions au total).
Ingrédients :
${String(body.ingredients || "").slice(0, 8000)}
Réponds uniquement par un objet JSON {"kcal": entier, "prot": entier, "gluc": entier, "lip": entier} (kcal et grammes par portion).` }]);
      return reply({ nutrition: x });
    }

    if (mode === "url") {
      const page = await readPage(String(body.url || ""));
      if (!page.structured && page.text.replace(/\s+/g, "").length < 80) {
        return reply({ found: false, reason: "La page ne laisse pas lire la recette (Instagram et Facebook demandent souvent une connexion). Faites une capture d'écran de la légende et partagez-la vers l'app." });
      }
      const recipe = await gemini([{ text: extractPrompt(page.kind, page.text) }]);
      if (!recipe?.found) return reply({ found: false, reason: "Aucune recette lisible sur cette page. Essayez avec une capture d'écran de la légende." });
      return reply({ recipe, sourceUrl: body.url });
    }

    if (mode === "images") {
      const imgs = (Array.isArray(body.images) ? body.images : []).slice(0, 4)
        .filter((i: { data?: string }) => i && typeof i.data === "string" && i.data.length < 6_000_000);
      if (!imgs.length) throw new Fail("Aucune image reçue.", 400, "input");
      const src = imgs.length > 1
        ? `une série de ${imgs.length} photos d'une même recette (captures d'écran, page de livre ou fiche manuscrite), dans l'ordre`
        : "une photo de recette (capture d'écran, page de livre ou fiche manuscrite)";
      const parts: unknown[] = [{ text: extractPrompt(src, "") }];
      for (const i of imgs) parts.push({ inline_data: { mime_type: i.mime || "image/jpeg", data: i.data } });
      const recipe = await gemini(parts);
      return reply(recipe?.found === false ? { found: false } : { recipe });
    }

    if (mode === "text") {
      const t = String(body.text || "").slice(0, 30000);
      if (!t.trim()) throw new Fail("Texte vide.", 400, "input");
      const recipe = await gemini([{ text: extractPrompt("un texte copié par l'utilisateur", t) }]);
      return reply(recipe?.found === false ? { found: false } : { recipe, sourceUrl: body.sourceUrl || null });
    }

    throw new Fail("Mode inconnu.", 400, "input");
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail(String((e as Error)?.message || e), 500);
    return reply({ error: f.message, code: f.code }, f.status);
  }
});
