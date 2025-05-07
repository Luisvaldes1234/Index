// === Inicializar Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
let ventasActuales = [];

// === Al cargar la página ===
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = "login.html";

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById("fechaInicioResumen").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaFinResumen").value = hoy.toISOString().split("T")[0];

  // Cargar máquinas
  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("id, nombre")
    .eq("usuario_id", user.id);

  if (error) {
    console.error("Error al cargar máquinas:", error.message);
    return;
  }

  const select = document.getElementById("filtroMaquina");
  maquinas.forEach(m => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.nombre || `Máquina ${m.id}`;
    select.appendChild(option);
  });

  actualizarResumen();
});

async function actualizarResumen() {
  const maquinaSeleccionada = document.getElementById("filtroMaquina").value;
  const fechaInicio = document.getElementById("fechaInicioResumen").value;
  const fechaFin = document.getElementById("fechaFinResumen").value;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let query = supabase
    .from("ventas")
    .select("*")
    .eq("usuario_id", user.id)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);

  if (maquinaSeleccionada !== "todas") {
    query = query.eq("maquina_id", maquinaSeleccionada);
  }

  const { data: ventas, error } = await query;

  if (error) {
    console.error("Error al obtener ventas:", error.message);
    return;
  }

  ventasActuales = ventas; // Guardar para CSV

  let totalVentas = 0;
  let litrosTotales = 0;
  ventas.forEach(v => {
    totalVentas += v.total || 0;
    litrosTotales += v.litros || 0;
  });

  const ticketPromedio = ventas.length ? totalVentas / ventas.length : 0;

  document.getElementById("ventasTotales").textContent = `$${totalVentas.toFixed(2)}`;
  document.getElementById("litrosTotales").textContent = `${litrosTotales} L`;
  document.getElementById("ticketPromedio").textContent = `$${ticketPromedio.toFixed(2)}`;
  document.getElementById("cantidadVentas").textContent = ventas.length;

  actualizarGraficaTop(ventas);
}

function actualizarGraficaTop(ventas) {
  const resumen = {};
  ventas.forEach(v => {
    const nombre = `Máquina ${v.maquina_id}`;
    resumen[nombre] = (resumen[nombre] || 0) + (v.total || 0);
  });

  const top = Object.entries(resumen)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const ul = document.getElementById("topMaquinas");
  ul.innerHTML = "";
  top.forEach(([nombre, total]) => {
    const li = document.createElement("li");
    li.textContent = `${nombre}: $${total.toFixed(2)}`;
    ul.appendChild(li);
  });

  const ctx = document.getElementById("graficaVolumenes").getContext("2d");
  if (window.graficaTop) window.graficaTop.destroy();

  window.graficaTop = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(t => t[0]),
      datasets: [{
        label: "Ingresos",
        data: top.map(t => t[1]),
        backgroundColor: "rgba(54, 162, 235, 0.6)"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Top 3 Máquinas por Ingreso" }
      }
    }
  });
}

function cerrarSesion() {
  supabase.auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}

function exportarCSV() {
  if (!ventasActuales.length) {
    alert("No hay datos para exportar");
    return;
  }

  const encabezado = Object.keys(ventasActuales[0]);
  const filas = ventasActuales.map(obj => encabezado.map(col => obj[col] ?? ""));

  let contenidoCSV = [encabezado.join(",")];
  filas.forEach(fila => contenidoCSV.push(fila.join(",")));

  const blob = new Blob([contenidoCSV.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ventas.csv";
  a.click();
  URL.revokeObjectURL(url);
}
