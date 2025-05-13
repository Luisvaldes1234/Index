// dashboard.js
// Configuración inicial y variables globales
let supabaseClient;
let usuario;
let maquinasActivas = [];
let ventas = [];

// Fechas por defecto
const hoy = new Date();
const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

// Elementos UI
const loadingEl = () => document.getElementById('loading');
const errorModal = document.getElementById('errorModal');
const errorMsg = document.getElementById('errorMessage');

// Mostrar/Ocultar loading spinner
function showLoading() {
  loadingEl().classList.remove('hidden');
}
function hideLoading() {
  loadingEl().classList.add('hidden');
}

// Mostrar error en modal
function showError(msg) {
  errorMsg.textContent = msg;
  errorModal.classList.remove('hidden');
  console.error(msg);
}

// Inicializar Supabase con variables de entorno
function inicializarSupabase() {
  const key = window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = window.env.SUPABASE_URL;
  if (!key || !url) {
    showError('Variables de entorno no configuradas');
    return false;
  }
  supabaseClient = supabase.createClient(url, key);
  return true;
}

// Verificar sesión del usuario
async function verificarSesion() {
  if (!inicializarSupabase()) return false;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showError('Error al verificar sesión: ' + error.message);
    setTimeout(() => location.href = '/login.html', 2000);
    return false;
  }
  if (!data.session) {
    showError('Sesión expirada. Redirigiendo...');
    setTimeout(() => location.href = '/login.html', 2000);
    return false;
  }
  usuario = data.session.user;
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.href = '/login.html';
  });
  return true;
}

// Cargar máquinas con suscripción activa
async function obtenerMaquinasActivas() {
  // Solo máquinas con suscripcion_hasta > hoy
  const hoyISO = hoy.toISOString().split('T')[0];
  const { data, error } = await supabaseClient
    .from('maquinas')
    .select('*')
    .eq('id_usuario', usuario.id)
    .gt('suscripcion_hasta', hoyISO);
  if (error) throw error;
  maquinasActivas = data;
  const sel = document.getElementById('filtroMaquinaCSV');
  sel.innerHTML = '<option value="">Todas</option>';
  if (!maquinasActivas.length) {
    showError('No tienes máquinas con suscripción vigente.');
  }
  maquinasActivas.forEach(m => {
    sel.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
  });
}

// Cargar ventas filtradas por fecha y máquina activa
async function obtenerVentas() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  if (!desde || !hasta) throw new Error('Selecciona rango de fechas');
  const h = new Date(hasta);
  h.setDate(h.getDate() + 1);
  let query = supabaseClient
    .from('ventas')
    .select('*, maquinas(nombre, ubicacion)')
    .eq('id_usuario', usuario.id)
    .gte('fecha', desde)
    .lt('fecha', h.toISOString().split('T')[0]);
  const filtroMaquina = document.getElementById('filtroMaquinaCSV').value;
  if (filtroMaquina) {
    query = query.eq('id_maquina', filtroMaquina);
  } else {
    // Si no se selecciona máquina, filtrar solo máquinas activas
    const ids = maquinasActivas.map(m => m.id);
    query = query.in('id_maquina', ids);
  }
  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) throw error;
  ventas = data;
}

// Actualizar todo el dashboard
async function actualizarDashboard() {
  showLoading();
  try {
    if (!await verificarSesion()) return;
    await obtenerMaquinasActivas();
    await obtenerVentas();
    renderResumen();
    renderGraficas();
  } catch (e) {
    showError(e.message);
  } finally {
    hideLoading();
  }
}

