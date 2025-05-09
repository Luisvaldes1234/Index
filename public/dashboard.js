// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
let user = null;

document.addEventListener('DOMContentLoaded', getUser);

async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    return;
  }
  user = currentUser;
  cargarResumen();
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

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = hoy.toISOString();

  // 1. Ventas de hoy
  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", fechaInicio);

  if (error) return console.error("Error al cargar ventas:", error);

  if (ventas.length) {
    resumen.litros = ventas.reduce((sum, v) => sum + (parseFloat(v.litros) || 0), 0);
    resumen.total = ventas.reduce((sum, v) => sum + (parseFloat(v.precio_total) || 0), 0);
    resumen.ticket = resumen.total / ventas.length;
    resumen.ultima = ventas[ventas.length - 1].created_at;
  }

  // 2. Máquinas activas
  const { data: maquinas, error: errMaquinas } = await supabase
    .from("maquinas")
    .select("*")
    .eq("user_id", user.id);

  if (!errMaquinas && maquinas) {
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

// === MOSTRAR TARJETAS ===
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
document.addEventListener("DOMContentLoaded", () => {
  cargarGraficas();
});

async function cargarGraficas() {
  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*");

  if (error || !ventas) return console.error("Error al cargar ventas:", error);

  renderGraficaHoras(ventas);
  renderGraficaDias(ventas);
  renderGraficaVolumen(ventas);
  renderGraficaMaquinas(ventas);
  renderTabla(ventas);
}

function renderGraficaHoras(ventas) {
  const horas = Array(24).fill(0);
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    horas[h] += parseFloat(v.precio_total) || 0;
  });
  new Chart(document.getElementById("graficaHoras"), {
    type: "bar",
    data: {
      labels: [...Array(24).keys()].map(h => `${h}:00`),
      datasets: [{
        label: "Ventas por hora ($)",
        data: horas
      }]
    }
  });
}

function renderGraficaDias(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
    mapa[fecha] = (mapa[fecha] || 0) + parseFloat(v.precio_total || 0);
  });

  const fechas = Object.keys(mapa).sort().slice(-7);
  const valores = fechas.map(f => mapa[f]);

  new Chart(document.getElementById("graficaDias"), {
    type: "line",
    data: {
      labels: fechas,
      datasets: [{
        label: "Ventas diarias ($)",
        data: valores,
        tension: 0.3
      }]
    }
  });
}

function renderGraficaVolumen(ventas) {
  const conteo = { "5": 0, "10": 0, "20": 0 };
  ventas.forEach(v => {
    const l = parseInt(v.litros);
    if (conteo[l] !== undefined) conteo[l]++;
  });

  new Chart(document.getElementById("graficaVolumen"), {
    type: "pie",
    data: {
      labels: ["5L", "10L", "20L"],
      datasets: [{
        data: [conteo["5"], conteo["10"], conteo["20"]]
      }]
    }
  });
}

async function renderGraficaMaquinas(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    if (!v.serial) return;
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total || 0);
  });

  const labels = Object.keys(mapa);
  const valores = labels.map(l => mapa[l]);

  new Chart(document.getElementById("graficaMaquinas"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ventas por máquina ($)",
        data: valores
      }]
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
