const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;

document.addEventListener('DOMContentLoaded', getUser);
// === AUTENTICACIÓN Y CARGA INICIAL ===
document.addEventListener("DOMContentLoaded", getUser);

async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
@@ -13,46 +15,57 @@ async function getUser() {
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

// === FUNCIONES RESUMEN ===
async function cargarResumen() {
  const resumen = {
    litros: 0,
    total: 0,
    ultima: null,
    ticket: 0,
    activas: 0,
    cantidad: 0
  };
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

  // 1. Ventas de hoy
  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", fechaInicio);

  if (error) return console.error("Error al cargar ventas:", error);

  if (ventas.length) {
    resumen.litros = ventas.reduce((sum, v) => sum + (parseFloat(v.litros) || 0), 0);
    resumen.total = ventas.reduce((sum, v) => sum + (parseFloat(v.precio_total) || 0), 0);
  const { data: ventas } = await supabase.from("ventas").select("*").gte("created_at", fechaInicio);
  if (ventas && ventas.length) {
    resumen.litros = ventas.reduce((s, v) => s + parseFloat(v.litros || 0), 0);
    resumen.total = ventas.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);
    resumen.ticket = resumen.total / ventas.length;
    resumen.ultima = ventas[ventas.length - 1].created_at;
  }

  // 2. Máquinas activas
  const { data: maquinas, error: errMaquinas } = await supabase
    .from("maquinas")
    .select("*")
    .eq("user_id", user.id);

  if (!errMaquinas && maquinas) {
  const { data: maquinas } = await supabase.from("maquinas").select("last_seen").eq("user_id", user.id);
  if (maquinas) {
    const ahora = new Date();
    resumen.cantidad = maquinas.length;
    resumen.activas = maquinas.filter(m => {
@@ -65,7 +78,6 @@ async function cargarResumen() {
  renderResumen(resumen);
}

// === MOSTRAR TARJETAS ===
function renderResumen(r) {
  const contenedor = document.getElementById("resumen");
  contenedor.innerHTML = `
@@ -91,232 +103,105 @@ function renderResumen(r) {
    </div>
  `;
}
document.addEventListener("DOMContentLoaded", () => {
  cargarGraficas();
});

// === CARGA DE GRAFICAS ===
async function cargarGraficas() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const desdeInput = document.getElementById("fechaDesde").value;
  const hastaInput = document.getElementById("fechaHasta").value;
  const maquina = document.getElementById("filtroMaquinaCSV").value;

  if (!desdeInput || !hastaInput) return;

  const desde = new Date(desdeInput);
  const hasta = new Date(hastaInput + "T23:59:59");

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", new Date(desde).toISOString())
    .lte("created_at", new Date(hasta + "T23:59:59").toISOString());
    .gte("created_at", desde.toISOString())
    .lte("created_at", hasta.toISOString());

  if (error || !ventas) return console.error("Error al cargar ventas:", error);
  if (error || !ventas) return;

  const filtradas = ventas.filter(v =>
    !maquina || v.serial === maquina
  );
  const filtradas = ventas.filter(v => !maquina || v.serial === maquina);

  renderGraficaHoras(filtradas);
  renderGraficaDias(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas, maquina);
}

function renderGraficaMaquinas(ventas, maquinaFiltrada) {
  const canvas = document.getElementById("graficaMaquinas");
  if (!canvas) return;

  const mapa = {};

function renderGraficaHoras(ventas) {
  const horas = Array(24).fill(0);
  ventas.forEach(v => {
    if (!v.serial) return;
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total || 0);
    const h = new Date(v.created_at).getHours();
    horas[h] += parseFloat(v.precio_total) || 0;
  });

  const labels = Object.keys(mapa);
  const valores = labels.map(l => mapa[l]);

  if (window.chartMaquinas) window.chartMaquinas.destroy();
  window.chartMaquinas = new Chart(canvas, {
  const canvas = document.getElementById("graficaHoras");
  if (window.chartHoras) window.chartHoras.destroy();
  window.chartHoras = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ventas por máquina ($)",
        data: valores
      }]
      labels: [...Array(24).keys()].map(h => `${h}:00`),
      datasets: [{ label: "Ventas por hora ($)", data: horas }]
    }
  });
}

function renderGraficaDias(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
    mapa[fecha] = (mapa[fecha] || 0) + parseFloat(v.precio_total || 0);
    const f = new Date(v.created_at);
    const clave = f.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
    mapa[clave] = (mapa[clave] || 0) + parseFloat(v.precio_total || 0);
  });

  const fechas = Object.keys(mapa).sort().slice(-7);
  const valores = fechas.map(f => mapa[f]);

  new Chart(document.getElementById("graficaDias"), {
  const labels = Object.keys(mapa);
  const valores = labels.map(k => mapa[k]);
  const canvas = document.getElementById("graficaDias");
  if (window.chartDias) window.chartDias.destroy();
  window.chartDias = new Chart(canvas, {
    type: "line",
    data: {
      labels: fechas,
      datasets: [{
        label: "Ventas diarias ($)",
        data: valores,
        tension: 0.3
      }]
      labels,
      datasets: [{ label: "Ventas por día ($)", data: valores }]
    }
  });
}

function renderGraficaVolumen(ventas) {
  const conteo = { "5": 0, "10": 0, "20": 0 };
  const mapa = {};
  ventas.forEach(v => {
    const l = parseInt(v.litros);
    if (conteo[l] !== undefined) conteo[l]++;
    if (!v.serial) return;
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.litros || 0);
  });

  new Chart(document.getElementById("graficaVolumen"), {
    type: "pie",
  const labels = Object.keys(mapa);
  const valores = labels.map(l => mapa[l]);
  const canvas = document.getElementById("graficaVolumen");
  if (window.chartVolumen) window.chartVolumen.destroy();
  window.chartVolumen = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["5L", "10L", "20L"],
      datasets: [{
        data: [conteo["5"], conteo["10"], conteo["20"]]
      }]
      labels,
      datasets: [{ label: "Litros vendidos por máquina", data: valores }]
    }
  });
}

