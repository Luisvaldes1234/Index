// === Inicializar Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// para almacenar la lista de ventas y el mapeo id→nombre
let ventasActuales = [];
const maquinaMap = {};

// referencias a las instancias de Chart.js
let chartTop, chartLitros, chartVentasDiarias, chartTipoVolumen;

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Autenticación
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = "login.html";

  // 2) Fechas iniciales (1° del mes hasta hoy)
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById("fechaInicioResumen").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaFinResumen").value = hoy.toISOString().split("T")[0];

  // 3) Cargar máquinas del usuario y llenar <select>
  const { data: maquinas, error: errM } = await supabase
    .from("maquinas")
    .select("id, nombre")
    .eq("usuario_id", user.id);
  if (errM) {
    console.error("Error al cargar máquinas:", errM.message);
    return;
  }
  const filtro = document.getElementById("filtroMaquina");
  maquinas.forEach(m => {
    maquinaMap[m.id] = m.nombre || `Máquina ${m.id}`;
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = maquinaMap[m.id];
    filtro.appendChild(opt);
  });

  // 4) Botones
  document.getElementById("btnAplicar").onclick = actualizarResumen;
  document.getElementById("btnExportar").onclick = exportarCSV;
  document.getElementById("btnToggleDark").onclick = () =>
    document.documentElement.classList.toggle("dark");

  // 5) Primera carga
  actualizarResumen();
});

async function actualizarResumen() {
  // Obtener filtros
  const maquinaSeleccionada = document.getElementById("filtroMaquina").value;
  const fechaInicio = document.getElementById("fechaInicioResumen").value;
  const fechaFin = document.getElementById("fechaFinResumen").value;

  // Volver a leer usuario
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Query ventas
  let q = supabase
    .from("ventas")
    .select("litros, total, fecha, maquina_id")
    .eq("usuario_id", user.id)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);
  if (maquinaSeleccionada !== "todas") {
    q = q.eq("maquina_id", maquinaSeleccionada);
  }
  const { data: ventas, error } = await q;
  if (error) {
    console.error("Error al obtener ventas:", error.message);
    return;
  }

  ventasActuales = ventas;

  // Mostrar mensaje si no hay ventas
  const msg = document.getElementById("mensajeSinVentas");
  if (ventas.length === 0) msg.classList.remove("hidden");
  else msg.classList.add("hidden");

  // 6) KPIs
  let totalVentas = 0, litrosTotales = 0;
  ventas.forEach(v => {
    totalVentas += v.total || 0;
    litrosTotales += v.litros || 0;
  });
  const ticketProm = ventas.length ? totalVentas / ventas.length : 0;
  document.getElementById("ventasTotales").textContent = `$${totalVentas.toFixed(2)}`;
  document.getElementById("litrosTotales").textContent = `${litrosTotales} L`;
  document.getElementById("ticketPromedio").textContent = `$${ticketProm.toFixed(2)}`;
  document.getElementById("cantidadVentas").textContent = ventas.length;

  // 7) Actualizar todas las gráficas
  actualizarGraficaTop(ventas);
  actualizarGraficaLitros(ventas);
  actualizarGraficaVentasDiarias(ventas);
  actualizarGraficaTipoVolumen(ventas);
}

function actualizarGraficaTop(ventas) {
  // Agrupar ingresos por máquina
  const resumen = {};
  ventas.forEach(v => {
    const nombre = maquinaMap[v.maquina_id] || `Máquina ${v.maquina_id}`;
    resumen[nombre] = (resumen[nombre] || 0) + (v.total || 0);
  });
  const top3 = Object.entries(resumen)
    .sort((a,b)=> b[1]-a[1])
    .slice(0,3);
  // Lista textual
  const ul = document.getElementById("topMaquinas");
  ul.innerHTML = "";
  top3.forEach(([nom, tot]) => {
    const li = document.createElement("li");
    li.textContent = `${nom}: $${tot.toFixed(2)}`;
    ul.appendChild(li);
  });
  // Gráfico
  const ctx = document.getElementById("graficaVolumenes").getContext("2d");
  if (chartTop) chartTop.destroy();
  chartTop = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top3.map(t=>t[0]),
      datasets: [{ label:"Ingresos", data: top3.map(t=>t[1]), backgroundColor: "rgba(54,162,235,0.6)" }]
    },
    options: { responsive:true, plugins:{ legend:{display:false}, title:{display:true, text:"Top 3 Máquinas por Ingreso"} } },
    plugins: [ChartDataLabels]
  });
}

