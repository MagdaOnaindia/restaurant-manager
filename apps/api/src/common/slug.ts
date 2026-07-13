const COMBINING_MARKS = /[̀-ͯ]/g;

/** Turns a name into a URL-friendly slug ("Café Ñandú" → "cafe-nandu"). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Short random suffix to disambiguate slugs or codes. */
export function shortCode(length = 6): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // sin caracteres ambiguos
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
