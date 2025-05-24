// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;

// === INICIO ===
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
  mostrarDineroMaquina();
}

// === MÁQUINAS Y CORTE ===
async function cargarMaquinasParaCSV() {
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("serial, nombre, ultimo_corte")
    .eq("user_id", user.id);

  const select = document.getElementById("filtroMaquinaCSV");
  const contenedor = document.getElementById("listaMaquinasCorte");
  select.innerHTML = "";
  contenedor.innerHTML = "";

  maquinas.forEach(m => {
    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.nombre || m.serial;
    select.appendChild(op);

    const div = document.createElement("div");
    div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow flex justify-between items-center mb-2";

    const texto = document.createElement("p");
    texto.textContent = `💧 ${m.nombre || m.serial}`;

    const boton = document.createElement("button");
    boton.textContent = "Corte de caja";
    boton.className = "bg-blue-600 text-white px-3 py-1 rounded";
    boton.onclick = () => hacerCorteDeCaja(m.serial);

    div.appendChild(texto);
    div.appendChild(boton);
    contenedor.appendChild(div);
  });
}

async function hacerCorteDeCaja(serial) {
  if (!confirm("¿Estás seguro de hacer el corte de caja?")) return;

  await supabase.from("maquinas")
    .update({ ultimo_corte: new Date().toISOString() })
    .eq("serial", serial);

  alert("Corte realizado");
  cargarResumen();
  cargarGraficas();
  mostrarDineroMaquina();
}

// === FILTROS ===
["fechaDesde", "fechaHasta", "filtroMaquinaCSV"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    cargarGraficas();
    mostrarDineroMaquina();
  });
});

// === RESUMEN ===
async function cargarResumen() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const resumen = { litros: 0, total: 0, ultima: null, ticket: 0, activas: 0, cantidad: 0 };

  const { data: maquinas } = await supabase.from("maquinas").select("serial, last_seen").eq("user_id", user.id);
  const { data: ventas } = await supabase.from("ventas").select("*").gte("created_at", hoy.toISOString());

  const ahora = new Date();
  resumen.cantidad = maquinas.length;
  resumen.activas = maquinas.filter(m => (new Date() - new Date(m.last_seen)) / 60000 < 10).length;

  if (ventas.length) {
    resumen.litros = ventas.reduce((s, v) => s + (parseFloat(v.litros) || 0), 0);
    resumen.total = ventas.reduce((s, v) => s + (parseFloat(v.precio_total) || 0), 0);
    resumen.ticket = resumen.total / ventas.length;
    resumen.ultima = ventas[ventas.length - 1].created_at;
  }

  renderResumen(resumen);
}

function renderResumen(r) {
  document.getElementById("resumen").innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Litros vendidos hoy</p><h2>${r.litros.toFixed(1)} L</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Ventas totales hoy</p><h2>$${r.total.toFixed(2)}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Ticket promedio</p><h2>$${r.ticket.toFixed(2)}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Máquinas activas</p><h2>${r.activas}/${r.cantidad}</h2></div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow"><p>Última venta</p><h2>${r.ultima ? new Date(r.ultima).toLocaleString("es-MX") : "N/A"}</h2></div>
  `;
}

// === DINERO DESDE ÚLTIMO CORTE ===
async function mostrarDineroMaquina() {
  const serial = document.getElementById("filtroMaquinaCSV").value;
  const contenedor = document.getElementById("dineroMaquina");
  contenedor.innerHTML = ""; contenedor.classList.add("hidden");
  if (!serial) return;

  const { data: maquina } = await supabase.from("maquinas").select("ultimo_corte").eq("serial", serial).single();
  const corte = maquina?.ultimo_corte || "2000-01-01T00:00:00Z";

  const { data: ventas } = await supabase
    .from("ventas")
    .select("precio_total")
    .eq("serial", serial)
    .gte("created_at", corte);

  const total = ventas?.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0) || 0;

  let color = "bg-yellow-400 text-black";
  if (total >= 500) color = "bg-green-500 text-white";
  if (total >= 2000) color = "bg-red-600 text-white";

  contenedor.classList.remove("hidden");
  contenedor.innerHTML = `
    <div class="${color} p-4 rounded shadow text-center">
      <p class="text-sm font-semibold">Dinero en máquina desde el último corte</p>
      <h2 class="text-3xl font-bold mt-1">$${total.toFixed(2)}</h2>
    </div>
  `;
}

// === EXPORTAR CSV ===
document.getElementById("btnDescargarCSV").addEventListener("click", descargarCSV);

async function descargarCSV() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const serial = document.getElementById("filtroMaquinaCSV").value;
  if (!desde || !hasta) return alert("Selecciona fechas válidas");

  const hastaCompleta = new Date(hasta + "T23:59:59").toISOString();

  const { data: maquinas } = await supabase.from("maquinas").select("serial, ultimo_corte").eq("user_id", user.id);
  const cortes = Object.fromEntries(maquinas.map(m => [m.serial, m.ultimo_corte || "2000-01-01T00:00:00Z"]));

  const { data: ventas } = await supabase.from("ventas").select("*").gte("created_at", desde).lte("created_at", hastaCompleta);

  const filtradas = ventas.filter(v => {
    if (serial && v.serial !== serial) return false;
    return new Date(v.created_at) > new Date(cortes[v.serial] || "2000-01-01T00:00:00Z");
  });

  if (filtradas.length === 0) return alert("No hay ventas para exportar");

  const csv = [
    ["Fecha", "Litros", "Precio", "Botón", "Máquina"],
    ...filtradas.map(v => [
      new Date(v.created_at).toLocaleString("es-MX"),
      v.litros,
      v.precio_total,
      v.boton,
      v.serial
    ])
  ].map(r => r.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ventas_${desde}_a_${hasta}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// === GRÁFICAS ===
// (Esta sección permanece sin cambios, pero puedes avisarme si también deseas ajustarlas)
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

  renderGraficaDias(filtradas);
  renderGraficaHoras(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas);
}

function renderGraficaDias(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString("es-MX");
    mapa[fecha] = (mapa[fecha] || 0) + (parseFloat(v.precio_total) || 0);
  });
  const labels = Object.keys(mapa);
  const datos = labels.map(k => mapa[k]);
  new Chart(document.getElementById("graficaDias"), {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Ventas por Día ($)", data: datos }]
    }
  });
}

function renderGraficaHoras(ventas) {
  const horas = Array(24).fill(0);
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    horas[h] += parseFloat(v.precio_total || 0);
  });
  new Chart(document.getElementById("graficaHoras"), {
    type: "bar",
    data: {
      labels: horas.map((_, i) => `${i}:00`),
      datasets: [{ label: "Ventas por Hora ($)", data: horas }]
    }
  });
}

function renderGraficaVolumen(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const litros = parseFloat(v.litros || 0);
    mapa[v.serial] = (mapa[v.serial] || 0) + litros;
  });
  const labels = Object.keys(mapa);
  const datos = labels.map(l => mapa[l]);
  new Chart(document.getElementById("graficaVolumen"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Volumen por Máquina (L)", data: datos }]
    }
  });
}

function renderGraficaMaquinas(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    const total = parseFloat(v.precio_total || 0);
    mapa[v.serial] = (mapa[v.serial] || 0) + total;
  });
  const labels = Object.keys(mapa);
  const datos = labels.map(l => mapa[l]);
  new Chart(document.getElementById("graficaMaquinas"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Ventas por Máquina ($)", data: datos }]
    }
  });
}

