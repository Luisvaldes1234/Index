// subscripcion.js — TrackMyVend
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);



// ======================================
// 2) ESTADO GLOBAL & REFERENCIAS UI
// ======================================
let usuario = null;
let maquinasActivas = [];
let ventas = [];

const loadingEl  = () => document.getElementById('loading');
const errorModal = () => document.getElementById('errorModal');
const errorMsg   = () => document.getElementById('errorMessage');
const getEl      = id => document.getElementById(id);

// ======================================
// 3) HELPERS: Loading & Error Modal
// ======================================
function showLoading()  { loadingEl()?.classList.remove('hidden'); }
function hideLoading()  { loadingEl()?.classList.add('hidden'); }
function showError(msg) {
  const m = errorMsg();
  if (m) m.textContent = msg;
  errorModal()?.classList.remove('hidden');
  console.error(msg);
}

// ======================================
// 4) AUTENTICACIÓN
// ======================================
async function initSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = '/login.html';
    return false;
  }
  usuario = data.session.user;

  const btn = getEl('btnLogout');
  if (btn) {
    btn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = '/login.html';
    });
  }
  return true;
}

// ======================================
// 5) OBTENER MÁQUINAS ACTIVAS
// ======================================
async function obtenerMaquinasActivas() {
  const hoyISO = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient
    .from('maquinas')
    .select('serial, nombre')
    .eq('user_id', usuario.id)
    .gt('suscripcion_hasta', hoyISO);

  if (error) {
    showError('Error al cargar máquinas: ' + error.message);
    maquinasActivas = [];
  } else {
    maquinasActivas = data || [];
  }

  const sel = getEl('filtroMaquinaCSV');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todas</option>';
  maquinasActivas.forEach(m => {
    const opt = document.createElement('option');
    opt.value       = m.serial;
    opt.textContent = m.nombre;
    sel.appendChild(opt);
  });
}

// ======================================
// 6) OBTENER VENTAS FILTRADAS
// ======================================
async function obtenerVentas() {
  if (!maquinasActivas.length) {
    ventas = [];
    return;
  }

  const desdeStr = getEl('fechaDesde')?.value;
  const hastaStr = getEl('fechaHasta')?.value;

  if (!desdeStr || !hastaStr ||
      isNaN(Date.parse(desdeStr)) ||
      isNaN(Date.parse(hastaStr))) {
    ventas = [];
    return;
  }

  const desde = new Date(desdeStr);
  const hasta = new Date(hastaStr);
  hasta.setDate(hasta.getDate() + 1);

  let q = supabaseClient
    .from('ventas')
    .select('*')
    .eq('user_id', usuario.id)
    .gte('created_at', desde.toISOString())
    .lt('created_at', hasta.toISOString());

  const filtro = getEl('filtroMaquinaCSV')?.value;
  if (filtro) {
    q = q.eq('serial', filtro);
  } else {
    const seriales = maquinasActivas.map(m => m.serial);
    q = q.in('serial', seriales);
  }

  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) {
    showError('Error al cargar ventas: ' + error.message);
    ventas = [];
  } else {
    ventas = (data || []).map(v => ({
      ...v,
      importe: parseFloat(v.precio_total) || 0,
      unidades: parseFloat(v.litros)       || 0,
      fechaHora: new Date(v.created_at)
    }));
  }
}

// ======================================
// 7) RENDER RESUMEN
// ======================================
function renderResumen() {
  const cont = getEl('resumen');
  if (!cont) return;

  if (!maquinasActivas.length) {
    cont.innerHTML = `
      <div class="col-span-full bg-white dark:bg-gray-800 p-6 rounded shadow text-center">
        <h3 class="text-xl font-bold">No tienes máquinas activas</h3>
        <p class="text-gray-500">Agrega una máquina para empezar</p>
      </div>`;
    return;
  }

  if (!ventas.length) {
    cont.innerHTML = `
      <div class="col-span-full bg-white dark:bg-gray-800 p-6 rounded shadow text-center">
        <h3 class="text-xl font-bold">Sin datos para el periodo</h3>
        <p class="text-gray-500">Ajusta fechas o agrega ventas</p>
      </div>`;
    return;
  }

  const total = ventas.reduce((a,v)=>a+v.importe, 0);
  const unidades = ventas.reduce((a,v)=>a+v.unidades, 0);
  const trans = ventas.length;

  const desde = new Date(getEl('fechaDesde').value);
  const hasta = new Date(getEl('fechaHasta').value);
  const dias = Math.max(
    1,
    Math.ceil((hasta - desde)/(1000*60*60*24)) + 1
  );
  const diario = total / dias;

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

// ======================================
// 8) RENDER GRÁFICAS
// ======================================
let chartHoras, chartDias, chartVolumen, chartMaquinas;

function renderGraficaHoras() {
  const arr = Array(24).fill(0);
  ventas.forEach(v => arr[v.fechaHora.getHours()] += v.importe);
  const ctx = getEl('graficaHoras').getContext('2d');
  if (chartHoras) chartHoras.destroy();
  chartHoras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: arr.map((_,i)=>`${i}:00`),
      datasets: [{ label:'Ventas ($)', data: arr }]
    },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

function renderGraficaDias() {
  const mapa = {};
  ventas.forEach(v => {
    const d = v.fechaHora.toISOString().split('T')[0];
    mapa[d] = (mapa[d]||0) + v.importe;
  });
  const labels = Object.keys(mapa).sort();
  const data   = labels.map(d=>mapa[d]);
  const ctx    = getEl('graficaDias').getContext('2d');
  if (chartDias) chartDias.destroy();
  chartDias = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label:'Ventas Diarias', data }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

function renderGraficaVolumen() {
  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial]||0) + v.unidades;
  });
  const labels = Object.keys(mapa);
  const data   = labels.map(l=>mapa[l]);
  const ctx    = getEl('graficaVolumen').getContext('2d');
  if (chartVolumen) chartVolumen.destroy();
  chartVolumen = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Litros Vendidos', data }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

function renderGraficaMaquinas() {
  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial]||0) + v.importe;
  });
  const labels = Object.keys(mapa);
  const data   = labels.map(l=>mapa[l]);
  const ctx    = getEl('graficaMaquinas').getContext('2d');
  if (chartMaquinas) chartMaquinas.destroy();
  chartMaquinas = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Ventas por Máquina', data }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false }
  });
}

// ======================================
// 9) ORQUESTADOR: actualizarDashboard
// ======================================
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

// ======================================
// 10) INICIALIZACIÓN AL CARGAR LA PÁGINA
// ======================================
window.addEventListener('DOMContentLoaded', () => {
  const fd = getEl('fechaDesde'),
        fh = getEl('fechaHasta');
  const hoy    = new Date(),
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  fd.value = inicio.toISOString().split('T')[0];
  fh.value = hoy   .toISOString().split('T')[0];

  fd.addEventListener('change', actualizarDashboard);
  fh.addEventListener('change', actualizarDashboard);
  getEl('filtroMaquinaCSV').addEventListener('change', actualizarDashboard);

  actualizarDashboard();
});
