// Utility functions
function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('hidden');
  } else {
    console.error("Loading element not found");
  }
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
  } else {
    console.error("Loading element not found");
  }
}

function showError(message) {
  const errorModal = document.getElementById('errorModal');
  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage && errorModal) {
    errorMessage.textContent = message;
    errorModal.classList.remove('hidden');
    console.error(message);
  } else {
    console.error("Error modal elements not found:", message);
  }
}

function showDebug(obj) {
  const debugModal = document.getElementById('debugModal');
  const debugMessage = document.getElementById('debugMessage');
  if (debugMessage && debugModal) {
    debugMessage.textContent = JSON.stringify(obj, null, 2);
    debugModal.classList.remove('hidden');
    console.log("Debug:", obj);
  } else {
    console.error("Debug modal elements not found:", obj);
  }
}

// Show login prompt
function showLoginPrompt() {
  const container = document.querySelector('.container.mx-auto');
  if (!container) {
    console.error("Container not found for login prompt");
    return;
  }

  container.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-auto mt-8">
      <h3 class="text-lg font-bold mb-4">Iniciar Sesión</h3>
      <p class="mb-4 text-gray-500 dark:text-gray-400">Por favor, inicia sesión para continuar.</p>
      <div class="space-y-4">
        <input type="email" id="loginEmail" placeholder="Correo electrónico" class="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />
        <input type="password" id="loginPassword" placeholder="Contraseña" class="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />
        <button id="loginButton" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Iniciar Sesión</button>
      </div>
    </div>
  `;

  const loginButton = document.getElementById('loginButton');
  if (!loginButton) {
    console.error("Login button not found after rendering prompt");
    return;
  }

  loginButton.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showError("Por favor, ingresa tu correo y contraseña.");
      return;
    }

    try {
      showLoading();
      console.log("Attempting login with email:", email);
      console.log("Supabase client initialized:", !!supabaseClient);
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      hideLoading();

      if (error) {
        console.error("Login error:", error);
        showError("Error al iniciar sesión: " + error.message);
        return;
      }

      console.log("Login successful, session data:", data.session);
      console.log("LocalStorage after login:", localStorage.getItem('supabase.auth.token'));
      usuario = data.user;
      console.log("Usuario autenticado:", usuario.email);
      // Force session refresh and update dashboard
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) {
        console.error("Error refreshing session:", sessionError);
        showError("Error al refrescar la sesión: " + sessionError.message);
        return;
      }
      console.log("Session after refresh:", sessionData);
      actualizarDashboard();
    } catch (error) {
      hideLoading();
      console.error("Unexpected error during login:", error);
      showError("Error inesperado al iniciar sesión: " + (error.message || 'Desconocido'));
    }
  });
}

// Variables globales
let supabaseClient;
let usuario;
let maquinas = [];
let ventas = [];

// Configuración de fechas por defecto
const hoy = new Date();
const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

// Inicialización segura de Supabase
function inicializarSupabase() {
  if (!window.env) {
    console.error("window.env is not defined");
    showError("Error: Configuración del entorno no encontrada.");
    return false;
  }

  if (!window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Missing Supabase API key in window.env");
    showError("Error: No se ha encontrado la clave API de Supabase. Por favor, contacte al soporte técnico.");
    return false;
  }

  try {
    console.log("Initializing Supabase with URL:", window.env.SUPABASE_URL);
    console.log("Anon Key:", window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    supabaseClient = supabase.createClient(
      window.env.SUPABASE_URL || 'https://ikuouxllerjnibjtkll.supabase.co',
      window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log("Supabase inicializado correctamente");
    return true;
  } catch (error) {
    console.error("Error al inicializar Supabase:", error);
    showError("Error al conectar con la base de datos: " + (error.message || 'Desconocido'));
    return false;
  }
}

// Verificar la sesión del usuario
async function verificarSesion() {
  try {
    if (!inicializarSupabase()) {
      console.error("Failed to initialize Supabase");
      return false;
    }

    console.log("Fetching session...");
    const { data, error } = await supabaseClient.auth.getSession();
    console.log("Datos de sesión completos:", data);
    console.log("Error en getSession:", error);
    console.log("LocalStorage token:", localStorage.getItem('supabase.auth.token'));

    if (error) {
      console.error("Error al verificar sesión:", error);
      showError("Error al verificar tu sesión: " + error.message);
      return false;
    }

    if (!data.session) {
      console.log("No hay sesión activa - mostrando formulario de login");
      showLoginPrompt();
      return false;
    }

    usuario = data.session.user;
    console.log("Usuario autenticado:", usuario.email);
    return true;
  } catch (error) {
    console.error("Error inesperado al verificar sesión:", error);
    showError("Error inesperado al verificar la sesión: " + (error.message || 'Desconocido'));
    return false;
  }
}

// Cerrar sesión de usuario
async function cerrarSesion() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    console.log("Sesión cerrada, recargando página");
    usuario = null;
    localStorage.removeItem('supabase.auth.token');
    console.log("LocalStorage after logout:", localStorage.getItem('supabase.auth.token'));
    actualizarDashboard(); // Reload to show login prompt
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    showError("Error al cerrar sesión: " + error.message);
  }
}

// Obtener datos de las máquinas
async function obtenerMaquinas() {
  try {
    if (!usuario || !usuario.id) {
      console.error("No hay usuario autenticado");
      return false;
    }

    console.log("Fetching machines for user ID:", usuario.id);
    const { data, error } = await supabaseClient
      .from('maquinas')
      .select('*')
      .eq('id_usuario', usuario.id);

    if (error) {
      console.error("Error fetching machines:", error);
      throw error;
    }

    maquinas = data || [];
    console.log("Máquinas obtenidas:", maquinas.length);

    const selectMaquina = document.getElementById('filtroMaquinaCSV');
    if (selectMaquina) {
      selectMaquina.innerHTML = '<option value="">Todas</option>';

      maquinas.forEach(maquina => {
        const option = document.createElement('option');
        option.value = maquina.id;
        option.textContent = maquina.nombre || `Máquina ${maquina.id}`;
        selectMaquina.appendChild(option);
      });
    }

    if (maquinas.length === 0) {
      showError("No tienes máquinas registradas. Ve a la sección 'Mis Máquinas' para agregar una.");
    }

    return true;
  } catch (error) {
    console.error("Error al obtener máquinas:", error);
    showError("Error al cargar las máquinas: " + error.message);
    return false;
  }
}

// Obtener datos de ventas
async function obtenerVentas() {
  try {
    if (!usuario || !usuario.id) {
      console.error("No hay usuario autenticado");
      return false;
    }

    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;

    if (!fechaDesde || !fechaHasta) {
      showError("Por favor, selecciona el rango de fechas");
      return false;
    }

    const fechaHastaObj = new Date(fechaHasta);
    fechaHastaObj.setDate(fechaHastaObj.getDate() + 1);
    const fechaHastaAjustada = fechaHastaObj.toISOString().split('T')[0];

    console.log(`Obteniendo ventas desde ${fechaDesde} hasta ${fechaHastaAjustada}`);

    let query = supabaseClient
      .from('ventas')
      .select(`
        *,
        maquinas (
          nombre,
          ubicacion
        )
      `)
      .eq('id_usuario', usuario.id)
      .gte('fecha', fechaDesde)
      .lt('fecha', fechaHastaAjustada)
      .order('fecha', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching sales:", error);
      throw error;
    }

    ventas = data || [];
    console.log("Ventas obtenidas:", ventas.length);

    if (ventas.length === 0) {
      document.getElementById('resumen').innerHTML = `
        <div class="col-span-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-center">
          <h3 class="text-xl font-bold mb-2">No hay datos para este período</h3>
          <p class="text-gray-500 dark:text-gray-400">Prueba con otro rango de fechas o agrega nuevas ventas.</p>
        </div>
      `;
    }

    return true;
  } catch (error) {
    console.error("Error al obtener ventas:", error);
    showError("Error al cargar los datos de ventas: " + error.message);
    return false;
  }
}

// Actualizar el dashboard
async function actualizarDashboard() {
  showLoading();

  try {
    const sesionValida = await verificarSesion();
    if (!sesionValida) {
      hideLoading();
      return;
    }

    const maquinasObtenidas = await obtenerMaquinas();
    if (!maquinasObtenidas) {
      hideLoading();
      return;
    }

    const ventasObtenidas = await obtenerVentas();
    if (!ventasObtenidas) {
      hideLoading();
      return;
    }

    if (ventas.length > 0) {
      actualizarTarjetasResumen();
      actualizarGraficas();
    }
  } catch (error) {
    console.error("Error al actualizar dashboard:", error);
    showError("Error al actualizar el dashboard: " + (error.message || "Desconocido"));
  } finally {
    hideLoading();
  }
}

// Actualizar tarjetas de resumen
function actualizarTarjetasResumen() {
  try {
    const totalVentas = ventas.reduce((sum, venta) => sum + (venta.importe || 0), 0);
    const totalUnidades = ventas.reduce((sum, venta) => sum + (venta.unidades || 0), 0);
    const ventasUnicas = new Set(ventas.map(v => v.id)).size;
    const promedioPorVenta = ventasUnicas > 0 ? totalVentas / ventasUnicas : 0;

    const fechaInicio = new Date(document.getElementById('fechaDesde').value);
    const fechaFin = new Date(document.getElementById('fechaHasta').value);
    const diasPeriodo = Math.max(1, Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1);
    const promedioVentasDiarias = diasPeriodo > 0 ? totalVentas / diasPeriodo : 0;

    document.getElementById('resumen').innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 class="text-xl font-bold">$${totalVentas.toFixed(2)}</h3>
        <p class="text-gray-500 dark:text-gray-400">Ventas totales</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 class="text-xl font-bold">${totalUnidades}</h3>
        <p class="text-gray-500 dark:text-gray-400">Unidades vendidas</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 class="text-xl font-bold">${ventasUnicas}</h3>
        <p class="text-gray-500 dark:text-gray-400">Transacciones</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 class="text-xl font-bold">$${promedioPorVenta.toFixed(2)}</h3>
        <p class="text-gray-500 dark:text-gray-400">Promedio por venta</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 class="text-xl font-bold">$${promedioVentasDiarias.toFixed(2)}</h3>
        <p class="text-gray-500 dark:text-gray-400">Promedio diario</p>
      </div>
    `;
  } catch (error) {
    console.error("Error al actualizar tarjetas de resumen:", error);
    showError("Error al actualizar las métricas: " + error.message);
  }
}

// Actualizar gráficas
function actualizarGraficas() {
  try {
    actualizarGraficaHoras();
    actualizarGraficaDias();
    actualizarGraficaVolumen();
    actualizarGraficaMaquinas();
  } catch (error) {
    console.error("Error al actualizar gráficas:", error);
    showError("Error al actualizar las gráficas: " + error.message);
  }
}

// Gráfica de ventas por hora
function actualizarGraficaHoras() {
  try {
    const ventasPorHora = Array(24).fill(0);

    ventas.forEach(venta => {
      if (!venta.fecha) return;

      try {
        const fecha = new Date(venta.fecha);
        const hora = fecha.getHours();
        ventasPorHora[hora] += venta.importe || 0;
      } catch (e) {
        console.warn("Error al procesar fecha:", venta.fecha, e);
      }
    });

    const etiquetas = Array(24).fill().map((_, i) => `${i}:00`);

    const canvas = document.getElementById('graficaHoras');
    if (!canvas) {
      console.error("Canvas 'graficaHoras' not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context for 'graficaHoras'");
     
