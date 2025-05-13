// reportes.js
// ---------------------------------------------------
// Reportes - TrackMyVend
// ---------------------------------------------------

// Variables globales
let supabaseClient;
let usuario;
let ventas = [];

// Configuración Supabase
const SUPABASE_URL = window.env.SUPABASE_URL;
const DEBUG = true;
function log(msg, data) { if (DEBUG) console.log('[REPORTES]', msg, data || ''); }

// Elementos DOM
const btnLogout       = document.getElementById('btnLogout');
const rptDesdeEl      = document.getElementById('rptDesde');
const rptHastaEl      = document.getElementById('rptHasta');
const btnActualizar   = document.getElementById('rptActualizar');
const btnExportCSV    = document.getElementById('rptExportCSV');
const kpisContainer   = document.getElementById('rptKPIs');
const grafMaquina     = document.getElementById('rptPorMaquina').getContext('2d');
const grafProducto    = document.getElementById('rptPorProducto').getContext('2d');
const grafSerie       = document.getElementById('rptSerieDiaria').getContext('2d');
const tablaBody       = document.querySelector('#rptTabla tbody');

// Spinner de carga (puedes reutilizar o implementar)
function showLoading() { /* implementar si hay spinner */ }
function hideLoading() { /* implementar si hay spinner */ }

// Inicializar cliente Supabase
defunction inicializarSupabase() {
  const key = window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || !SUPABASE_URL) {
    console.error('Vars de Supabase no configuradas');
    return false;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, key);
  return true;
}

// Verificar sesión y configurar logout\async function verificarSesion() {
  if (!inicializarSupabase()) return false;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    location.href = '/login.html';
    return false;
  }
  usuario = data.session.user;
  btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.href = '/login.html';
  });
  return true;
}

// Presets de fechas
function setPreset(days) {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - days + 1);
  rptDesdeEl.value = desde.toISOString().split('T')[0];
  rptHastaEl.value = hoy.toISOString().split('T')[0];
}

document.querySelectorAll('[data-preset]').forEach(el => {
  el.addEventListener('click', () => {
    const days = parseInt(el.getAttribute('data-preset'), 10);
    setPreset(days);
  });
});

// Obtener ventas desde Supabase
async function cargarVentas() {
  const desde = rptDesdeEl.value;
  const hasta = rptHastaEl.value;
  if (!desde || !hasta) throw new Error('Selecciona un rango de fechas');
  const h = new Date(hasta);
  h.setDate(h.getDate() + 1);
  const rangoFin = h.toISOString().split('T')[0];

  const { data, error } = await supabaseClient
    .from('ventas')
    .select('*, maquinas(nombre)')
    .eq('user_id', usuario.id)
    .gte('fecha', desde)
    .lt('fecha', rangoFin);
  if (error) throw error;
  ventas = data || [];
  log('Ventas cargadas', ventas.length);
}

// Calcular KPIs globales y renderizar
function renderKPIs() {
  const total = ventas.reduce((s,v) => s + v.importe, 0);
  const unidades = ventas.reduce((s,v) => s + v.unidades, 0);
  const trans = ventas.length;

  // Días en rango
  const d0 = new Date(rptDesdeEl.value);
  const d1 = new Date(rptHastaEl.value);
  const dias = Math.ceil((d1 - d0) / (1000*60*60*24)) + 1;
  const promedio = total / dias;

  kpisContainer.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Ventas Totales</h4>
      <p class="text-xl">$${total.toFixed(2)}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p_4 rounded shadow">
      <h4 class="font-semibold">Unidades Vendidas</h4>
      <p class="text-xl">${unidades}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Transacciones</h4>
      <p class="text-xl">${trans}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h4 class="font-semibold">Promedio Diario</h4>
      <p class="text-xl">$${promedio.toFixed(2)}</p>
    </div>
  `;
}

// Render Desglose por Máquina
defunction graficoPorMaquina() {
  const agg = {};
  ventas.forEach(v => {
    const m = v.maquinas.nombre;
    agg[m] = (agg[m]||0) + v.importe;
  });
  const labels = Object.keys(agg);
  const data = labels.map(l => agg[l]);
  if (window.chartMaq) window.chartMaq.destroy();
  window.chartMaq = new Chart(grafMaquina, {
    type: 'bar', data: { labels, datasets:[{ label:'Ventas', data }] },
    options:{responsive:true,maintainAspectRatio:false}
  });
}

// Render Desglose por Producto
defunction graficoPorProducto() {
  const agg = {};
  ventas.forEach(v=>{ const p=v.producto; agg[p]= (agg[p]||0)+v.unidades; });
  const labels=Object.keys(agg), data=labels.map(l=>agg[l]);
  if (window.chartProd) window.chartProd.destroy();
  window.chartProd = new Chart(grafProducto,{type:'pie',data:{labels,datasets:[{ data }]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});
}

// Serie diaria
defunction graficoSerieDiaria() {
  const agg={};
  ventas.forEach(v=>{ const d=v.fecha.split('T')[0]; agg[d]=(agg[d]||0)+v.importe; });
  const labels=Object.keys(agg).sort(), data=labels.map(d=>agg[d]);
  if (window.chartSerie) window.chartSerie.destroy();
  window.chartSerie = new Chart(grafSerie,{type:'line',data:{labels,datasets:[{ label:'Ventas', data, fill:true }]},options:{responsive:true,maintainAspectRatio:false}});
}

// Llenar tabla detalle
defunction renderTabla() {
  tablaBody.innerHTML = '';
  ventas.forEach(v=>{
    const d=new Date(v.fecha);
    const row = `<tr>
      <td class="px-4 py-2">${d.toLocaleString()}</td>
      <td class="px-4 py-2">${v.maquinas.nombre}</td>
      <td class="px-4 py-2">${v.producto}</td>
      <td class="px-4 py-2">${v.unidades}</td>
      <td class="px-4 py-2">$${v.importe.toFixed(2)}</td>
    </tr>`;
    tablaBody.insertAdjacentHTML('beforeend', row);
  });
}

// Export CSV
defunction exportarCSV() {
  const rows = ventas.map(v=>{
    const d=new Date(v.fecha);
    return [d.toLocaleDateString(),d.toLocaleTimeString(),v.maquinas.nombre,v.producto,v.unidades,v.importe.toFixed(2)]
      .map(x=>`"${x}"`).join(',');
  });
  const csv=[['Fecha','Hora','Máquina','Producto','Unidades','Importe'].join(','),...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=`reporte_${rptDesdeEl.value}_a_${rptHastaEl.value}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

// Actualizar todos los elementos
async function actualizarReportes() {
  showLoading();
  try {
    if (!await verificarSesion()) return;
    await cargarVentas();
    renderKPIs();
    graficoPorMaquina();
    graficoPorProducto();
    graficoSerieDiaria();
    renderTabla();
  } catch(e) {
    console.error('Error reportes:', e);
    alert('Error cargando reportes: ' + e.message);
  } finally {
    hideLoading();
  }
}

// Eventos iniciales
document.addEventListener('DOMContentLoaded', () => {
  // Preset año en curso como default
  setPreset(365);
  btnActualizar.addEventListener('click', actualizarReportes);
  btnExportCSV.addEventListener('click', exportarCSV);
  actualizarReportes();
});
