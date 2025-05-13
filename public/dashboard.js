// subscripcion.js — TrackMyVend
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
// Estado global


// Ya no existe ninguna variable llamada "supabase", a partir de ahora todo va en supabaseClient
let usuario = null;
let maquinasActivas = [];
let ventas = [];

// Referencias UI
const loadingEl  = () => document.getElementById('loading');
const errorModal = () => document.getElementById('errorModal');
const errorMsg   = () => document.getElementById('errorMessage');

// —————————————————————————
// 2) Helpers: Loading & Error
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
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = '/login.html';
    return false;
  }
  usuario = data.session.user;

  // Configurar logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = '/login.html';
    });
  }
  return true;
}

// —————————————————————————
// 4) Carga de Máquinas Activas
// —————————————————————————
async function obtenerMaquinasActivas() {
  const hoyISO = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient
    .from('maquinas')
    .select('id, nombre')
    .eq('user_id', usuario.id)
    .gt('suscripcion_hasta', hoyISO);

  if (error) {
    showError('Error al cargar máquinas: ' + error.message);
    maquinasActivas = [];
  } else {
    maquinasActivas = data || [];
  }

  // Llenar selector
  const sel = document.getElementById('filtroMaquinaCSV');
  sel.innerHTML = '<option value="">Todas</option>';
  maquinasActivas.forEach(m => {
    sel.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
  });
}

// —————————————————————————
// 5) Carga de Ventas
// —————————————————————————
async function obtenerVentas() {
  if (!maquinasActivas.length) {
    ventas = [];
    return;
  }

  const desdeStr = document.getElementById('fechaDesde').value;
  const hastaStr = document.getElementById('fechaHasta').value;

  // Validar fechas
  if (!desdeStr || !hastaStr ||
      isNaN(Date.parse(desdeStr)) ||
      isNaN(Date.parse(hastaStr))) {
    ventas = [];
    return;
  }

  const desde = new Date(desdeStr);
  const hasta = new Date(hastaStr);
  hasta.setDate(hasta.getDate() + 1);

  let query = supabaseClient
    .from('ventas')
    .select('*')
    .eq('user_id', usuario.id)
    .gte('created_at', desde.toISOString())
    .lt ('created_at', hasta.toISOString());

  const filtro = document.getElementById('filtroMaquinaCSV').value;
  if (filtro) {
    query = query.eq('id_maquina', filtro);
  } else {
    const ids = maquinasActivas.map(m => m.id);
    query = query.in('id_maquina', ids);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
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

// —————————————————————————
// 6) Render Resumen y Gráficas...
//    (mantén tu código de renderización aquí)
// —————————————————————————

// —————————————————————————
// Orquestador
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

// —————————————————————————
// Inicialización
// —————————————————————————
window.addEventListener('DOMContentLoaded', () => {
  // Pre-llenar fechas al mes actual
  const fd = document.getElementById('fechaDesde'),
        fh = document.getElementById('fechaHasta');
  const hoy    = new Date(),
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  fd.value = inicio.toISOString().split('T')[0];
  fh.value = hoy   .toISOString().split('T')[0];

  // Listeners
  fd.addEventListener('change', actualizarDashboard);
  fh.addEventListener('change', actualizarDashboard);
  document.getElementById('filtroMaquinaCSV')
          .addEventListener('change', actualizarDashboard);

  // Arrancar
  actualizarDashboard();
});