function actualizarGraficaLitros(ventas) {
  // Agrupar litros por máquina (todos, no solo top)
  const resumen = {};
  ventas.forEach(v => {
    const nombre = maquinaMap[v.maquina_id] || `Máquina ${v.maquina_id}`;
    resumen[nombre] = (resumen[nombre] || 0) + (v.litros || 0);
  });
  const entries = Object.entries(resumen);
  const ctx = document.getElementById("graficaLitros").getContext("2d");
  if (chartLitros) chartLitros.destroy();
  chartLitros = new Chart(ctx, {
    type: "bar",
    data: {
      labels: entries.map(e=>e[0]),
      datasets: [{ label:"Litros vendidos", data: entries.map(e=>e[1]), backgroundColor: "rgba(75,192,192,0.6)" }]
    },
    options: { responsive:true, plugins:{ legend:{display:false}, title:{display:true, text:"Litros por Máquina"} } }
  });
}

function actualizarGraficaVentasDiarias(ventas) {
  // Grupo por fecha (YYYY-MM-DD)
  const resumen = {};
  ventas.forEach(v => {
    const dia = v.fecha.split("T")[0];
    resumen[dia] = (resumen[dia] || 0) + 1;
  });
  const dias = Object.keys(resumen).sort();
  const datos = dias.map(d=>resumen[d]);
  const ctx = document.getElementById("graficaVentasDiarias").getContext("2d");
  if (chartVentasDiarias) chartVentasDiarias.destroy();
  chartVentasDiarias = new Chart(ctx, {
    type: "line",
    data: {
      labels: dias,
      datasets: [{ label:"Ventas diarias", data:datos, fill:false, tension:0.3 }]
    },
    options: { responsive:true, plugins:{ legend:{display:false}, title:{display:true, text:"Tendencia de Ventas Diarias"} } }
  });
}

function actualizarGraficaTipoVolumen(ventas) {
  // Distribución de litros (pie)
  const resumen = {};
  ventas.forEach(v => {
    const nombre = maquinaMap[v.maquina_id] || `Máquina ${v.maquina_id}`;
    resumen[nombre] = (resumen[nombre] || 0) + (v.litros || 0);
  });
  const entries = Object.entries(resumen);
  const ctx = document.getElementById("graficaTipoVolumen").getContext("2d");
  if (chartTipoVolumen) chartTipoVolumen.destroy();
  chartTipoVolumen = new Chart(ctx, {
    type: "pie",
    data: {
      labels: entries.map(e=>e[0]),
      datasets: [{
        data: entries.map(e=>e[1]),
        backgroundColor: [
          "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"
        ]
      }]
    },
    options: { responsive:true, plugins:{ title:{display:true, text:"Distribución de Litros por Máquina"} } }
  });
}

function exportarCSV() {
  if (!ventasActuales.length) {
    return alert("No hay datos para exportar.");
  }
  const headers = Object.keys(ventasActuales[0]);
  const rows = ventasActuales.map(v => headers.map(h=> v[h] ?? ""));
  let csv = [headers.join(","), ...rows.map(r=>r.join(","))].join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "ventas.csv"; a.click();
  URL.revokeObjectURL(url);
}

function cerrarSesion() {
  supabase.auth.signOut().then(() => window.location.href = "login.html");
}
