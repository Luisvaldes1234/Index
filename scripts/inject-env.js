const fs = require("fs");
const path = require("path");

// List of all HTML files that need environment variables
const htmlFiles = [
  "../public/subscripcion.html",
  "../public/dashboard.html",  // Added dashboard.html
  "../public/reportes.html",   // Add other HTML files as needed
  "../public/maquinas.html"
];

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error("❌ Variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY no encontrada.");
  process.exit(1);
}

// Process each HTML file
htmlFiles.forEach(htmlFile => {
  const htmlPath = path.join(__dirname, htmlFile);
  
  // Skip if file doesn't exist
  if (!fs.existsSync(htmlPath)) {
    console.log(`⚠️ Archivo ${htmlFile} no encontrado, omitiendo.`);
    return;
  }
  
  // Read, replace and write back
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace("{{ NEXT_PUBLIC_SUPABASE_ANON_KEY }}", anonKey);
  fs.writeFileSync(htmlPath, html);
  
  console.log(`✅ Clave pública de Supabase inyectada correctamente en ${htmlFile}`);
});

console.log("✅ Proceso de inyección de variables completado.");
