// dashboard.js

// *** Configuración de Supabase ***
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2QxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales\let currentUser = null;
let machines = [];
let ventas = [];
let chartHoras, chartDias, chartVolumen, chartMaquinas;

// Elementos del DOM
const filtroMaquina = document.getElementById('filtroMaquinaCSV');
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const btnDescargarCSV = document.getElementById('btnDescargarCSV');
const listaMaquinasCorte = document.getElementById('listaMaquinasCorte');

const ventasSemanaEl = document.getElementById('ventasSemana');
const ventasMesEl = document.getElementById('ventasMes');

const graficaHorasCtx    = document.getElementById('graficaHoras').getContext('2d');
const graficaDiasCtx     = document.getElementById('graficaDias').getContext('2d');
const graficaVolumenCtx  = document.getElementById('graficaVolumen').getContext('2d');
const graficaMaquinasCtx = document.getElementById('graficaMaquinas').getContext('2d');
const loadingEl          = document.getElementById('loading');
const errorModal         = document.getElementById('errorModal');
const errorMessageEl     = document.getElementById('errorMessage');
const btnLogout          = document.getElementById('btnLogout');

// Inicialización
window.addEventListener('DOMContentLoaded', init);
async function init() {
  try {
    toggleLoading(true);
    // 1. Autenticación
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error(authErr?.message || 'No autenticado');
    currentUser = user;
    console.log('Usuario autenticado:', currentUser.id);
    btnLogout.addEventListener('click', () => supabase.auth.signOut().then(() => window.location = '/'));

    // 2. Carga de máquinas
    await cargarMaquinas();
    // 3. Cargar resumen semanal y mensual
    await cargarResumen();
    // 4–7. Carga inicial de ventas y gráficos
    await cargarVentas();

    // Listeners de filtros
    filtroMaquina.addEventListener('change', cargarVentas);
    fechaDesde.addEventListener('change', cargarVentas);
    fechaHasta.addEventListener('change', cargarVentas);
    btnDescargarCSV.addEventListener('click', exportCSV);
  } catch (e) {
    mostrarError(e.message);
  } finally {
    toggleLoading(false);
  }
}

// Spinner
function toggleLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

// Modal de error
function mostrarError(msg) {
  errorMessageEl.textContent = msg;
  errorModal.classList.remove('hidden');
}

// 2. Carga de máquinas usando serial y nombre
async function cargarMaquinas() {
  const today = new Date().toISOString();
  const { data, error } = await supabase
    .from('maquinas')
    .select('serial, nombre')
    .eq('user_id', currentUser.id)
    .gt('suscripcion_hasta', today);
  if (error) throw error;
  machines = data;
  
  // POBLAR SELECT
  filtroMaquina.innerHTML = '<option value="">Todas</option>' +
    machines.map(m => `<option value="${m.serial}">${m.nombre}</option>`).join('');

  // BOTONES DE CORTE (opcional)
  listaMaquinasCorte.innerHTML = machines
    .map(m => `<button data-serial="${m.serial}" class="btn-corte">${m.nombre}</button>`)
    .join('');
}

// 3. Resumen: ventas de la semana y del mes (agrupadas por todas las máquinas)
async function cargarResumen() {
  const now = new Date().toISOString();
  const weekAgo  = new Date(Date.now() - 6 * 24*60*60*1000).toISOString();
  const monthAgo = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  // Ventas semana
  const { data: sem, error: e1 } = await supabase
    .from('ventas')
    .select('precio_total')
    .gte('created_at', weekAgo)
    .lte('created_at', now);
  if (e1) throw e1;
  ventasSemanaEl.textContent = `$${sem.reduce((sum, v) => sum + Number(v.precio_total), 0).toFixed(2)}`;

  // Ventas mes
  const { data: mes, error: e2 } = await supabase
    .from('ventas')
    .select('precio_total')
    .gte('created_at', monthAgo)
    .lte('created_at', now);
  if (e2) throw e2;
  ventasMesEl.textContent = `$${mes.reduce((sum, v) => sum + Number(v.precio_total), 0).toFixed(2)}`;
}

// 4–7. Carga de ventas filtradas y generación de gráficos
async function cargarVentas() {
  try {
    toggleLoading(true);
    const desde = fechaDesde.value;
    const hasta = fechaHasta.value ? `${fechaHasta.value}T23:59:59Z` : null;
    const serial = filtroMaquina.value;

    let query = supabase.from('ventas').select('id, serial, litros, precio_total, created_at');
    if (serial)  query = query.eq('serial', serial);
    if (desde)  query = query.gte('created_at', desde);
    if (hasta)  query = query.lte('created_at', hasta);

    const { data, error } = await query;
    if (error) throw error;
    ventas = data;

    // Dibujar gráficos
    generarChartHoras();
    generarChartDias();
    generarChartVolumen();
    generarChartMaquinas();
  } catch (e) {
    mostrarError(e.message);
  } finally {
    toggleLoading(false);
  }
}

function generarChartHoras() {
  const mapH = {};
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    mapH[h] = (mapH[h] || 0) + 1;
  });
  const labels = Array.from({ length: 24 }, (_, i) => i);
  const data   = labels.map(h => mapH[h] || 0);
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
  const data   = labels.map(d => mapD[d]);
  if (chartDias) chartDias.destroy();
  chartDias = new Chart(graficaDiasCtx, { type: 'line', data: { labels, datasets: [{ label: 'Ventas por día', data }] } });
}

function generarChartVolumen() {
  const tipos = [5,10,20];
  const counts = tipos.map(t => ventas.filter(v => Number(v.litros) === t).length);
  if (chartVolumen) chartVolumen.destroy();
  chartVolumen = new Chart(graficaVolumenCtx, { type:'bar', data:{ labels: tipos.map(x=>x+'L'), datasets:[{ label:'Volumen vendido', data:counts }] } });
}

function generarChartMaquinas() {
  const mapM = {};
  ventas.forEach(v => mapM[v.serial] = (mapM[v.serial]||0) + Number(v.precio_total));
  const labels = machines.map(m => m.nombre);
  const data   = machines.map(m => mapM[m.serial] || 0);
  if (chartMaquinas) chartMaquinas.destroy();
  chartMaquinas = new Chart(graficaMaquinasCtx, { type:'bar', data:{ labels, datasets:[{ label:'Ventas por máquina', data }] } });
}

// 8. Exportar CSV incluyendo serial y nombre de máquina
function exportCSV() {
  if (!ventas.length) return;
  const header = ['ID','Serial','Máquina','Litros','Precio','Fecha'];
  const rows = ventas.map(v => {
    const nombre = machines.find(m=>m.serial===v.serial)?.nombre||'';
    return [v.id, v.serial, nombre, v.litros, v.precio_total, v.created_at];
  });
  const csv = [header, ...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ventas_${fechaDesde.value}_${fechaHasta.value||''}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