async function renderGraficaMaquinas(ventas) {
function renderGraficaMaquinas(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    if (!v.serial) return;
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total || 0);
  });

  const labels = Object.keys(mapa);
  const valores = labels.map(l => mapa[l]);

  new Chart(document.getElementById("graficaMaquinas"), {
  const canvas = document.getElementById("graficaMaquinas");
  if (window.chartMaquinas) window.chartMaquinas.destroy();
  window.chartMaquinas = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ventas por máquina ($)",
        data: valores
      }]
      datasets: [{ label: "Ventas por máquina ($)", data: valores }]
    }
  });

  // Cargar select de filtros
  const filtro = document.getElementById("filtroMaquina");
  labels.forEach(serial => {
    const op = document.createElement("option");
    op.value = serial;
    op.textContent = serial;
    filtro.appendChild(op);
  });
}

function aplicarFiltros() {
  cargarGraficas(); // Puedes hacer filtros más finos si prefieres, aquí lo simplificamos
}

function renderTabla(ventas) {
  const tabla = document.getElementById("tablaVentas");
  tabla.innerHTML = `
    <table class="min-w-full table-auto border border-gray-300 dark:border-gray-700">
      <thead>
        <tr class="bg-gray-200 dark:bg-gray-700 text-sm">
          <th class="px-2 py-1">Fecha</th>
          <th class="px-2 py-1">Hora</th>
          <th class="px-2 py-1">Máquina</th>
          <th class="px-2 py-1">Litros</th>
          <th class="px-2 py-1">Precio</th>
        </tr>
      </thead>
      <tbody class="text-sm">
        ${ventas.map(v => {
          const f = new Date(v.created_at);
          const fecha = f.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
          const hora = f.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" });
          return `
            <tr class="border-t border-gray-300 dark:border-gray-700">
              <td class="px-2 py-1">${fecha}</td>
              <td class="px-2 py-1">${hora}</td>
              <td class="px-2 py-1">${v.serial}</td>
              <td class="px-2 py-1">${v.litros}</td>
              <td class="px-2 py-1">$${parseFloat(v.precio_total).toFixed(2)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}
document.addEventListener("DOMContentLoaded", () => {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const hoy = new Date();

  document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = hoy.toISOString().split("T")[0];
});

async function descargarCSV() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const maquina = document.getElementById("filtroMaquinaCSV").value;

  if (!desde || !hasta) return alert("Selecciona ambas fechas");

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", new Date(desde).toISOString())
    .lte("created_at", new Date(hasta + "T23:59:59").toISOString());

  if (error) return alert("Error al obtener ventas");

  const filtradas = ventas.filter(v =>
    !maquina || v.serial === maquina
  );

  if (!filtradas.length) return alert("No hay ventas en este período");

  const encabezados = ["Fecha", "Hora", "Máquina", "Litros", "Precio"];
  const filas = filtradas.map(v => {
    const f = new Date(v.created_at);
    const fecha = f.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
    const hora = f.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" });
    return [fecha, hora, v.serial, v.litros, v.precio_total];
  });

  const csv = encabezados.join(",") + "\n" + filas.map(f => f.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ventas_${desde}_a_${hasta}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
async function cargarMaquinasParaCSV() {
  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("serial")
    .eq("user_id", user.id);

  if (error || !maquinas) return;

  const select = document.getElementById("filtroMaquinaCSV");
  maquinas.forEach(m => {
    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.serial;
    select.appendChild(op);
  });
}
// Escuchar cambios en filtros
["fechaDesde", "fechaHasta", "filtroMaquinaCSV"].forEach(id => {
  document.getElementById(id).addEventListener("change", cargarGraficas);
});
