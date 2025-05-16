// reportes.js

// ———————————————————————————————————————————
// 1) Configuración global y autenticación
// ———————————————————————————————————————————
let supabaseClient;
let usuario;
let ventas = [];
let maquinasActivas = [];

const SUPABASE_URL = window.env.SUPABASE_URL;
const SUPABASE_KEY = window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function inicializarSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    alert("Faltan las variables de entorno de Supabase");
    return false;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: true, persistSession: true }
  });
  return true;
}



// ———————————————————————————————————————————
// 2) Funciones para obtener datos
// ———————————————————————————————————————————

async function obtenerMaquinasActivas() {
  const hoy = new Date().toISOString().split("T")[0];
  const { data, error } = await supabaseClient
    .from("maquinas")
    .select("id,nombre")
    .eq("user_id", usuario.id)
    .gt("suscripcion_hasta", hoy);
  if (error) throw error;
  maquinasActivas = data;
  const sel = document.getElementById("filtroMaquinaCSV");
  sel.innerHTML = `<option value="">Todas</option>`;
  maquinasActivas.forEach((m) => {
    sel.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
  });
}

async function obtenerVentas() {
  const desde = document.getElementById("rptDesde").value;
  const hasta = document.getElementById("rptHasta").value;
  if (!desde || !hasta) throw new Error("Selecciona un rango de fechas");
  // Ajustar hasta para incluir todo el día
  const h = new Date(hasta);
  h.setDate(h.getDate() + 1);
  let query = supabaseClient
    .from("ventas")
    .select(`*, maquinas(nombre)`)
    .eq("user_id", usuario.id)
    .gte("fecha", desde)
    .lt("fecha", h.toISOString().split("T")[0]);

  const filtro = document.getElementById("filtroMaquinaCSV").value;
  if (filtro) query = query.eq("id_maquina", filtro);
  else query = query.in("id_maquina", maquinasActivas.map((m) => m.id));

  const { data, error } = await query.order("fecha", { ascending: true });
  if (error) throw error;
  ventas = data.map((v) => ({
    ...v,
    importe: v.importe ?? 0,
    unidades: v.unidades ?? 0,
    maquina: v.maquinas?.nombre ?? "Desconocida",
    fecha_corta: v.fecha.split("T")[0],
    hora: new Date(v.fecha).toLocaleTimeString(),
  }));
}

// ———————————————————————————————————————————
// 3) Renderizado de KPIs y tabla
// ———————————————————————————————————————————

function renderKPIs() {
  const total = ventas.reduce((s, v) => s + v.importe, 0);
  const unidades = ventas.reduce((s, v) => s + v.unidades, 0);
  const trans = ventas.length;
  const desde = new Date(document.getElementById("rptDesde").value);
  const hasta = new Date(document.getElementById("rptHasta").value);
  const dias = Math.max(
    1,
    Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24)) + 1
  );
  const diario = total / dias;

  document.getElementById(
    "rptKPIs"
  ).innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Ventas Totales</h4>
      <p>$${total.toFixed(2)}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Unidades Vendidas</h4>
      <p>${unidades}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Transacciones</h4>
      <p>${trans}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Promedio Diario</h4>
      <p>$${diario.toFixed(2)}</p>
    </div>
  `;
}

function renderTabla() {
  const tbody = document.querySelector("#rptTabla tbody");
  tbody.innerHTML = ventas
    .map(
      (v) => `
    <tr class="dark:bg-gray-800">
      <td class="px-4 py-2">${v.fecha_corta} ${v.hora}</td>
      <td class="px-4 py-2">${v.maquina}</td>
      <td class="px-4 py-2">${v.producto || "-"}</td>
      <td class="px-4 py-2">${v.unidades}</td>
      <td class="px-4 py-2">$${v.importe.toFixed(2)}</td>
    </tr>`
    )
    .join("");
}

// ———————————————————————————————————————————
// 4) Gráficas con Chart.js
// ———————————————————————————————————————————

let chartMaquina, chartProducto, chartSerie;
function renderGraficas() {
  // Desglose por Máquina
  const byM = {};
  ventas.forEach((v) => {
    byM[v.maquina] = (byM[v.maquina] || 0) + v.importe;
  });
  const labM = Object.keys(byM),
    valM = labM.map((l) => byM[l]);
  const ctxM = document.getElementById("rptPorMaquina").getContext("2d");
  if (chartMaquina) chartMaquina.destroy();
  chartMaquina = new Chart(ctxM, {
    type: "bar",
    data: { labels: labM, datasets: [{ label: "Ventas $", data: valM }] },
    options: { responsive: true, maintainAspectRatio: false },
  });

  // Desglose por Producto
  const byP = {};
  ventas.forEach((v) => {
    const p = v.producto || "Sin nombre";
    byP[p] = (byP[p] || 0) + v.unidades;
  });
  const labP = Object.keys(byP),
    valP = labP.map((l) => byP[l]);
  const ctxP = document.getElementById("rptPorProducto").getContext("2d");
  if (chartProducto) chartProducto.destroy();
  chartProducto = new Chart(ctxP, {
    type: "pie",
    data: { labels: labP, datasets: [{ data: valP }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
  });

  // Serie temporal Ventas Diarias
  const byDay = {};
  ventas.forEach((v) => {
    byDay[v.fecha_corta] = (byDay[v.fecha_corta] || 0) + v.importe;
  });
  const labD = Object.keys(byDay).sort(),
    valD = labD.map((d) => byDay[d]);
  const ctxS = document.getElementById("rptSerieDiaria").getContext("2d");
  if (chartSerie) chartSerie.destroy();
  chartSerie = new Chart(ctxS, {
    type: "line",
    data: { labels: labD, datasets: [{ label: "Ventas diarias", data: valD, fill: false }] },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

// ———————————————————————————————————————————
// 5) Exportar CSV
// ———————————————————————————————————————————

function exportarCSV() {
  if (!ventas.length) return alert("Sin datos para exportar");
  const rows = ventas.map((v) =>
    [
      `${v.fecha_corta} ${v.hora}`,
      v.maquina,
      v.producto || "-",
      v.unidades,
      v.importe.toFixed(2),
    ]
      .map((c) => `"${c}"`)
      .join(",")
  );
  const csv = ["Fecha,Maquina,Producto,Unidades,Importe", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_${document.getElementById("rptDesde").value}_a_${document.getElementById("rptHasta").value}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ———————————————————————————————————————————
// 6) Inicialización y eventos
// ———————————————————————————————————————————

window.addEventListener("DOMContentLoaded", () => {
  // Presets de fechas
  const desdeEl = document.getElementById("rptDesde"),
    hastaEl = document.getElementById("rptHasta");
  const hoy = new Date(),
    ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  desdeEl.value = ini.toISOString().split("T")[0];
  hastaEl.value = hoy.toISOString().split("T")[0];

  // Botones preset
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dias = parseInt(btn.getAttribute("data-preset"), 10);
      const fin = new Date(),
        ini2 = new Date(fin);
      ini2.setDate(fin.getDate() - dias + 1);
      desdeEl.value = ini2.toISOString().split("T")[0];
      hastaEl.value = fin.toISOString().split("T")[0];
    });
  });

  document.getElementById("rptActualizar").addEventListener("click", async () => {
    await runReporte();
  });
  document.getElementById("rptExportCSV").addEventListener("click", exportarCSV);

  // Ejecutar reporte al cargar
  runReporte();
});

// Función que orquesta todo
async function runReporte() {
  if (!await verificarSesion()) return;
  await obtenerMaquinasActivas();
  await obtenerVentas();
  renderKPIs();
  renderTabla();
  renderGraficas();
}
