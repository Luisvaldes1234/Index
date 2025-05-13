// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;

// === AUTENTICACIÓN y CARGA INICIAL ===
document.addEventListener("DOMContentLoaded", getUser);
async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    return;
  }
  user = currentUser;

  // Precarga del mes actual
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  document.getElementById("fechaDesde" ).value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta" ).value = ahora.toISOString().split("T")[0];

  await cargarMaquinasParaCSV();
  cargarResumen();
  cargarGraficas();
}

// === CARGA SELECT DE MÁQUINAS ===
async function cargarMaquinasParaCSV() {
  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("serial")
    .eq("user_id", user.id);

  const select = document.getElementById("filtroMaquinaCSV");
  select.innerHTML = `<option value="">Todas</option>`;

  if (!maquinas || error || maquinas.length === 0) {
    // No hay máquinas → dejar sólo "Todas"
    return;
  }

  maquinas.forEach(m => {
    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.serial;
    select.appendChild(op);
  });
}

// === RESUMEN ===
async function cargarResumen() {
  const select = document.getElementById("filtroMaquinaCSV");
  if (select.options.length <= 1) {
    // Sin máquinas asociadas → mostrar mensaje de "Sin datos"
    document.getElementById("resumen").innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded shadow text-center">
        <h3 class="text-xl font-bold">No tienes máquinas registradas</h3>
        <p class="text-gray-500">Agrega una máquina para empezar a ver datos.</p>
      </div>`;
    return;
  }

  // ...aquí sigue tu lógica original de cargarResumen()...
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const resumen = { litros:0, total:0, ticket:0, ultima:null, activas:0, cantidad:0 };

  const { data: ventas } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", hoy.toISOString());

  if (ventas && ventas.length) {
    resumen.litros  = ventas.reduce((s,v)=>s+parseFloat(v.litros||0),0);
    resumen.total   = ventas.reduce((s,v)=>s+parseFloat(v.precio_total||0),0);
    resumen.ticket  = resumen.total/ventas.length;
    resumen.ultima  = ventas[ventas.length-1].created_at;
  }

  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("last_seen")
    .eq("user_id", user.id);

  if (maquinas) {
    const ahora = new Date();
    resumen.cantidad = maquinas.length;
    resumen.activas = maquinas.filter(m=>{
      if (!m.last_seen) return false;
      return ((ahora - new Date(m.last_seen))/60000) < 10;
    }).length;
  }

  renderResumen(resumen);
}

// === GRAFICAS ===
async function cargarGraficas() {
  const select = document.getElementById("filtroMaquinaCSV");
  // Si sólo existe la opción "Todas", no cargamos ventas:
  if (select.options.length <= 1) {
    // destruir gráficas previas si existen
    ['Horas','Dias','Volumen','Maquinas'].forEach(sufijo => {
      const varName = 'chart' + sufijo;
      if (window[varName]) window[varName].destroy();
    });
    return;
  }

  const desdeInput = document.getElementById("fechaDesde").value;
  const hastaInput = document.getElementById("fechaHasta").value;
  if (!desdeInput || !hastaInput) return;

  const desde = new Date(desdeInput);
  const hasta = new Date(hastaInput + "T23:59:59");

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", desde.toISOString())
    .lte("created_at", hasta.toISOString());

  if (error || !ventas) return;

  const filtro = select.value;
  const filtradas = ventas.filter(v => filtro ? v.serial === filtro : false);

  renderGraficaHoras(filtradas);
  renderGraficaDias(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas);
}

// === RENDERIZADO DE GRÁFICAS ===
// ... (tu código original de renderGraficaHoras, renderGraficaDias, etc.) ...

// === EVENTOS ===
["fechaDesde","fechaHasta","filtroMaquinaCSV"].forEach(id => {
  document.getElementById(id).addEventListener("change", cargarGraficas);
});
