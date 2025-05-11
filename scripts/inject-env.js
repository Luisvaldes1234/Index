const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "../public/subscripcion.html");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error("❌ Variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY no encontrada.");
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace("{{ NEXT_PUBLIC_SUPABASE_ANON_KEY }}", anonKey);
fs.writeFileSync(htmlPath, html);

console.log("✅ Clave pública de Supabase inyectada correctamente en subscripcion.html");
