// dashboard.js
// Configuración inicial y variables globales
let supabaseClient;
let usuario;
let maquinasActivas = [];
let ventas = [];

// URL fija de Supabase para evitar problemas con variables de entorno
const SUPABASE_URL = 'https://ikuouxllerfjnibjtlkl.supabase.co'; 
// Debug - Mostrar mensajes en la consola para diagnóstico
const DEBUG = true;

function log(message, data) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

// Fechas por defecto
const hoy = new Date();
const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

// Elementos UI
const loadingEl = () => document.getElementById('loading') || { classList: { remove: () => {}, add: () => {} }};
const errorModal = document.getElementById('errorModal') || { classList: { remove: () => {}, add: () => {} }};
const errorMsg = document.getElementById('errorMessage') || { textContent: '' };

// Mostrar/Ocultar loading spinner
function showLoading() {
  loadingEl().classList.remove('hidden');
}
function hideLoading() {
  loadingEl().classList.add('hidden');
}

// Mostrar error en modal
function showError(msg) {
  console.error(`[ERROR] ${msg}`);
  
  if (errorMsg) {
    errorMsg.textContent = msg;
  }
  
  if (errorModal) {
    errorModal.classList.remove('hidden');
  } else {
    // Crear un modal de error si no existe
    const tempModal = document.createElement('div');
    tempModal.style.cssText = 'position:fixed;top:20px;right:20px;background:red;color:white;padding:10px;border-radius:5px;z-index:9999;';
    tempModal.textContent = msg;
    document.body.appendChild(tempModal);
    setTimeout(() => tempModal.remove(), 5000);
  }
}

// Inicializar Supabase con variables de entorno
function inicializarSupabase() {
  try {
    // Intentar obtener la clave de las variables de entorno
    const key = window.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!key) {
      log('No se encontró la clave anónima de Supabase en las variables de entorno');
      // Intentar recuperar de localStorage como último recurso
      const savedKey = localStorage.getItem('supabaseAnonKey');
      
      if (!savedKey) {
        showError('No se pudo encontrar la clave de Supabase. Por favor, inicia sesión nuevamente.');
        return false;
      }
      
      log('Usando clave de Supabase guardada en localStorage');
      supabaseClient = supabase.createClient(SUPABASE_URL, savedKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      });
    } else {
      // Guardar la clave para uso futuro
      localStorage.setItem('supabaseAnonKey', key);
      log('Inicializando Supabase con clave de variables de entorno');
      supabaseClient = supabase.createClient(SUPABASE_URL, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
    return false;
  }
}

