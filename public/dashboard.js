// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let mapaNombreMaquina = {};

document.addEventListener("DOMContentLoaded", getUser);

async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    return;
  }
  user = currentUser;
  await cargarMaquinasParaCSV();

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = ahora.toISOString().split("T")[0];

  cargarResumen();
  cargarGraficas();
}

async function cargarMaquinasParaCSV() {
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("serial, nombre, ultimo_corte")
    .eq("user_id", user.id);

  const select = document.getElementById("filtroMaquinaCSV");
  const contenedor = document.getElementById("listaMaquinasCorte");
  select.innerHTML = "";
  contenedor.innerHTML = "";

  const todas = document.createElement("option");
  todas.value = "";
  todas.textContent = "Todas las máquinas";
  select.appendChild(todas);

  mapaNombreMaquina = {};

  for (const m of maquinas) {
    mapaNombreMaquina[m.serial] = m.nombre || m.serial;

    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.nombre || m.serial;
    select.appendChild(op);

    const { data: ventas } = await supabase
      .from("ventas")
      .select("precio_total")
      .eq("serial", m.serial)
      .gte("created_at", m.ultimo_corte || "2000-01-01T00:00:00Z");

    const total = ventas?.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0) || 0;
    let color = "bg-yellow-400 text-black";
    if (total >= 500) color = "bg-green-500 text-white";
    if (total >= 2000) color = "bg-red-600 text-white";

    const div = document.createElement("div");
    div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow";

    div.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <p>💧 ${m.nombre || m.serial}</p>
        <button class="bg-blue-600 text-white px-3 py-1 rounded" onclick="hacerCorteDeCaja('${m.serial}')">Corte de caja</button>
      </div>
      <div class="${color} p-2 rounded text-center text-sm font-semibold">
        $${total.toFixed(2)} desde último corte
      </div>
    `;

    contenedor.appendChild(div);
  }
}

async function hacerCorteDeCaja(serial) {
  if (!confirm("¿Estás seguro de hacer el corte de caja?")) return;

  await supabase.from("maquinas")
    .update({ ultimo_corte: new Date().toISOString() })
    .eq("serial", serial);

  alert("Corte realizado");
  cargarResumen();
  cargarGraficas();
  cargarMaquinasParaCSV();
}

["fechaDesde", "fechaHasta", "filtroMaquinaCSV"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    cargarGraficas();
  });
});

async function cargarResumen() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const resumen = { litros: 0, total: 0, ultima: null, ticket: 0, activas: 0, cantidad: 0 };

  const { data: maquinas } = await supabase.from("maquinas").select("serial, last_seen").eq("user_id", user.id);
  const { data: ventas } = await supabase.from("ventas").select("*");

  const ahora = new Date();
  resumen.cantidad = maquinas.length;
  resumen.activas = maquinas.filter(m => (new Date() - new Date(m.last_seen)) / 60000 < 10).length;

  const hoyVentas = ventas.filter(v => new Date(v.created_at) >= hoy);

  if (hoyVentas.length) {
    resumen.litros = hoyVentas.reduce((s, v) => s + (parseFloat(v.litros) || 0), 0);
    resumen.total = hoyVentas.reduce((s, v) => s + (parseFloat(v.precio_total) || 0), 0);
    resumen.ticket = resumen.total / hoyVentas.length;
    resumen.ultima = hoyVentas[hoyVentas.length - 1].created_at;
  }

  renderResumen(resumen);

  const semanaInicio = new Date();
  semanaInicio.setDate(semanaInicio.getDate() - semanaInicio.getDay());
  semanaInicio.setHours(0, 0, 0, 0);
  const mesInicio = new Date();
  mesInicio.setDate(1);
  mesInicio.setHours(0, 0, 0, 0);

  const totalSemana = ventas.filter(v => new Date(v.created_at) >= semanaInicio)
    .reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);
  const totalMes = ventas.filter(v => new Date(v.created_at) >= mesInicio)
    .reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);

  document.getElementById("ventasSemana").textContent = `$${totalSemana.toFixed(2)}`;
  document.getElementById("ventasMes").textContent = `$${totalMes.toFixed(2)}`;
}

function renderResumen(r) {
  document.getElementById("resumen").innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Litros vendidos hoy</p><h2>${r.litros.toFixed(1)} L</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Ventas totales hoy</p><h2>$${r.total.toFixed(2)}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Ticket promedio</p><h2>$${r.ticket.toFixed(2)}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Máquinas activas</p><h2>${r.activas}/${r.cantidad}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Última venta</p><h2>${r.ultima ? new Date(r.ultima).toLocaleString("es-MX") : "N/A"}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Ventas esta semana</p><h2 id="ventasSemana">$0.00</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Ventas este mes</p><h2 id="ventasMes">$0.00</h2></div>
  `;
}

async function cargarGraficas() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const serial = document.getElementById("filtroMaquinaCSV").value;

  if (!desde || !hasta) return;

  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + "T23:59:59").toISOString();

  const { data: ventas } = await supabase
    .from("ventas")
    .select("*")
    .gte("created_at", desdeISO)
    .lte("created_at", hastaISO);

  const filtradas = serial ? ventas.filter(v => v.serial === serial) : ventas;

  renderGraficaHoras(filtradas);
  renderGraficaDias(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas);
}

function renderGraficaHoras(ventas) {
  const horas = Array(24).fill(0);
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    horas[h] += parseFloat(v.precio_total || 0);
  });

  const ctx = document.getElementById("graficaHoras");
  if (window.chartHoras) window.chartHoras.destroy();
  window.chartHoras = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [...Array(24).keys()].map(h => `${h}:00`),
      datasets: [{ label: "Ventas por hora ($)", data: horas, backgroundColor: "#60a5fa" }]
    }
  });
}

function renderGraficaDias(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString("es-MX");
    mapa[fecha] = (mapa[fecha] || 0) + parseFloat(v.precio_total || 0);
  });

  const labels = Object.keys(mapa);
  const valores = labels.map(k => mapa[k]);

  const ctx = document.getElementById("graficaDias");
  if (window.chartDias) window.chartDias.destroy();
  window.chartDias = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Ventas por día ($)", data: valores, borderColor: "#3b82f6", backgroundColor: "#bfdbfe" }]
    }
  });
}

function renderGraficaVolumen(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.litros || 0);
  });

  const labels = Object.keys(mapa).map(s => mapaNombreMaquina[s] || s);
  const valores = Object.values(mapa);

  const ctx = document.getElementById("graficaVolumen");
  if (window.chartVolumen) window.chartVolumen.destroy();
  window.chartVolumen = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Litros vendidos por máquina", data: valores, backgroundColor: "#10b981" }]
    }
  });
}

function renderGraficaMaquinas(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total || 0);
  });

  const labels = Object.keys(mapa).map(s => mapaNombreMaquina[s] || s);
  const valores = Object.values(mapa);

  const ctx = document.getElementById("graficaMaquinas");
  if (window.chartMaquinas) window.chartMaquinas.destroy();
  window.chartMaquinas = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Ventas por máquina ($)", data: valores, backgroundColor: "#f59e0b" }]
    }
  });
}