// Renderizar tarjetas de resumen
function renderResumen() {
  const total = ventas.reduce((sum, v) => sum + v.importe, 0);
  const unidades = ventas.reduce((sum, v) => sum + v.unidades, 0);
  const trans = new Set(ventas.map(v => v.id)).size;
  const desde = new Date(document.getElementById('fechaDesde').value);
  const hasta = new Date(document.getElementById('fechaHasta').value);
  const dias = Math.max(1, Math.ceil((hasta - desde) / (1000*60*60*24)) + 1);
  const diario = total / dias;
  document.getElementById('resumen').innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">$${total.toFixed(2)}</h3>
      <p>Ventas Totales</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">${unidades}</h3>
      <p>Unidades Vendidas</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">${trans}</h3>
      <p>Transacciones</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">$${(total/trans || 0).toFixed(2)}</h3>
      <p>Promedio por Venta</p>
    </div>
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 class="text-xl font-bold">$${diario.toFixed(2)}</h3>
      <p>Promedio Diario</p>
    </div>
  `;
}

// Renderizar gráficas con Chart.js
function renderGraficas() {
  // Ventas por hora
  const byHour = Array(24).fill(0);
  ventas.forEach(v => {
    const d = new Date(v.fecha);
    byHour[d.getHours()] += v.importe;
  });
  const ctxH = document.getElementById('graficaHoras').getContext('2d');
  if (window.grafH) window.grafH.destroy();
  window.grafH = new Chart(ctxH, {
    type: 'line',
    data: { labels: Array.from({length:24},(_,i)=>i+':00'), datasets: [{ label:'Ventas ($)', data:byHour, fill:true, tension:0.3 }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  // Ventas por día
  const byDay = {};
  ventas.forEach(v => {
    const day = v.fecha.split('T')[0];
    byDay[day] = (byDay[day] || 0) + v.importe;
  });
  const days = Object.keys(byDay).sort(), vals = days.map(d => byDay[d]);
  const ctxD = document.getElementById('graficaDias').getContext('2d');
  if (window.grafD) window.grafD.destroy();
  window.grafD = new Chart(ctxD, {
    type: 'bar',
    data: { labels:days, datasets:[{ label:'Ventas ($)', data:vals }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  // Volumen vendido por producto
  const byProd = {};
  ventas.forEach(v => {
    const prod = v.producto || 'Sin especificar';
    byProd[prod] = (byProd[prod] || 0) + v.unidades;
  });
  const prods = Object.keys(byProd), nums = prods.map(p=>byProd[p]);
  const ctxV = document.getElementById('graficaVolumen').getContext('2d');
  if (window.grafV) window.grafV.destroy();
  window.grafV = new Chart(ctxV, {
    type: 'pie',
    data: { labels:prods, datasets:[{ data:nums }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right' } } }
  });

  // Rendimiento por máquina
  const byM = {};
  ventas.forEach(v => {
    const name = v.maquinas.nombre;
    byM[name] = (byM[name] || 0) + v.importe;
  });
  const ms = Object.keys(byM), ims = ms.map(m=>byM[m]);
  const ctxM = document.getElementById('graficaMaquinas').getContext('2d');
  if (window.grafM) window.grafM.destroy();
  window.grafM = new Chart(ctxM, {
    type: 'bar',
    data: { labels:ms, datasets:[{ label:'Ventas ($)', data:ims }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{ beginAtZero:true } } }
  });
}

// Generar y descargar CSV
function descargarCSV() {
  if (!ventas.length) return showError('Sin datos para exportar');
  const filtro = document.getElementById('filtroMaquinaCSV').value;
  let list = ventas;
  if (filtro) list = list.filter(v=>v.id_maquina==filtro);
  if (!list.length) return showError('No hay datos con ese filtro');
  const headers = ['Fecha','Hora','Máquina','Ubicación','Producto','Unidades','Importe'];
  const rows = list.map(v => {
    const d = new Date(v.fecha);
    return [d.toLocaleDateString(), d.toLocaleTimeString(), v.maquinas.nombre, v.maquinas.ubicacion, v.producto, v.unidades, v.importe]
      .map(x=>`"${x}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d0 = document.getElementById('fechaDesde').value;
  const d1 = document.getElementById('fechaHasta').value;
  a.download = `ventas_${d0}_a_${d1}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Listeners iniciales
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fechaDesde').value = inicioMes.toISOString().split('T')[0];
  document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
  document.getElementById('fechaDesde').addEventListener('change', actualizarDashboard);
  document.getElementById('fechaHasta').addEventListener('change', actualizarDashboard);
  document.getElementById('filtroMaquinaCSV').addEventListener('change', actualizarDashboard);
  document.getElementById('btnDescargarCSV').addEventListener('click', descargarCSV);
  actualizarDashboard();
});
