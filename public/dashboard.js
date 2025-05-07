// === Conexión a Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Variables para gráficas ===
let graficaMaquinas = null;
let graficaHorarios = null;
let graficaVentasPorDia = null;
let graficaVolumenes = null;

// === Al cargar la página ===
document.addEventListener("DOMContentLoaded", () => {
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("fechaInicioResumen").value = hoy;
  document.getElementById("fechaFinResumen").value = hoy;
  actualizarResumen();
});

// === Función principal: actualizar resumen ===
async function actualizarResumen() {
  const inicio = document.getElementById("fechaInicioResumen").value;
  const fin = document.getElementById("fechaFinResumen").value;

  if (!inicio || !fin) {
    alert("Selecciona un rango de fechas válido.");
    return;
  }

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("fecha", inicio)
    .lte("fecha", fin);

  if (error) {
    console.error("Error obteniendo ventas:", error);
    return;
  }

  actualizarCuadrosResumen(ventas);
  cargarGraficaPorMaquina(ventas);
  cargarGraficaPorHorario(ventas);
  cargarGraficaVentasPorDia(ventas);
  cargarGraficaVolumenes(ventas);
  mostrarTopMaquinas(ventas);
}
// === Actualizar los cuadros de resumen ===
function actualizarCuadrosResumen(ventas) {
  let total = 0;
  let litros = 0;
  const conteo = {};

  ventas.forEach(v => {
    total += v.total;
    litros += v.volumen_litros;
    const clave = `${v.volumen_litros}L`;
    conteo[clave] = (conteo[clave] || 0) + 1;
  });

  const ticketProm = ventas.length ? total / ventas.length : 0;

  document.getElementById("ventasTotales").innerText = `$${total.toFixed(2)}`;
  document.getElementById("litrosTotales").innerText = `${litros} L`;
  document.getElementById("ticketPromedio").innerText = `$${ticketProm.toFixed(2)}`;
  document.getElementById("cantidadVentas").innerText = ventas.length;
}

// === Gráfica: Ventas por máquina ===
function cargarGraficaPorMaquina(ventas) {
  const totales = {};
  ventas.forEach(v => {
    const id = v.machine_id || v.maquina_id;
    totales[id] = (totales[id] || 0) + v.total;
  });

  const labels = Object.keys(totales);
  const datos = Object.values(totales);

  if (graficaMaquinas) graficaMaquinas.destroy();

  const ctx = document.getElementById("graficaVentasMaquina").getContext("2d");
  graficaMaquinas = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Ventas $",
        data: datos,
        backgroundColor: "rgba(54, 162, 235, 0.6)"
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// === Gráfica: Ventas por horario ===
function cargarGraficaPorHorario(ventas) {
  const rangos = {
    "00:00 – 08:00": 0,
    "08:01 – 16:00": 0,
    "16:01 – 23:59": 0
  };

  ventas.forEach(v => {
    const hora = new Date(v.fecha).getHours();
    if (hora <= 8) rangos["00:00 – 08:00"] += v.total;
    else if (hora <= 16) rangos["08:01 – 16:00"] += v.total;
    else rangos["16:01 – 23:59"] += v.total;
  });

  if (graficaHorarios) graficaHorarios.destroy();

  const ctx = document.getElementById("graficaHorarios").getContext("2d");
  graficaHorarios = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(rangos),
      datasets: [{
        label: "Ventas por horario ($)",
        data: Object.values(rangos),
        backgroundColor: "rgba(255, 159, 64, 0.6)"
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// === Gráfica: Tendencia diaria ===
function cargarGraficaVentasPorDia(ventas) {
  const agrupado = {};

  ventas.forEach(v => {
    const fecha = new Date(v.fecha).toISOString().split("T")[0];
    agrupado[fecha] = (agrupado[fecha] || 0) + v.total;
  });

  const fechas = Object.keys(agrupado).sort();
  const montos = fechas.map(f => agrupado[f]);

  if (graficaVentasPorDia) graficaVentasPorDia.destroy();

  const ctx = document.getElementById("graficaVentasPorDia").getContext("2d");
  graficaVentasPorDia = new Chart(ctx, {
    type: "line",
    data: {
      labels: fechas,
      datasets: [{
        label: "Ventas por día ($)",
        data: montos,
        borderColor: "rgba(75, 192, 192, 1)",
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}
// === Gráfica: Distribución por volumen (pastel) ===
function cargarGraficaVolumenes(ventas) {
  const conteo = {};
  ventas.forEach(v => {
    const clave = `${v.volumen_litros}L`;
    conteo[clave] = (conteo[clave] || 0) + 1;
  });

  const labels = Object.keys(conteo);
  const datos = Object.values(conteo);
  const colores = labels.map((_, i) => `hsl(${i * 90}, 70%, 60%)`);

  if (graficaVolumenes) graficaVolumenes.destroy();

  const ctx = document.getElementById("graficaVolumenes").getContext("2d");
  graficaVolumenes = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: datos,
        backgroundColor: colores
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

// === Lista: Top 3 máquinas por ventas ===
function mostrarTopMaquinas(ventas) {
  const totales = {};
  ventas.forEach(v => {
    const id = v.machine_id || v.maquina_id;
    totales[id] = (totales[id] || 0) + v.total;
  });

  const top = Object.entries(totales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const lista = document.getElementById("topMaquinas");
  lista.innerHTML = '';

  top.forEach(([id, total]) => {
    const li = document.createElement("li");
    li.innerText = `Máquina ${id}: $${total.toFixed(2)}`;
    lista.appendChild(li);
  });
}
