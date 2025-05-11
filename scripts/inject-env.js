const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../public/subscripcion.html'); // ajusta ruta si no estás usando /public
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error("❌ No se encontró la variable NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace('{{ NEXT_PUBLIC_SUPABASE_ANON_KEY }}', anonKey);
fs.writeFileSync(htmlPath, html);

console.log('✅ Variable reemplazada en subscripcion.html');
