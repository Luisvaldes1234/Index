// dashboard.js

// Asegúrate de que tu HTML contenga los siguientes elementos con estos IDs:
// selectMaquina, filtroPeriodo, fechaInicio, fechaFin, exportCsv,
// litrosHoy, ventasTotales, ultimaVenta, maquinasActivas, ticketPromedio,
// chartVolumen, chartHoras, chartDias

// === Conexión a Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2QxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let machines = [];
let ventas = [];

// Elementos del DOM
const selectMaquina = document.getElementById('selectMaquina');
const filtroPeriodo = document.getElementById('filtroPeriodo');
const fechaInicioInput = document.getElementById('fechaInicio');
const fechaFinInput = document.getElementById('fechaFin');
const exportCsvBtn = document.getElementById('exportCsv');

const litrosHoyEl = document.getElementById('litrosHoy');
const ventasTotalesEl = document.getElementById('ventasTotales');
const ultimaVentaEl = document.getElementById('ultimaVenta');
const maquinasActivasEl = document.getElementById('maquinasActivas');
const ticketPromedioEl = document.getElementById('ticketPromedio');

const ctxVolumen = document.getElementById('chartVolumen').getContext('2d');
const ctxHoras = document.getElementById('chartHoras').getContext('2d');
const ctxDias = document.getElementById('chartDias').getContext('2d');

let chartVolumen, chartHoras, chartDias;

// Inicialización
async function init() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    console.error('Error al obtener usuario autenticado:', authError);
    return;
  }
  currentUser = authData.user;
  console.log('Usuario autenticado:', currentUser.id);

  await cargarMaquinas();
  setDefaultDates();
  await cargarDatos();

  // Listeners
  selectMaquina.addEventListener('change', cargarDatos);
  filtroPeriodo.addEventListener('change', onPeriodoChange);
  fechaInicioInput.addEventListener('change', cargarDatos);
  fechaFinInput.addEventListener('change', cargarDatos);
  exportCsvBtn.addEventListener('click', exportCSV);
}
\ async function cargarMaquinas() {
  const todayISO = new Date().toISOString();
  const { data, error } = await supabase
    .from('maquinas')
    .select('id, nombre')
    .eq('user_id', currentUser.id)
    .gt('suscripcion_hasta', todayISO);
  if (error) {
    console.error('Error cargando máquinas:', error);
    return;
  }
  machines = data;
  selectMaquina.innerHTML = '<option value="">Todas</option>' +
    data.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
  maquinasActivasEl.textContent = data.length;
}

function setDefaultDates() {
  const today = new Date();
  const isoDate = today.toISOString().split('T')[0];
  fechaInicioInput.value = isoDate;
  fechaFinInput.value = isoDate;
}

function onPeriodoChange() {
  const periodo = filtroPeriodo.value;
  const today = new Date();
  let start, end;
  if (periodo === 'hoy') {
    start = end = today;
  } else if (periodo === 'semana') {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    end = today;
  } else if (periodo === 'mes') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = today;
  } else {
    // personalizado
    fechaInicioInput.disabled = false;
    fechaFinInput.disabled = false;
    return;
  }
  fechaInicioInput.disabled = true;
  fechaFinInput.disabled = true;
  fechaInicioInput.value = start.toISOString().split('T')[0];
  fechaFinInput.value = end.toISOString().split('T')[0];
  cargarDatos();
}

async function cargarDatos() {
  const maquinaId = selectMaquina.value;
  const startDate = fechaInicioInput.value;
  const endDate = fechaFinInput.value;
  const { data: ventasData, error } = await supabase
    .from('ventas')
    .select('id, litros, precio_total, created_at')
    .eq(maquinaId ? 'maquina_id' : undefined, maquinaId || undefined)
    .gte('created_at', startDate)
    .lte('created_at', endDate ? `${endDate}T23:59:59Z` : undefined);
  if (error) {
    console.error('Error cargando ventas:', error);
    return;
  }
  ventas = ventasData;

  // Resumen
  const litrosTotal = ventas.reduce((sum, v) => sum + v.litros, 0);
  const ventasTotal = ventas.reduce((sum, v) => sum + v.precio_total, 0);
  const ultima = ventas.length ? new Date(ventas[ventas.length - 1].created_at).toLocaleString() : 'N/A';
  const ticketProm = ventas.length ? (ventasTotal / ventas.length).toFixed(2) : 'N/A';

  litrosHoyEl.textContent = litrosTotal;
  ventasTotalesEl.textContent = ventasTotal;
  ultimaVentaEl.textContent = ultima;
  ticketPromedioEl.textContent = ticketProm;

  // Gráficas
  generarChartVolumen(ventas);
  generarChartHoras(ventas);
  generarChartDias(ventas);
}

function generarChartVolumen(data) {
  const volumes = [5, 10, 20];
  const counts = volumes.map(v => data.filter(s => s.litros === v).length);
  if (chartVolumen) chartVolumen.destroy();
  chartVolumen = new Chart(ctxVolumen, {
    type: 'bar',
    data: {
      labels: volumes.map(v => `${v}L`),
      datasets: [{ label: 'Número de ventas', data: counts }]
    }
  });
}

function generarChartHoras(data) {
  const hoursMap = {};
  data.forEach(s => {
    const hour = new Date(s.created_at).getHours();
    hoursMap[hour] = (hoursMap[hour] || 0) + 1;
  });
  const labels = Array.from({ length: 24 }, (_, i) => i);
  const counts = labels.map(h => hoursMap[h] || 0);
  if (chartHoras) chartHoras.destroy();
  chartHoras = new Chart(ctxHoras, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Ventas por hora', data: counts }] }
  });
}

function generarChartDias(data) {
  const dayMap = {};
  data.forEach(s => {
    const day = new Date(s.created_at).toISOString().split('T')[0];
    dayMap[day] = (dayMap[day] || 0) + 1;
  });
  const sortedDays = Object.keys(dayMap).sort();
  const counts = sortedDays.map(d => dayMap[d]);
  if (chartDias) chartDias.destroy();
  chartDias = new Chart(ctxDias, {
    type: 'line',
    data: { labels: sortedDays, datasets: [{ label: 'Ventas por día', data: counts }] }
  });
}

function exportCSV() {
  if (!ventas.length) return;
  const rows = ventas.map(s => [s.id, s.litros, s.precio_total, s.created_at]);
  const header = ['ID', 'Litros', 'Precio Total', 'Fecha'];
  const csvContent = [header, ...rows]
    .map(e => e.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${fechaInicioInput.value}_${fechaFinInput.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', init);