// Verificar sesión del usuario
async function verificarSesion() {
  try {
    log('Verificando sesión de usuario');
    
    // Primero intentar usar sesión guardada localmente
    const localUserData = localStorage.getItem('userData');
    const sessionTimestamp = localStorage.getItem('sessionTimestamp');
    
    // Si hay datos guardados y no han pasado 30 minutos
    if (localUserData && sessionTimestamp) {
      const thirtyMinutesInMillis = 30 * 60 * 1000;
      const currentTime = new Date().getTime();
      const savedTime = parseInt(sessionTimestamp, 10);
      
      if (!isNaN(savedTime) && (currentTime - savedTime) < thirtyMinutesInMillis) {
        log('Usando sesión guardada en localStorage (menos de 30 minutos)');
        usuario = JSON.parse(localUserData);
        return true;
      }
    }
    
    // Si no hay sesión local válida, verificar con Supabase
    if (!inicializarSupabase()) {
      log('Fallo al inicializar Supabase');
      return false;
    }
    
    // Verificar la sesión actual con Supabase
    const { data, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      log('Error al verificar sesión con Supabase', error);
      showError('Error al verificar sesión: ' + error.message);
      setTimeout(() => location.href = '/login.html', 2000);
      return false;
    }
    
    // Si no hay sesión activa en Supabase
    if (!data || !data.session) {
      log('No hay sesión activa en Supabase');
      
      // Intentar usar el token de actualización si existe
      const refreshToken = localStorage.getItem('supabaseRefreshToken');
      if (refreshToken) {
        try {
          log('Intentando renovar sesión con refresh token');
          const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession({ refresh_token: refreshToken });
          
          if (!refreshError && refreshData.session) {
            log('Sesión renovada exitosamente con refresh token');
            usuario = refreshData.session.user;
            // Guardar la sesión renovada
            localStorage.setItem('userData', JSON.stringify(usuario));
            localStorage.setItem('sessionTimestamp', new Date().getTime().toString());
            localStorage.setItem('supabaseRefreshToken', refreshData.session.refresh_token);
            return true;
          } else {
            log('No se pudo renovar la sesión con refresh token', refreshError);
          }
        } catch (e) {
          log('Error al renovar sesión con refresh token', e);
        }
      }
      
      // Si llegamos aquí, no hay sesión válida
      showError('Tu sesión ha expirado. Redirigiendo al login...');
      setTimeout(() => location.href = '/login.html', 2000);
      return false;
    }
    
    // Tenemos una sesión válida de Supabase
    log('Sesión de Supabase válida');
    usuario = data.session.user;
    
    // Guardar datos para futuras verificaciones
    localStorage.setItem('userData', JSON.stringify(usuario));
    localStorage.setItem('sessionTimestamp', new Date().getTime().toString());
    
    if (data.session.refresh_token) {
      localStorage.setItem('supabaseRefreshToken', data.session.refresh_token);
    }
    
    // Configurar botón de logout si existe
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        log('Cerrando sesión');
        // Limpiar storage local
        localStorage.removeItem('userData');
        localStorage.removeItem('sessionTimestamp');
        localStorage.removeItem('supabaseRefreshToken');
        
        try {
          await supabaseClient.auth.signOut();
        } catch (e) {
          log('Error al cerrar sesión con Supabase', e);
        }
        
        location.href = '/login.html';
      });
    }
    
    return true;
  } catch (e) {
    console.error('Error inesperado al verificar sesión:', e);
    showError('Error al verificar tu sesión. Por favor, intenta recargar la página.');
    return false;
  }
}
// Cargar máquinas con suscripción activa
async function obtenerMaquinasActivas() {
  try {
    log('Obteniendo máquinas activas');
    
    // Comprobar si tenemos el usuario
    if (!usuario || !usuario.id) {
      log('No hay usuario para obtener máquinas');
      return;
    }
    
    // Solo máquinas con suscripcion_hasta > hoy
    const hoyISO = hoy.toISOString().split('T')[0];
    log(`Consultando máquinas con suscripción posterior a ${hoyISO}`);
    
    // Usar el campo correcto de la tabla: user_id (según la imagen proporcionada)
    const { data, error } = await supabaseClient
      .from('maquinas')
      .select('*')
      .eq('user_id', usuario.id)
      .gt('suscripcion_hasta', hoyISO);
      
    if (error) {
      log('Error al obtener máquinas activas', error);
      throw error;
    }
    
    maquinasActivas = data || [];
    log(`Encontradas ${maquinasActivas.length} máquinas activas`);
    
    // Actualizar selector de máquinas
    const sel = document.getElementById('filtroMaquinaCSV');
    if (sel) {
      sel.innerHTML = '<option value="">Todas</option>';
      
      if (!maquinasActivas.length) {
        log('No hay máquinas activas');
        showError('No tienes máquinas con suscripción vigente.');
        return;
      }
      
      // Usar el campo 'nombre' en lugar de 'name' según la imagen
      maquinasActivas.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.nombre || 'Sin nombre'}</option>`;
      });
    } else {
      log('No se encontró el selector de máquinas en el DOM');
    }
  } catch (e) {
    console.error('Error al obtener máquinas activas:', e);
    showError(`Error al cargar máquinas: ${e.message}`);
  }
}

// Cargar ventas filtradas por fecha y máquina activa
async function obtenerVentas() {
  try {
    const desde = document.getElementById('fechaDesde')?.value;
    const hasta = document.getElementById('fechaHasta')?.value;
    
    if (!desde || !hasta) {
      throw new Error('Selecciona rango de fechas');
    }
    
    log(`Consultando ventas desde ${desde} hasta ${hasta}`);
    
    const h = new Date(hasta);
    h.setDate(h.getDate() + 1);
    
    // Usar user_id en lugar de id_usuario según estructura de la DB
    let query = supabaseClient
      .from('ventas')
      .select('*, maquinas:id_maquina(nombre, ubicacion)')
      .eq('user_id', usuario.id)
      .gte('fecha', desde)
      .lt('fecha', h.toISOString().split('T')[0]);
    
    const filtroMaquina = document.getElementById('filtroMaquinaCSV')?.value;
    if (filtroMaquina) {
      query = query.eq('id_maquina', filtroMaquina);
    } else {
      // Si no se selecciona máquina, filtrar solo máquinas activas
      const ids = maquinasActivas.map(m => m.id);
      if (ids.length > 0) {
        query = query.in('id_maquina', ids);
      }
    }
    
    const { data, error } = await query.order('fecha', { ascending: false });
    if (error) throw error;
    
    ventas = data || [];
    
    // Si el campo 'importe' no existe, intentar usar 'precio_total'
    if (ventas.length > 0 && ventas[0].precio_total !== undefined && ventas[0].importe === undefined) {
      ventas = ventas.map(v => ({
        ...v,
        importe: v.precio_total,
        unidades: v.unidades || v.litros || 1
      }));
    }
  } catch (e) {
    console.error('Error al obtener ventas:', e);
    showError(`Error al cargar ventas: ${e.message}`);
    ventas = [];
  }
}

// Actualizar todo el dashboard
async function actualizarDashboard() {
  showLoading();
  try {
    log('Actualizando dashboard...');
    
    const sesionValida = await verificarSesion();
    if (!sesionValida) return;
    
    log('Usuario actual:', usuario ? { id: usuario.id, email: usuario.email } : 'No hay usuario');
    
    await obtenerMaquinasActivas();
    
    if (maquinasActivas && maquinasActivas.length > 0) {
      await obtenerVentas();
      renderResumen();
      renderGraficas();
    } else {
      log('No hay máquinas activas para obtener ventas');
      const resumenEl = document.getElementById('resumen');
      if (resumenEl) {
        resumenEl.innerHTML = `
          <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <h3 class="text-xl font-bold">Sin datos disponibles</h3>
            <p>No tienes máquinas con suscripción activa. Por favor, activa una suscripción.</p>
            <a href="/subscripcion.html" class="text-blue-500 hover:underline mt-2 inline-block">Ir a Subscripciones</a>
          </div>
        `;
      }
    }
    
    log('Dashboard actualizado correctamente');
  } catch (e) {
    console.error('Error al actualizar dashboard:', e);
    showError(`Error al cargar datos: ${e.message}`);
  } finally {
    hideLoading();
  }
}

// Renderizar tarjetas de resumen
function renderResumen() {
  try {
    if (!ventas || !ventas.length) {
      log('No hay ventas para mostrar en el resumen');
      const resumenEl = document.getElementById('resumen');
      if (resumenEl) {
        resumenEl.innerHTML = `
          <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <h3 class="text-xl font-bold">Sin datos</h3>
            <p>No hay ventas en el período seleccionado</p>
          </div>
        `;
      }
      return;
    }
    
    const total = ventas.reduce((sum, v) => sum + (v.importe || v.precio_total || 0), 0);
    const unidades = ventas.reduce((sum, v) => sum + (v.unidades || v.litros || 1), 0);
    const trans = new Set(ventas.map(v => v.id)).size;
    
    const desde = new Date(document.getElementById('fechaDesde')?.value || '');
    const hasta = new Date(document.getElementById('fechaHasta')?.value || '');
    const dias = !isNaN(desde) && !isNaN(hasta) ? 
                Math.max(1, Math.ceil((hasta - desde) / (1000*60*60*24)) + 1) : 1;
    const diario = total / dias;
    
    const resumenEl = document.getElementById('resumen');
    if (!resumenEl) return;
    
    resumenEl.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h3 class="text-xl font-bold">$${total.toFixed(2)}</h3>
        <p>Ventas Totales</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h3 class="text-xl font-bold">${unidades.toFixed(2)}</h3>
        <p>Litros Vendidos</p>
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
  } catch (e) {
    console.error('Error al renderizar resumen:', e);
    showError(`Error al mostrar resumen: ${e.message}`);
  }
}

// Renderizar gráficas con Chart.js
function renderGraficas() {
  try {
    if (!ventas || !ventas.length || typeof Chart === 'undefined') return;
    
    // Ventas por hora
    const byHour = Array(24).fill(0);
    ventas.forEach(v => {
      const fecha = v.fecha || '';
      if (fecha && typeof fecha === 'string') {
        const d = new Date(fecha);
        if (!isNaN(d.getTime())) {
          byHour[d.getHours()] += (v.importe || v.precio_total || 0);
        }
      }
    });
    
    const ctxH = document.getElementById('graficaHoras')?.getContext('2d');
    if (ctxH) {
      if (window.grafH) window.grafH.destroy();
      window.grafH = new Chart(ctxH, {
        type: 'line',
        data: { 
          labels: Array.from({length:24},(_,i)=>`${i}:00`), 
          datasets: [{ 
            label:'Ventas ($)', 
            data: byHour, 
            fill: true, 
            tension: 0.3,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)'
          }] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          scales: { y: { beginAtZero: true } } 
        }
      });
    }

    // Ventas por día
    const byDay = {};
    ventas.forEach(v => {
      if (v.fecha && typeof v.fecha === 'string') {
        const day = v.fecha.split('T')[0];
        byDay[day] = (byDay[day] || 0) + (v.importe || v.precio_total || 0);
      }
    });
    
    const days = Object.keys(byDay).sort();
    const vals = days.map(d => byDay[d]);
    
    const ctxD = document.getElementById('graficaDias')?.getContext('2d');
    if (ctxD) {
      if (window.grafD) window.grafD.destroy();
      window.grafD = new Chart(ctxD, {
        type: 'bar',
        data: { 
          labels: days, 
          datasets: [{ 
            label: 'Ventas ($)', 
            data: vals,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          scales: { y: { beginAtZero: true } } 
        }
      });
    }

    // Renderizar las otras gráficas
    renderGraficasMaquinas();
    renderGraficasProductos();
  } catch (e) {
    console.error('Error al renderizar gráficas:', e);
    showError(`Error al mostrar gráficas: ${e.message}`);
  }
}

// Gráficas adicionales para evitar código muy extenso
function renderGraficasMaquinas() {
  try {
    const byM = {};
    ventas.forEach(v => {
      let nombreMaquina = 'Desconocida';
      if (v.maquinas && typeof v.maquinas === 'object' && v.maquinas.nombre) {
        nombreMaquina = v.maquinas.nombre;
      } else if (v.id_maquina && maquinasActivas) {
        const maquina = maquinasActivas.find(m => m.id === v.id_maquina);
        nombreMaquina = maquina ? maquina.nombre : `ID: ${v.id_maquina}`;
      }
      byM[nombreMaquina] = (byM[nombreMaquina] || 0) + (v.importe || v.precio_total || 0);
    });
    
    const ms = Object.keys(byM), ims = ms.map(m => byM[m]);
    
    const ctxM = document.getElementById('graficaMaquinas')?.getContext('2d');
    if (ctxM) {
      if (window.grafM) window.grafM.destroy();
      window.grafM = new Chart(ctxM, {
        type: 'bar',
        data: { 
          labels: ms, 
          datasets: [{ 
            label: 'Ventas ($)', 
            data: ims,
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1
          }] 
        },
        options: { 
          indexAxis: 'y', 
          responsive: true, 
          maintainAspectRatio: false, 
          scales: { x: { beginAtZero: true } } 
        }
      });
    }
  } catch (e) {
    console.error('Error en gráfica de máquinas:', e);
  }
}

function renderGraficasProductos() {
  try {
    const byProd = {};
    ventas.forEach(v => {
      const prod = v.producto || `Litros: ${v.litros || 'N/A'}`;
      byProd[prod] = (byProd[prod] || 0) + (v.unidades || v.litros || 1);
    });
    
    const prods = Object.keys(byProd), nums = prods.map(p => byProd[p]);
    
    const ctxV = document.getElementById('graficaVolumen')?.getContext('2d');
    if (ctxV) {
      if (window.grafV) window.grafV.destroy();
      window.grafV = new Chart(ctxV, {
        type: 'pie',
        data: { 
          labels: prods, 
          datasets: [{ 
            data: nums,
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)',
              'rgba(75, 192, 192, 0.2)',
              'rgba(153, 102, 255, 0.2)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
            ],
            borderWidth: 1
          }] 
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          plugins: { legend: { position: 'right' } } 
        }
      });
    }
  } catch (e) {
    console.error('Error en gráfica de productos:', e);
  }
}

// Generar y descargar CSV
function descargarCSV() {
  try {
    if (!ventas || !ventas.length) {
      showError('Sin datos para exportar');
      return;
    }
    
    const filtro = document.getElementById('filtroMaquinaCSV')?.value;
    let list = ventas;
    
    if (filtro) {
      list = list.filter(v => v.id_maquina == filtro);
    }
    
    if (!list.length) {
      showError('No hay datos con ese filtro');
      return;
    }
    
    const headers = ['Fecha', 'Hora', 'Máquina', 'Ubicación', 'Litros', 'Importe'];
    
    const rows = list.map(v => {
      const d = new Date(v.fecha);
      let nombreMaquina = 'Desconocida';
      let ubicacion = '-';
      
      if (v.maquinas && typeof v.maquinas === 'object') {
        nombreMaquina = v.maquinas.nombre || 'Sin nombre';
        ubicacion = v.maquinas.ubicacion || '-';
      } else if (v.id_maquina && maquinasActivas) {
        const maquina = maquinasActivas.find(m => m.id === v.id_maquina);
        if (maquina) {
          nombreMaquina = maquina.nombre || 'Sin nombre';
          ubicacion = maquina.ubicacion || '-';
        }
      }
      
      return [
        d.toLocaleDateString(), 
        d.toLocaleTimeString(), 
        nombreMaquina, 
        ubicacion, 
        v.litros || v.unidades || '1',
        v.importe || v.precio_total || '0'
      ].map(x => `"${x}"`).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const d0 = document.getElementById('fechaDesde')?.value || '';
    const d1 = document.getElementById('fechaHasta')?.value || '';
    a.download = `ventas_${d0}_a_${d1}.csv`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('CSV descargado exitosamente');
  } catch (e) {
    console.error('Error al descargar CSV:', e);
    showError(`Error al generar CSV: ${e.message}`);
  }
}

// Listeners iniciales
window.addEventListener('DOMContentLoaded', () => {
  console.log('TrackMyVend Dashboard cargando...');
  
  try {
    // Comprobar si la biblioteca Supabase está disponible
    if (!window.supabase) {
      console.error('Error: La biblioteca Supabase no está cargada.');
      showError('Error: Biblioteca Supabase no disponible. Recarga la página.');
      return;
    }
    
    // Configurar fechas predeterminadas
    const fechaDesdeEl = document.getElementById('fechaDesde');
    const fechaHastaEl = document.getElementById('fechaHasta');
    
    if (fechaDesdeEl) {
      fechaDesdeEl.value = inicioMes.toISOString().split('T')[0];
      fechaDesdeEl.addEventListener('change', actualizarDashboard);
    }
    
    if (fechaHastaEl) {
      fechaHastaEl.value = hoy.toISOString().split('T')[0];
      fechaHastaEl.addEventListener('change', actualizarDashboard);
    }
    
    // Configurar otros elementos de UI
    const filtroMaquina = document.getElementById('filtroMaquinaCSV');
    if (filtroMaquina) {
      filtroMaquina.addEventListener('change', actualizarDashboard);
    }
    
    const btnDescargar = document.getElementById('btnDescargarCSV');
    if (btnDescargar) {
      btnDescargar.addEventListener('click', descargarCSV);
    }
    
    // Inicializar dashboard
    actualizarDashboard();
    
  } catch (e) {
    console.error('Error durante la inicialización:', e);
    showError(`Error al inicializar: ${e.message}`);
  }
});
