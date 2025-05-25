// dashboard.js

// Conexión a Supabase (asegúrate de cambiar la URL y la KEY si cambian)
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales
let currentUser = null;
let machines = [];
let ventas = [];
let chartHoras, chartDias, chartVolumen, chartMaquinas;

// Elementos del DOM
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const filtroMaquina = document.getElementById('filtroMaquinaCSV');
const btnDescargarCSV = document.getElementById('btnDescargarCSV');
const listaMaquinasCorte = document.getElementById('listaMaquinasCorte');
const ventasSemanaEl = document.getElementById('ventasSemana');
const ventasMesEl = document.getElementById('ventasMes');
const dineroMaquinaEl = document.getElementById('dineroMaquina');
const graficaHorasCtx = document.getElementById('graficaHoras').getContext('2d');
const graficaDiasCtx = document.getElementById('graficaDias').getContext('2d');
const graficaVolumenCtx = document.getElementById('graficaVolumen').getContext('2d');
const graficaMaquinasCtx = document.getElementById('graficaMaquinas').getContext('2d');
const loadingEl = document.getElementById('loading');
const errorModal = document.getElementById('errorModal');
const errorMessageEl = document.getElementById('errorMessage');
const btnLogout = document.getElementById('btnLogout');

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', init);
async function init() {
  try {
    showLoading(true);
    // Autenticación
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) throw new Error(authError?.message || 'No hay usuario autenticado');
    currentUser = authData.user;
    console.log('Usuario autenticado:', currentUser.id);

    btnLogout.addEventListener('click', () => supabaseClient.auth.signOut().then(() => window.location = '/'));

    // Carga de máquinas y datos
    await cargarMaquinas();
    await cargarResumen();
    await cargarVentas();

    // Eventos
    filtroMaquina.addEventListener('change', cargarVentas);
    fechaDesde.addEventListener('change', cargarVentas);
    fechaHasta.addEventListener('change', cargarVentas);
    btnDescargarCSV.addEventListener('click', exportCSV);
  } catch (e) {
    console.error(e);
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

// Muestra u oculta el spinner
function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

// Muestra un mensaje de error en modal
function showError(msg) {
  errorMessageEl.textContent = msg;
  errorModal.classList.remove('hidden');
}

// 1. Carga de máquinas activas para el usuario
async function cargarMaquinas() {
  const today = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from('maquinas')
    .select('id, nombre')
    .eq('user_id', currentUser.id)
    .gt('suscripcion_hasta', today);
  if (error) throw error;
  machines = data;

  // Poblamos el select y los botones de corte
  filtroMaquina.innerHTML = '<option value="">Todas</option>' + machines
    .map(m => `<option value="${m.id}">${m.nombre}</option>`)
    .join('');
  listaMaquinasCorte.innerHTML = machines
    .map(m => `<button data-id="${m.id}" class="bg-blue-500 text-white px-4 py-2 rounded">${m.nombre}</button>`)
    .join('');
}

// 2. Resumen: ventas de la semana y del mes
async function cargarResumen() {
  const now = new Date();
  const isoNow = now.toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const ids = machines.map(m => m.id);

  // Semana
  const { data: semanaData, error: e1 } = await supabaseClient
    .from('ventas')
    .select('precio_total')
    .in('maquina_id', ids)
    .gte('created_at', weekStart)
    .lte('created_at', isoNow);
  if (e1) throw e1;
  const sumSemana = semanaData.reduce((a, v) => a + v.precio_total, 0);
  ventasSemanaEl.textContent = `$${sumSemana.toFixed(2)}`;

  // Mes
  const { data: mesData, error: e2 } = await supabaseClient
    .from('ventas')
    .select('precio_total')
    .in('maquina_id', ids)
    .gte('created_at', monthStart)
    .lte('created_at', isoNow);
  if (e2) throw e2;
  const sumMes = mesData.reduce((a, v) => a + v.precio_total, 0);
  ventasMesEl.textContent = `$${sumMes.toFixed(2)}`;
}

// 3–7. Carga de ventas según filtros y generación de gráficos
async function cargarVentas() {
  try {
    showLoading(true);
    const desde = fechaDesde.value;
    const hasta = fechaHasta.value ? `${fechaHasta.value}T23:59:59Z` : null;
    const maquinaId = filtroMaquina.value;

    let query = supabaseClient.from('ventas').select('id, maquina_id, litros, precio_total, created_at');
    if (maquinaId) query = query.eq('maquina_id', maquinaId);
    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);
    const { data, error } = await query;
    if (error) throw error;
    ventas = data;

    // Gráficas
    generarChartHoras();
    generarChartDias();
    generarChartVolumen();
    generarChartMaquinas();
  } catch (e) {
    console.error(e);
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

function generarChartHoras() {
  const mapH = {};
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    mapH[h] = (mapH[h] || 0) + 1;
  });
  const labels = Array.from({ length: 24 }, (_, i) => i);
  const data = labels.map(h => mapH[h] || 0);
  if (chartHoras) chartHoras.destroy();
  chartHoras = new Chart(graficaHorasCtx, { type: 'line', data: { labels, datasets: [{ label: 'Ventas por hora', data }] } });
}

function generarChartDias() {
  const mapD = {};
  ventas.forEach(v => {
    const d = new Date(v.created_at).toISOString().split('T')[0];
    mapD[d] = (mapD[d] || 0) + 1;
  });
  const labels = Object.keys(mapD).sort();
  const data = labels.map(d => mapD[d]);
  if (chartDias) chartDias.destroy();
  chartDias = new Chart(graficaDiasCtx, { type: 'line', data: { labels, datasets: [{ label: 'Ventas por día', data }] } });
}

function generarChartVolumen() {
  const volumes = [5, 10, 20];
  const counts = volumes.map(v => ventas.filter(x => x.litros === v).length);
  if (chartVolumen) chartVolumen.destroy();
  chartVolumen = new Chart(graficaVolumenCtx, { type: 'bar', data: { labels: volumes.map(v => v + 'L'), datasets: [{ label: 'Volumen vendido', data: counts }] } });
}

function generarChartMaquinas() {
  const mapM = {};
  ventas.forEach(v => mapM[v.maquina_id] = (mapM[v.maquina_id] || 0) + v.precio_total);
  const labels = machines.map(m => m.nombre);
  const data = machines.map(m => mapM[m.id] || 0);
  if (chartMaquinas) chartMaquinas.destroy();
  chartMaquinas = new Chart(graficaMaquinasCtx, { type: 'bar', data: { labels, datasets: [{ label: 'Ventas por máquina', data }] } });
}

// 8. Exportar CSV
function exportCSV() {
  if (!ventas.length) return;
  const header = ['ID', 'Máquina', 'Litros', 'Precio', 'Fecha'];
  const rows = ventas.map(v => {
    const nombre = machines.find(m => m.id === v.maquina_id)?.nombre || '';
    return [v.id, nombre, v.litros, v.precio_total, v.created_at];
  });
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `ventas_${fechaDesde.value}_${fechaHasta.value || ''}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
