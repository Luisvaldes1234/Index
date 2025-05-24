
const supabaseUrl = window.env.SUPABASE_URL;
const supabaseKey = window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let mapaMaquinas = {};
let cortesMaquina = {};

// === INICIO ===
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return alert("No estás autenticado.");
  user = currentUser;
  await cargarMaquinas();
  document.getElementById("btnAplicarFiltros").addEventListener("click", generarReporte);
});

// === CARGAR MAQUINAS ===
async function cargarMaquinas() {
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("serial, nombre, ultimo_corte, last_seen")
    .eq("user_id", user.id);

  const select = document.getElementById("filtroMaquina");
  maquinas.forEach(m => {
    mapaMaquinas[m.serial] = m.nombre || m.serial;
    cortesMaquina[m.serial] = m.ultimo_corte || null;
    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.nombre || m.serial;
    select.appendChild(op);
  });
}

// === GENERAR REPORTE ===
async function generarReporte() {
  const desde = document.getElementById("filtroDesde").value;
  const hasta = document.getElementById("filtroHasta").value;
  const serial = document.getElementById("filtroMaquina").value;
  const costoAgua = parseFloat(document.getElementById("costoAgua").value || 0);
  const gastoMensual = parseFloat(document.getElementById("gastoMensual").value || 0);

  if (!desde || !hasta) return alert("Selecciona un rango de fechas válido.");

  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  const { data: ventas } = await supabase
    .from("ventas")
    .select("created_at, serial, litros, precio_total")
    .gte("created_at", desdeISO)
    .lte("created_at", hastaISO);

  const filtradas = serial ? ventas.filter(v => v.serial === serial) : ventas;

  renderKPIs(filtradas, costoAgua, gastoMensual);
  renderGraficaPorDia(filtradas);
  renderGraficaPorMaquina(filtradas);
  renderTopMaquinas(filtradas);
  renderFrecuenciaHoras(filtradas);
  renderTabla(filtradas);
}

// === KPIs ===
function renderKPIs(data, costoAgua, gastoMensual) {
  const resumen = document.getElementById("resumenKPIs");
  resumen.innerHTML = "";

  const totalIngresos = data.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);
  const totalLitros = data.reduce((s, v) => s + parseFloat(v.litros || 0), 0);
  const ticketPromedio = totalIngresos / (data.length || 1);
  const m3Consumidos = totalLitros / 1000;
  const costoAguaTotal = m3Consumidos * costoAgua;
  const maquinasUnicas = new Set(data.map(v => v.serial)).size;
  const costoOperativo = gastoMensual * maquinasUnicas;
  const utilidadEstimada = totalIngresos - costoAguaTotal - costoOperativo;

  const ahora = new Date();
  const activas = Object.entries(cortesMaquina).filter(([serial, last_seen]) => {
    return last_seen && (ahora - new Date(last_seen)) / 60000 < 10;
  }).length;

  const kpis = [
    { label: "Ingresos Totales", valor: `$${totalIngresos.toFixed(2)}` },
    { label: "Litros Vendidos", valor: `${totalLitros.toFixed(1)} L` },
    { label: "Ticket Promedio", valor: `$${ticketPromedio.toFixed(2)}` },
    { label: "Utilidad Estimada", valor: `$${utilidadEstimada.toFixed(2)}` },
    { label: "Máquinas Activas (últimos 10 min)", valor: `${activas}` },
  ];

  kpis.forEach(kpi => {
    const div = document.createElement("div");
    div.className = "bg-white dark:bg-gray-800 p-4 rounded shadow";
    div.innerHTML = `<p class='text-gray-500 text-sm'>${kpi.label}</p><h2 class='text-2xl font-bold'>${kpi.valor}</h2>`;
    resumen.appendChild(div);
  });
}

// === GRAFICAS ===
function renderGraficaPorDia(data) {
  const agrupado = {};
  data.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString("es-MX");
    agrupado[fecha] = (agrupado[fecha] || 0) + parseFloat(v.precio_total);
  });
  const labels = Object.keys(agrupado);
  const valores = Object.values(agrupado);

  if (window.chartDia) window.chartDia.destroy();
  window.chartDia = new Chart(document.getElementById("graficaIngresosPorDia"), {
    type: "line",
    data: { labels, datasets: [{ label: "Ingresos ($)", data: valores }] }
  });
}

function renderGraficaPorMaquina(data) {
  const mapa = {};
  data.forEach(v => {
    const nombre = mapaMaquinas[v.serial] || v.serial;
    mapa[nombre] = (mapa[nombre] || 0) + parseFloat(v.litros);
  });
  const labels = Object.keys(mapa);
  const valores = Object.values(mapa);

  if (window.chartMaquina) window.chartMaquina.destroy();
  window.chartMaquina = new Chart(document.getElementById("graficaLitrosPorMaquina"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Litros", data: valores }] }
  });
}

function renderTopMaquinas(data) {
  const suma = {};
  data.forEach(v => {
    const nombre = mapaMaquinas[v.serial] || v.serial;
    suma[nombre] = (suma[nombre] || 0) + parseFloat(v.precio_total);
  });
  const ordenado = Object.entries(suma).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const labels = ordenado.map(x => x[0]);
  const valores = ordenado.map(x => x[1]);

  if (window.chartTop) window.chartTop.destroy();
  window.chartTop = new Chart(document.getElementById("graficaTopIngresos"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Top Ingresos", data: valores }] }
  });
}

function renderFrecuenciaHoras(data) {
  const horas = Array(24).fill(0);
  data.forEach(v => {
    const h = new Date(v.created_at).getHours();
    horas[h]++;
  });
  if (window.chartHoras) window.chartHoras.destroy();
  window.chartHoras = new Chart(document.getElementById("graficaFrecuenciaPorHora"), {
    type: "bar",
    data: { labels: horas.map((_, i) => `${i}:00`), datasets: [{ label: "Frecuencia", data: horas }] }
  });
}

function renderTabla(data) {
  const tbody = document.querySelector("#tablaHistorial tbody");
  tbody.innerHTML = "";
  data.forEach(v => {
    const row = document.createElement("tr");
    row.className = "border-b";
    row.innerHTML = `
      <td class="px-4 py-2">${new Date(v.created_at).toLocaleDateString()}</td>
      <td class="px-4 py-2">${mapaMaquinas[v.serial] || v.serial}</td>
      <td class="px-4 py-2">${v.litros} L</td>
      <td class="px-4 py-2">$${parseFloat(v.precio_total).toFixed(2)}</td>
      <td class="px-4 py-2">${new Date(v.created_at).toLocaleTimeString()}</td>
      <td class="px-4 py-2">${cortesMaquina[v.serial] ? new Date(cortesMaquina[v.serial]).toLocaleDateString() : '-'}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("btnExportarCSV").onclick = () => exportarCSV(data);
}

function exportarCSV(data) {
  const headers = ["Fecha", "Máquina", "Litros", "Ingreso", "Hora"];
  const rows = data.map(v => [
    new Date(v.created_at).toLocaleDateString(),
    mapaMaquinas[v.serial] || v.serial,
    v.litros,
    parseFloat(v.precio_total).toFixed(2),
    new Date(v.created_at).toLocaleTimeString()
  ]);

  let csv = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "reporte_ventas.csv";
  link.click();
}
