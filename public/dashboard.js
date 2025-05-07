// === Inicializar Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Datos actuales para CSV
let ventasActuales = [];

// === Cuando carga la página ===
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Autenticación
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = "login.html";

  // 2) Fechas iniciales (primer día del mes hasta hoy)
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById("fechaInicioResumen").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaFinResumen").value    = hoy.toISOString().split("T")[0];

  // 3) Cargar lista de máquinas
  const { data: maquinas, error: errMaq } = await supabase
    .from("maquinas")
    .select("id, nombre")
    .eq("usuario_id", user.id);
  if (errMaq) {
    console.error("Error al cargar máquinas:", errMaq.message);
    return;
  }
  const select = document.getElementById("filtroMaquina");
  maquinas.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.nombre || `Máquina ${m.id}`;
    select.appendChild(opt);
  });

  // 4) Botones
  document.getElementById("btnAplicar").addEventListener("click", actualizarResumen);
  document.getElementById("btnExportar").addEventListener("click", exportarCSV);
  document.getElementById("btnToggleDark").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
  });

  // 5) Carga inicial
  actualizarResumen();
});


// === Función principal: obtiene ventas y actualiza todo ===
async function actualizarResumen() {
  const maquinaId = document.getElementById("filtroMaquina").value;
  const desde     = document.getElementById("fechaInicioResumen").value;
  const hasta     = document.getElementById("fechaFinResumen").value;

  // volver a obtener user (por seguridad)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Construir consulta
  let q = supabase
    .from("ventas")
    .select("*")
    .eq("usuario_id", user.id)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  if (maquinaId !== "todas") q = q.eq("maquina_id", maquinaId);

  const { data: ventas, error } = await q;
  if (error) {
    console.error("Error al obtener ventas:", error.message);
    return;
  }

  // Guardar para CSV
  ventasActuales = ventas;

  // 1) Desempeño económico
  let total = 0, litros = 0;
  ventas.forEach(v => {
    total  += v.total  || 0;
    litros += v.litros || 0;
  });
  const ticketProm = ventas.length ? (total / ventas.length) : 0;

  document.getElementById("ventasTotales").textContent  = `$${total.toFixed(2)}`;
  document.getElementById("litrosTotales").textContent  = `${litros} L`;
  document.getElementById("ticketPromedio").textContent = `$${ticketProm.toFixed(2)}`;
  document.getElementById("cantidadVentas").textContent = ventas.length;

  // 2–5) Actualizar gráficas
  actualizarGraficaTop(ventas);
  actualizarGraficaLitros(ventas);
  actualizarGraficaVentasDiarias(ventas);
  actualizarGraficaTipoVolumen(ventas);
}


// === Gráfica 1: Top 3 Máquinas por Ingreso ===
function actualizarGraficaTop(ventas) {
  const agg = {};
  ventas.forEach(v => {
    const key = `Máquina ${v.maquina_id}`;
    agg[key] = (agg[key] || 0) + (v.total || 0);
  });
  const top = Object.entries(agg)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3);

  // Lista textual
  const ul = document.getElementById("topMaquinas");
  ul.innerHTML = "";
  top.forEach(([name,val])=>{
    const li = document.createElement("li");
    li.textContent = `${name}: $${val.toFixed(2)}`;
    ul.appendChild(li);
  });

  // Bar chart
  const ctx = document.getElementById("graficaVolumenes").getContext("2d");
  if (window.graficaTop) window.graficaTop.destroy();
  window.graficaTop = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(t=>t[0]),
      datasets:[{
        label:"Ingresos",
        data: top.map(t=>t[1]),
        backgroundColor:"rgba(54,162,235,0.6)"
      }]
    },
    options:{
      responsive:true,
      plugins:{ 
        legend:{ display:false },
        title:{ display:true, text:"Top 3 Máquinas por Ingreso" }
      }
    }
  });
}


// === Gráfica 2: Litros Vendidos por Máquina ===
function actualizarGraficaLitros(ventas) {
  const agg = {};
  ventas.forEach(v => {
    const key = `Máquina ${v.maquina_id}`;
    agg[key] = (agg[key] || 0) + (v.litros || 0);
  });
  const top = Object.entries(agg)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3);

  const ctx = document.getElementById("graficaLitros").getContext("2d");
  if (window.graficaLitros) window.graficaLitros.destroy();
  window.graficaLitros = new Chart(ctx, {
    type: "bar",
    data:{
      labels: top.map(t=>t[0]),
      datasets:[{
        label:"Litros",
        data: top.map(t=>t[1]),
        backgroundColor:"rgba(75,192,192,0.6)"
      }]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{ display:false },
        title:{ display:true, text:"Top 3 Máquinas por Litros Vendidos" }
      }
    }
  });
}


// === Gráfica 3: Tendencia de Ventas Diarias (total diario) ===
function actualizarGraficaVentasDiarias(ventas) {
  const agg = {};
  ventas.forEach(v => {
    const d = new Date(v.fecha).toISOString().split("T")[0];
    agg[d] = (agg[d]||0) + (v.total||0);
  });
  const labels = Object.keys(agg).sort();
  const data   = labels.map(l=>agg[l]);

  const ctx = document.getElementById("graficaVentasDiarias").getContext("2d");
  if (window.graficaVentas) window.graficaVentas.destroy();
  window.graficaVentas = new Chart(ctx, {
    type:"line",
    data:{ labels, datasets:[{
      label:"Ventas diarias ($)",
      data,
      fill:false,
      tension:0.3
    }]},
    options:{
      responsive:true,
      plugins:{ title:{ display:true, text:"Tendencia de Ventas Diarias" } }
    }
  });
}


// === Gráfica 4: Distribución por Tipo de Volumen (litros escala) ===
function actualizarGraficaTipoVolumen(ventas) {
  // Reutilizamos la agregación de litros por máquina
  const agg = {};
  ventas.forEach(v => {
    const key = `Máquina ${v.maquina_id}`;
    agg[key] = (agg[key] || 0) + (v.litros || 0);
  });
  const labels = Object.keys(agg);
  const data   = labels.map(l=>agg[l]);

  const ctx = document.getElementById("graficaTipoVolumen").getContext("2d");
  if (window.graficaTipo) window.graficaTipo.destroy();
  window.graficaTipo = new Chart(ctx, {
    type:"pie",
    data:{ labels, datasets:[{ data, backgroundColor:[
      "rgba(54,162,235,0.6)","rgba(75,192,192,0.6)","rgba(255,205,86,0.6)"
    ]}]},
    options:{
      responsive:true,
      plugins:{ title:{ display:true, text:"Distribución de Litros por Máquina" } }
    }
  });
}


// === Exportar CSV ===
function exportarCSV() {
  if (!ventasActuales.length) return alert("No hay datos para exportar");
  const header = Object.keys(ventasActuales[0]);
  const rows = ventasActuales.map(r=> header.map(c=> r[c] ?? ""));
  let csv = [header.join(",")].concat(rows.map(r=> r.join(","))).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "ventas.csv"; a.click();
  URL.revokeObjectURL(url);
}


// === Cerrar Sesión ===
function cerrarSesion() {
  supabase.auth.signOut().then(() => window.location.href = "login.html");
}
