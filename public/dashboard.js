// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;

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

  // Precarga del mes actual
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = ahora.toISOString().split("T")[0];

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
  if (!maquinas || error) return;
  maquinas.forEach(m => {
    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.serial;
    select.appendChild(op);
  });
}

// === ESCUCHAR FILTROS ===
["fechaDesde", "fechaHasta", "filtroMaquinaCSV"].forEach(id => {
  document.getElementById(id).addEventListener("change", cargarGraficas);
});

// === CARGAR RESUMEN ===
async function cargarResumen() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = hoy.toISOString();
  const resumen = { litros: 0, total: 0, ultima: null, ticket: 0, activas: 0, cantidad: 0 };

  const { data: ventas } = await supabase.from("ventas").select("*").gte("created_at", fechaInicio);
  if (ventas && ventas.length) {
    resumen.litros = ventas.reduce((s, v) => s + parseFloat(v.litros || 0), 0);
    resumen.total = ventas.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);
    resumen.ticket = resumen.total / ventas.length;
    resumen.ultima = ventas[ventas.length - 1].created_at;
  }

  const { data: maquinas } = await supabase.from("maquinas").select("last_seen").eq("user_id", user.id);
  if (maquinas) {
    const ahora = new Date();
    resumen.cantidad = maquinas.length;
    resumen.activas = maquinas.filter(m => {
      if (!m.last_seen) return false;
      const diff = (ahora - new Date(m.last_seen)) / 60000;
      return diff < 10;
    }).length;
  }

  renderResumen(resumen);
}

function renderResumen(r) {
  const contenedor = document.getElementById("resumen");
  contenedor.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Litros vendidos hoy</p>
      <h2 class="text-2xl font-bold">${r.litros.toFixed(1)} L</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Ventas totales hoy</p>
      <h2 class="text-2xl font-bold">$${r.total.toFixed(2)}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Ticket promedio</p>
      <h2 class="text-2xl font-bold">$${r.ticket.toFixed(2)}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Máquinas activas</p>
      <h2 class="text-2xl font-bold">${r.activas}/${r.cantidad}</h2>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-gray-500 text-sm">Última venta</p>
      <h2 class="text-2xl font-bold">${r.ultima ? new Date(r.ultima).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A'}</h2>
    </div>
  `;
}

// === CARGA DE GRAFICAS ===
async function cargarGraficas() {
  const desdeInput = document.getElementById("fechaDesde").value;
  const hastaInput = document.getElementById("fechaHasta").value;
  const maquina = document.getElementById("filtroMaquinaCSV").value;

  if (!desdeInput || !hastaInput) return;

  const desde = new Date(desdeInput);
  const hasta = new Date(hastaInput + "T23:59:59");

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", desde.toISOString())
    .lte("created_at", hasta.toISOString());

  if (error || !ventas) return;

  const filtradas = ventas.filter(v => !maquina || v.serial === maquina);

  renderGraficaHoras(filtradas);
  renderGraficaDias(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas, maquina);
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
  const labels = Object.keys(mapa);
  const valores = labels.map(l => mapa[l]);
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
  const labels = Object.keys(mapa);
  const valores = labels.map(l => mapa[l]);
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
