const supabase = window.supabase.createClient(
  'https://ikuouxllerfjnibjtlkl.supabase.co',
  window.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let ventas = [];
let maquinasActivas = [];

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert("No autenticado");

  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("serial, suscripcion_hasta")
    .eq("user_id", user.id);

  if (error) return alert("Error al cargar máquinas");

  maquinasActivas = maquinas
    .filter(m => m.suscripcion_hasta && new Date(m.suscripcion_hasta) > new Date())
    .map(m => m.serial);

  maquinas
    .filter(m => !maquinasActivas.includes(m.serial))
    .forEach(m => console.warn("Máquina oculta por suscripción vencida:", m.serial));

  cargarVentas();
});

async function cargarVentas() {
  const desde = document.getElementById("fechaDesde");
  const hasta = document.getElementById("fechaHasta");

  const inicio = desde.value ? new Date(desde.value) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const fin = hasta.value ? new Date(hasta.value + "T23:59:59") : new Date();

  const { data, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", inicio.toISOString())
    .lte("created_at", fin.toISOString());

  if (error) return alert("Error cargando ventas");

  ventas = data.filter(v => maquinasActivas.includes(v.serial));
  actualizarResumen();
  actualizarGraficas();
  actualizarCSVSelector();
}
function actualizarResumen() {
  const resumen = {
    totalLitros: 0,
    totalVentas: 0,
    ticketPromedio: 0,
    maquinasActivas: new Set(),
  };

  ventas.forEach(v => {
    resumen.totalLitros += v.litros;
    resumen.totalVentas += v.precio_total;
    resumen.maquinasActivas.add(v.serial);
  });

  resumen.ticketPromedio = ventas.length
    ? resumen.totalVentas / ventas.length
    : 0;

  document.getElementById("resumen").innerHTML = `
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">💧 <strong>${resumen.totalLitros.toFixed(1)}</strong> litros vendidos</div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">💰 $<strong>${resumen.totalVentas.toFixed(2)}</strong> en ventas</div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">🎟️ Ticket promedio: $<strong>${resumen.ticketPromedio.toFixed(2)}</strong></div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">🖥️ Máquinas activas: <strong>${resumen.maquinasActivas.size}</strong></div>
  `;
}

function actualizarCSVSelector() {
  const select = document.getElementById("filtroMaquinaCSV");
  select.innerHTML = `<option value="">Todas</option>`;
  maquinasActivas.forEach(serial => {
    select.innerHTML += `<option value="${serial}">${serial}</option>`;
  });
}

async function descargarCSV() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const filtro = document.getElementById("filtroMaquinaCSV").value;

  const seleccionadas = ventas.filter(v =>
    (!filtro || v.serial === filtro)
  );

  const encabezados = ["Fecha", "Hora", "Máquina", "Litros", "Precio"];
  const filas = seleccionadas.map(v => {
    const fecha = new Date(v.created_at);
    return [
      fecha.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }),
      fecha.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" }),
      v.serial,
      v.litros,
      v.precio_total.toFixed(2)
    ];
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
function actualizarGraficas() {
  const porHora = Array(24).fill(0);
  const porDia = {};
  const porVolumen = { "5L": 0, "10L": 0, "20L": 0 };
  const porMaquina = {};

  ventas.forEach(v => {
    const fecha = new Date(v.created_at);
    const hora = fecha.getHours();
    const dia = fecha.toLocaleDateString("es-MX");
    porHora[hora]++;
    porDia[dia] = (porDia[dia] || 0) + v.precio_total;

    if (v.litros <= 5.5) porVolumen["5L"] += v.litros;
    else if (v.litros <= 11) porVolumen["10L"] += v.litros;
    else porVolumen["20L"] += v.litros;

    porMaquina[v.serial] = (porMaquina[v.serial] || 0) + v.precio_total;
  });

  renderBarChart("graficaHoras", porHora, "Ventas por hora", [...Array(24).keys()].map(h => h + ":00"));
  renderBarChart("graficaDias", Object.values(porDia), "Ventas por día", Object.keys(porDia));
  renderBarChart("graficaVolumen", Object.values(porVolumen), "Volumen vendido", Object.keys(porVolumen));
  renderBarChart("graficaMaquinas", Object.values(porMaquina), "Rendimiento por máquina", Object.keys(porMaquina));
}

function renderBarChart(id, data, label, labels) {
  const ctx = document.getElementById(id).getContext("2d");
  if (window[id]) window[id].destroy(); // Eliminar si ya existe
  window[id] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

