// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Ahora usa `supabaseClient` en lugar de `supabase` en todo tu código.

let usuario = null;
let maquinasActivas = [];
let ventas = [];

// Referencias UI
const loadingEl  = () => document.getElementById('loading');
const errorModal = () => document.getElementById('errorModal');
const errorMsg   = () => document.getElementById('errorMessage');

// —————————————————————————
// 2) Helpers: loading & errors
// —————————————————————————
function showLoading()  { loadingEl().classList.remove('hidden'); }
function hideLoading()  { loadingEl().classList.add('hidden'); }
function showError(msg) {
  errorMsg().textContent = msg;
  errorModal().classList.remove('hidden');
  console.error(msg);
}

// —————————————————————————
// 3) Autenticación
// —————————————————————————
async function initSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    window.location.href = '/login.html';
    return false;
  }
  usuario = data.session.user;
  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  });
  return true;
}

// —————————————————————————
// 4) Carga de Máquinas
// —————————————————————————
async function obtenerMaquinasActivas() {
  const hoyISO = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient
    .from('maquinas')
    .select('id, nombre')
    .eq   ('user_id', usuario.id)        // ← FILTRA POR user_id
    .gt   ('suscripcion_hasta', hoyISO);

  if (error) {
    showError('Error al cargar máquinas: ' + error.message);
    maquinasActivas = [];
  } else {
    maquinasActivas = data || [];
  }

  // Llenar el <select>
  const select = document.getElementById('filtroMaquinaCSV');
  select.innerHTML = '<option value="">Todas</option>';
  maquinasActivas.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
  });
}

// === Obtener ventas filtradas ===
async function obtenerVentas() {
  // Si no hay máquinas activas, salimos
  if (!maquinasActivas.length) {
    ventas = [];
    return;
  }

  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  const h = new Date(hasta);
  h.setDate(h.getDate() + 1);

  let query = supabaseClient
    .from('ventas')
    .select(`
      *,
      maquinas!inner(nombre)  /* opcional: si tienes relación definida */
    `)
    .eq   ('user_id', usuario.id)       // ← y AQUÍ TAMBIÉN POR user_id
    .gte  ('fecha', desde)
    .lt   ('fecha', h.toISOString().split('T')[0]);

  const filtro = document.getElementById('filtroMaquinaCSV').value;
  if (filtro) {
    query = query.eq('id_maquina', filtro);
  } else {
    const ids = maquinasActivas.map(m => m.id);
    query = query.in('id_maquina', ids);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) {
    showError('Error al cargar ventas: ' + error.message);
    ventas = [];
  } else {
    ventas = (data || []).map(v => ({
      ...v,
      importe: v.precio_total ?? 0,
      unidades: v.litros       ?? 0,
      fechaHora: new Date(v.fecha)
    }));
  }
}

// —————————————————————————
// 6) Renderizar Resumen
// —————————————————————————
function renderResumen() {
  const cont = document.getElementById('resumen');
  // Sin máquinas → mensaje
  if (maquinasActivas.length === 0) {
    cont.innerHTML = `
      <div class="col-span-full bg-white dark:bg-gray-800 p-6 rounded shadow text-center">
        <h3 class="text-xl font-bold">No tienes máquinas activas</h3>
        <p class="text-gray-500">Agrega una máquina para empezar</p>
      </div>`;
    return;
  }

  // Sin ventas → mensaje
  if (!ventas.length) {
    cont.innerHTML = `
      <div class="col-span-full bg-white dark:bg-gray-800 p-6 rounded shadow text-center">
        <h3 class="text-xl font-bold">Sin datos para el periodo</h3>
        <p class="text-gray-500">Ajusta fechas o agrega ventas</p>
      </div>`;
    return;
  }

  // Cálculos
  const total = ventas.reduce((s, v) => s + v.importe, 0);
  const unidades = ventas.reduce((s, v) => s + v.unidades, 0);
  const trans = ventas.length;
  const desdeDate = new Date(document.getElementById('fechaDesde').value);
  const hastaDate = new Date(document.getElementById('fechaHasta').value);
  const dias = Math.max(1, Math.ceil((hastaDate - desdeDate)/(1000*60*60*24)) + 1);
  const diario = total / dias;

  // HTML
  cont.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">$${total.toFixed(2)}</h3><p>Ventas Totales</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">${unidades}</h3><p>Unidades Vendidas</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">${trans}</h3><p>Transacciones</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">$${(total/trans).toFixed(2)}</h3><p>Promedio/Venta</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">$${diario.toFixed(2)}</h3><p>Promedio Diario</p>
    </div>`;
}

// —————————————————————————
// 7) Renderizar Gráficas
// —————————————————————————
let chartHoras, chartDias, chartVolumen, chartMaquinas;

function renderGraficaHoras() {
  const arr = Array(24).fill(0);
  ventas.forEach(v => arr[v.fechaHora.getHours()] += v.importe);
  const ctx = document.getElementById('graficaHoras').getContext('2d');
  if (chartHoras) chartHoras.destroy();
  chartHoras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: arr.map((_,i)=>`${i}:00`),
      datasets: [{ label:'Ventas ($)', data:arr }]
    }
  });
}

function renderGraficaDias() {
  const mapa = {};
  ventas.forEach(v => {
    const d = v.fechaHora.toISOString().split('T')[0];
    mapa[d] = (mapa[d]||0) + v.importe;
  });
  const labels = Object.keys(mapa).sort();
  const data = labels.map(d=>mapa[d]);
  const ctx = document.getElementById('graficaDias').getContext('2d');
  if (chartDias) chartDias.destroy();
  chartDias = new Chart(ctx, { type:'line', data:{ labels, datasets:[{ label:'Ventas Diarias', data }] } });
}

function renderGraficaVolumen() {
  const mapa = {};
  ventas.forEach(v => {
    const key = v.id_maquina;
    mapa[key] = (mapa[key]||0) + v.unidades;
  });
  const labels = Object.keys(mapa);
  const data = labels.map(l=>mapa[l]);
  const ctx = document.getElementById('graficaVolumen').getContext('2d');
  if (chartVolumen) chartVolumen.destroy();
  chartVolumen = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Litros', data }] } });
}

function renderGraficaMaquinas() {
  const mapa = {};
  ventas.forEach(v => {
    const key = v.id_maquina;
    mapa[key] = (mapa[key]||0) + v.importe;
  });
  const labels = Object.keys(mapa);
  const data = labels.map(l=>mapa[l]);
  const ctx = document.getElementById('graficaMaquinas').getContext('2d');
  if (chartMaquinas) chartMaquinas.destroy();
  chartMaquinas = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Ventas', data }] } });
}

// —————————————————————————
// 8) Ciclo de carga
// —————————————————————————
async function actualizarDashboard() {
  showLoading();
  try {
    if (!(await initSession())) return;
    await obtenerMaquinasActivas();
    await obtenerVentas();
    renderResumen();
    renderGraficaHoras();
    renderGraficaDias();
    renderGraficaVolumen();
    renderGraficaMaquinas();
  } catch (e) {
    showError(e.message);
  } finally {
    hideLoading();
  }
}

// Listeners
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fechaDesde').addEventListener('change', actualizarDashboard);
  document.getElementById('fechaHasta').addEventListener('change', actualizarDashboard);
  document.getElementById('filtroMaquinaCSV').addEventListener('change', actualizarDashboard);
  actualizarDashboard();
});
