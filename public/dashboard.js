// dashboard.js

// 1) Inicializar Supabase
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2) Variables globales para guardar datos y referencias a las gráficas
let ventasActuales = [];
let chartIngresos, chartLitros, chartVentasDiarias, chartTipoVolumen;

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btnAplicar").addEventListener("click", actualizarResumen);
  document.getElementById("btnExportar").addEventListener("click", exportarCSV);
  document.getElementById("btnToggleDark").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = "login.html";

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById("fechaInicioResumen").value = inicioMes.toISOString().slice(0,10);
  document.getElementById("fechaFinResumen").value    = hoy.toISOString().slice(0,10);

  const { data: maquinas, error: errM } = await supabase
    .from("maquinas")
    .select("id, name")
    .eq("user_id", user.id);

  if (errM) {
    console.error("Error al cargar máquinas:", errM.message);
    return;
  }
  const filtro = document.getElementById("filtroMaquina");
  maquinas.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name ?? `Máquina ${m.id}`;
    filtro.appendChild(opt);
  });

  actualizarResumen();
});

async function actualizarResumen() {
  const maquinaId = document.getElementById("filtroMaquina").value;
  const desde = document.getElementById("fechaInicioResumen").value;
  const hasta = document.getElementById("fechaFinResumen").value;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let q = supabase
    .from("ventas")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", desde)
    .lte("created_at", hasta);

  if (maquinaId !== "todas") {
    q = q.eq("serial", Number(maquinaId));
  }

  const { data: ventas, error } = await q;
  if (error) {
    console.error("Error al obtener ventas:", error.message);
    return;
  }
  ventasActuales = ventas;

  const sinVentasEl = document.getElementById("mensajeSinVentas");
  if (ventas.length === 0) {
    sinVentasEl.classList.remove("hidden");
  } else {
    sinVentasEl.classList.add("hidden");
  }

  let totalIngresos = 0, totalLitros = 0;
  ventas.forEach(v => {
    totalIngresos += Number(v.precio_total)  || 0;
    totalLitros   += Number(v.litros) || 0;
  });
  const ticketProm = ventas.length ? totalIngresos / ventas.length : 0;

  document.getElementById("ventasTotales").textContent    = `$${totalIngresos.toFixed(2)}`;
  document.getElementById("litrosTotales").textContent    = `${totalLitros} L`;
  document.getElementById("ticketPromedio").textContent   = `$${ticketProm.toFixed(2)}`;
  document.getElementById("cantidadVentas").textContent   = ventas.length;

  actualizarGraficaIngresos(ventas);
  actualizarGraficaLitros(ventas);
  actualizarGraficaVentasDiarias(ventas);
  actualizarGraficaTipoVolumen(ventas);
}

function actualizarGraficaLitros(ventas) {
  const mapL = {};
  ventas.forEach(v => {
    const label = `Máquina ${v.serial}`;
    mapL[label] = (mapL[label] || 0) + (Number(v.litros) || 0);
  });
  const topL = Object.entries(mapL)
    .sort((a,b) => b[1] - a[1])
    .slice(0,3);

  const ctx = document.getElementById("graficaLitros").getContext("2d");
  if (chartLitros) chartLitros.destroy();
  chartLitros = new Chart(ctx, {
    type: "bar",
    data: {
      labels: topL.map(t => t[0]),
      datasets: [{ label: "Litros", data: topL.map(t => t[1]), backgroundColor: "rgba(75,192,192,0.6)" }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Top 3 Máquinas por Litros Vendidos" }
      }
    }
  });
}
function actualizarGraficaIngresos(ventas) {
  const mapIngresos = {};
  ventas.forEach(v => {
    const label = `Máquina ${v.serial}`;
    mapIngresos[label] = (mapIngresos[label] || 0) + (Number(v.precio_total) || 0);
  });
  const top = Object.entries(mapIngresos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const ul = document.getElementById("topMaquinas");
  ul.innerHTML = "";
  top.forEach(([label, val]) => {
    const li = document.createElement("li");
    li.textContent = `${label}: $${val.toFixed(2)}`;
    ul.appendChild(li);
  });

  const ctx = document.getElementById("graficaVolumenes").getContext("2d");
  if (chartIngresos) chartIngresos.destroy();
  chartIngresos = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(t => t[0]),
      datasets: [{
        label: "Ingresos",
        data: top.map(t => t[1]),
        backgroundColor: "rgba(54,162,235,0.6)"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Top 3 Máquinas por Ingreso" },
        datalabels: {
          anchor: "end",
          align: "top",
          formatter: v => `$${v.toFixed(2)}`,
          color: "#111",
          font: { weight: "bold" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}


function actualizarGraficaVentasDiarias(ventas) {
  const mapD = {};
  ventas.forEach(v => {
    const d = new Date(v.created_at).toISOString().slice(0,10);
    mapD[d] = (mapD[d] || 0) + 1;
  });
  const dias = Object.keys(mapD).sort();
  const ctx = document.getElementById("graficaVentasDiarias").getContext("2d");
  if (chartVentasDiarias) chartVentasDiarias.destroy();
  chartVentasDiarias = new Chart(ctx, {
    type: "line",
    data: {
      labels: dias,
      datasets: [{
        label: "Ventas",
        data: dias.map(d => mapD[d]),
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Tendencia Ventas Diarias" }
      }
    }
  });
}

function actualizarGraficaTipoVolumen(ventas) {
  const mapV = {};
  let suma = 0;
  ventas.forEach(v => {
    const label = `Máquina ${v.serial}`;
    const lit = Number(v.litros) || 0;
    mapV[label] = (mapV[label] || 0) + lit;
    suma += lit;
  });
  const entries = Object.entries(mapV);
  const ctx = document.getElementById("graficaTipoVolumen").getContext("2d");
  if (chartTipoVolumen) chartTipoVolumen.destroy();
  chartTipoVolumen = new Chart(ctx, {
    type: "pie",
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => ((e[1]/suma)*100).toFixed(1)),
        backgroundColor: ['#4ade80','#60a5fa','#facc15','#f87171','#a78bfa']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: "Distribución de Litros (%)" }
      }
    }
  });
}

function exportarCSV() {
  if (!ventasActuales.length) {
    alert("No hay datos para exportar");
    return;
  }
  const cols = Object.keys(ventasActuales[0]);
  const rows = ventasActuales.map(r => cols.map(c => r[c] ?? ""));

  let csv = cols.join(",") + "\n";
  rows.forEach(r => csv += r.join(",") + "\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ventas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function cerrarSesion() {
  supabase.auth.signOut().then(() => window.location.href = "login.html");
}
