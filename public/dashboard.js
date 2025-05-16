// === CONEXIÓN A SUPABASE ===
const supabaseUrl = window.env.SUPABASE_URL;
const supabaseKey = window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let mapaNombres = {}; // serial -> nombre

// === AUTENTICACIÓN Y CARGA INICIAL ===
document.addEventListener("DOMContentLoaded", getUser);

async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    return;
  }
  user = currentUser;
  await cargarMaquinasParaCSV();

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = ahora.toISOString().split("T")[0];

  cargarResumen();
  cargarGraficas();
}

// === CARGA SELECT DE MÁQUINAS Y NOMBRES ===
async function cargarMaquinasParaCSV() {
  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("serial, nombre")
    .eq("user_id", user.id);

  if (!maquinas || error) return;

  const select = document.getElementById("filtroMaquinaCSV");
  maquinas.forEach(m => {
    mapaNombres[m.serial] = m.nombre || m.serial;
    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.serial;
    select.appendChild(op);
  });
}

// === ESCUCHAR FILTROS ===
["fechaDesde", "fechaHasta", "filtroMaquinaCSV"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    cargarResumen();
    cargarGraficas();
  });
});

// === CARGAR RESUMEN CON FILTRO ===
async function cargarResumen() {
  const desdeInput = document.getElementById("fechaDesde").value;
  const hastaInput = document.getElementById("fechaHasta").value;
  const maquina = document.getElementById("filtroMaquinaCSV").value;
  if (!desdeInput || !hastaInput) return;

  const desde = new Date(desdeInput);
  const hasta = new Date(hastaInput + "T23:59:59");

  const { data: ventas } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", desde.toISOString())
    .lte("created_at", hasta.toISOString());

  const filtradas = ventas.filter(v => !maquina || v.serial === maquina);
  const hoy = new Date().toISOString().split("T")[0];
  const ventasHoy = filtradas.filter(v => v.created_at.startsWith(hoy));

  const litrosHoy = ventasHoy.reduce((s, v) => s + parseFloat(v.litros || 0), 0);
  const totalHoy = ventasHoy.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);
  const totalPeriodo = filtradas.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);
  const ticketProm = filtradas.length ? totalPeriodo / filtradas.length : 0;
  const ultimaVenta = filtradas.length ? filtradas[filtradas.length - 1].created_at : null;

  const { data: maquinas } = await supabase.from("maquinas").select("serial, last_seen").eq("user_id", user.id);
  const maquinasFiltradas = maquina ? maquinas.filter(m => m.serial === maquina) : maquinas;
  const activas = maquinasFiltradas.filter(m => {
    if (!m.last_seen) return false;
    const diff = (new Date() - new Date(m.last_seen)) / 60000;
    return diff < 10;
  }).length;

  const contenedor = document.getElementById("resumen");
  contenedor.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Litros vendidos hoy</p>
      <h2 class="text-2xl font-bold">${litrosHoy.toFixed(1)} L</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Ventas totales hoy</p>
      <h2 class="text-2xl font-bold">$${totalHoy.toFixed(2)}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Ventas totales del periodo</p>
      <h2 class="text-2xl font-bold">$${totalPeriodo.toFixed(2)}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Ticket promedio</p>
      <h2 class="text-2xl font-bold">$${ticketProm.toFixed(2)}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Máquinas activas</p>
      <h2 class="text-2xl font-bold">${activas}/${maquinasFiltradas.length}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Última venta</p>
      <h2 class="text-2xl font-bold">${ultimaVenta ? new Date(ultimaVenta).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A'}</h2>
    </div>
  `;
}

// === GRAFICAS ===
async function cargarGraficas() {
  const desdeInput = document.getElementById("fechaDesde").value;
  const hastaInput = document.getElementById("fechaHasta").value;
  const maquina = document.getElementById("filtroMaquinaCSV").value;

  if (!desdeInput || !hastaInput) return;

  const desde = new Date(desdeInput);
  const hasta = new Date(hastaInput + "T23:59:59");

  const { data: ventas } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", desde.toISOString())
    .lte("created_at", hasta.toISOString());

  const filtradas = ventas.filter(v => !maquina || v.serial === maquina);
  renderGraficaHoras(filtradas);
  renderGraficaDias(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas);
}

function renderGraficaHoras(ventas) {
  const horas = Array(24).fill(0);
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    horas[h] += parseFloat(v.precio_total) || 0;
  });
  const canvas = document.getElementById("graficaHoras");
  if (window.chartHoras) window.chartHoras.destroy();
  window.chartHoras = new Chart(canvas, {
    type: "bar",
    data: {
      labels: [...Array(24).keys()].map(h => `${h}:00`),
      datasets: [{ label: "Ventas por hora ($)", data: horas }]
    }
  });
}

function renderGraficaDias(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const f = new Date(v.created_at);
    const clave = f.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
    mapa[clave] = (mapa[clave] || 0) + parseFloat(v.precio_total || 0);
  });
  const labels = Object.keys(mapa);
  const valores = labels.map(k => mapa[k]);
  const canvas = document.getElementById("graficaDias");
  if (window.chartDias) window.chartDias.destroy();
  window.chartDias = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Ventas por día ($)", data: valores }]
    }
  });
}

function renderGraficaVolumen(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    if (!v.serial) return;
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.litros || 0);
  });
  const labels = Object.keys(mapa).map(s => mapaNombres[s] || s);
  const valores = Object.values(mapa);
  const canvas = document.getElementById("graficaVolumen");
  if (window.chartVolumen) window.chartVolumen.destroy();
  window.chartVolumen = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Litros vendidos por máquina", data: valores }]
    }
  });
}

function renderGraficaMaquinas(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    if (!v.serial) return;
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total || 0);
  });
  const labels = Object.keys(mapa).map(s => mapaNombres[s] || s);
  const valores = Object.values(mapa);
  const canvas = document.getElementById("graficaMaquinas");
  if (window.chartMaquinas) window.chartMaquinas.destroy();
  window.chartMaquinas = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Ventas por máquina ($)", data: valores }]
    }
  });
}
