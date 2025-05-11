// Utility functions
function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('hidden');
  } else {
    console.error("Loading element not found");
    showError("Error interno: Elemento de carga no encontrado.");
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
    console.error("Error displayed:", message);
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
    console.log("Debug info:", obj);
  } else {
    console.error("Debug modal elements not found:", obj);
  }
}

// Show login prompt
function showLoginPrompt() {
  const container = document.querySelector('.container.mx-auto');
  if (!container) {
    console.error("Container not found for login prompt");
    showError("Error interno: No se pudo cargar el formulario de inicio de sesión.");
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
    showError("Error interno: No se pudo cargar el botón de inicio de sesión.");
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
      console.log("Supabase URL:", window.env.SUPABASE_URL);
      console.log("Anon Key (first 10 chars):", window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + "...");

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("Login error:", error);
        showError("Error al iniciar sesión: " + error.message);
        hideLoading();
        return;
      }

      console.log("Login successful, session data:", data.session);
      usuario = data.user;
      console.log("Usuario autenticado:", usuario.email);

      // Verify session persistence
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !sessionData.session) {
        console.error("Error refreshing session:", sessionError || "No session found");
        showError("Error al refrescar la sesión: " + (sessionError?.message || "No se encontró la sesión"));
        hideLoading();
        return;
      }

      console.log("Session after login:", sessionData);
      hideLoading();
      actualizarDashboard();
    } catch (error) {
      console.error("Unexpected error during login:", error);
      showError("Error inesperado al iniciar sesión: " + (error.message || 'Desconocido'));
      hideLoading();
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
  if (supabaseClient) {
    console.log("Supabase client already initialized");
    return true;
  }

  if (!window.env) {
    console.error("window.env is not defined");
    showError("Error: Configuración del entorno no encontrada.");
    return false;
  }

  if (!window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('{{')) {
    console.error("Supabase API key not injected:", window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    showError("Error: Clave API de Supabase no configurada correctamente. Contacte al soporte técnico.");
    return false;
  }

  try {
    console.log("Initializing Supabase with URL:", window.env.SUPABASE_URL);
    console.log("Anon Key (first 10 chars):", window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + "...");
    supabaseClient = supabase.createClient(
      window.env.SUPABASE_URL || 'https://ikuouxllerjnibjtkll.supabase.co',
      window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log("Supabase initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing Supabase:", error);
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
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    console.log("Session data:", sessionData);
    console.log("Session error:", sessionError);

    if (sessionError) {
      console.error("Error verifying session:", sessionError);
      showError("Error al verificar tu sesión: " + sessionError.message);
      return false;
    }

    if (!sessionData.session) {
      // Additional check using getUser to confirm authentication state
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData.user) {
        console.log("No active session - showing login prompt");
        showLoginPrompt();
        return false;
      }
      usuario = userData.user;
    } else {
      usuario = sessionData.session.user;
    }

    console.log("User authenticated:", usuario.email);
    return true;
  } catch (error) {
    console.error("Unexpected error verifying session:", error);
    showError("Error inesperado al verificar la sesión: " + (error.message || 'Desconocido'));
    return false;
  }
}

// Cerrar sesión de usuario
async function cerrarSesion() {
  try {
    console.log("Attempting to sign out...");
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
      throw error;
    }
    console.log("Session closed, reloading page");
    usuario = null;
    actualizarDashboard(); // Reload to show login prompt
  } catch (error) {
    console.error("Error closing session:", error);
    showError("Error al cerrar sesión: " + error.message);
  }
}

// Obtener datos de las máquinas
async function obtenerMaquinas() {
  try {
    if (!usuario || !usuario.id) {
      console.error("No authenticated user");
      showError("No hay usuario autenticado para obtener máquinas.");
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
    console.log("Machines retrieved:", maquinas.length);

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
    console.error("Error fetching machines:", error);
    showError("Error al cargar las máquinas: " + error.message);
    return false;
  }
}

// Obtener datos de ventas
async function obtenerVentas() {
  try {
    if (!usuario || !usuario.id) {
      console.error("No authenticated user");
      showError("No hay usuario autenticado para obtener ventas.");
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

    console.log(`Fetching sales from ${fechaDesde} to ${fechaHastaAjustada}`);

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
    console.log("Sales retrieved:", ventas.length);

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
    console.error("Error fetching sales:", error);
    showError("Error al cargar los datos de ventas: " + error.message);
    return false;
  }
}

// Actualizar el dashboard
async function actualizarDashboard() {
  showLoading();

  try {
    console.log("Updating dashboard...");
    const sesionValida = await verificarSesion();
    if (!sesionValida) {
      console.log("Session not valid, stopping dashboard update");
      hideLoading();
      return;
    }

    console.log("Session valid, proceeding with data fetch");
    const maquinasObtenidas = await obtenerMaquinas();
    if (!maquinasObtenidas) {
      console.log("Failed to fetch machines");
      hideLoading();
      return;
    }

    const ventasObtenidas = await obtenerVentas();
    if (!ventasObtenidas) {
      console.log("Failed to fetch sales");
      hideLoading();
      return;
    }

    if (ventas.length > 0) {
      actualizarTarjetasResumen();
      actualizarGraficas();
    } else {
      console.log("No sales data to display");
    }
  } catch (error) {
    console.error("Error updating dashboard:", error);
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
    console.error("Error updating summary cards:", error);
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
    console.error("Error updating charts:", error);
    showError("Error al actualizar las gráficas: " + error.message);
  }
}

// Gráfica de ventas por hora
function actualizarGraficaHoras() {
  try {
    const canvas = document.getElementById('graficaHoras');
    if (!canvas) {
      console.error("Canvas 'graficaHoras' not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context for 'graficaHoras'");
      return;
    }

    if (window.graficaHorasChart) {
      window.graficaHorasChart.destroy();
    }

    const ventasPorHora = Array(24).fill(0);
    ventas.forEach(venta => {
      if (!venta.fecha) return;
      try {
        const fecha = new Date(venta.fecha);
        const hora = fecha.getHours();
        ventasPorHora[hora] += venta.importe || 0;
      } catch (e) {
        console.warn("Error processing date:", venta.fecha, e);
      }
    });

    const etiquetas = Array(24).fill().map((_, i) => `${i}:00`);

    window.graficaHorasChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [{
          label: 'Ventas ($)',
          data: ventasPorHora,
          borderColor: '#4c51bf',
          backgroundColor: 'rgba(76, 81, 191, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Error in hourly sales chart:", error);
  }
}

// Gráfica de ventas por día
function actualizarGraficaDias() {
  try {
    const canvas = document.getElementById('graficaDias');
    if (!canvas) {
      console.error("Canvas 'graficaDias' not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context for 'graficaDias'");
      return;
    }

    if (window.graficaDiasChart) {
      window.graficaDiasChart.destroy();
    }

    const ventasPorDia = {};
    ventas.forEach(venta => {
      if (!venta.fecha) return;
      try {
        const fecha = venta.fecha.split('T')[0];
        ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + (venta.importe || 0);
      } catch (e) {
        console.warn("Error processing date for daily chart:", venta.fecha, e);
      }
    });

    const fechas = Object.keys(ventasPorDia).sort();
    const importes = fechas.map(fecha => ventasPorDia[fecha]);

    window.graficaDiasChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: fechas,
        datasets: [{
          label: 'Ventas ($)',
          data: importes,
          backgroundColor: '#38b2ac',
          borderColor: '#2c9b94',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Error in daily sales chart:", error);
  }
}

// Gráfica de volumen vendido
function actualizarGraficaVolumen() {
  try {
    const canvas = document.getElementById('graficaVolumen');
    if (!canvas) {
      console.error("Canvas 'graficaVolumen' not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context for 'graficaVolumen'");
      return;
    }

    if (window.graficaVolumenChart) {
      window.graficaVolumenChart.destroy();
    }

    const unidadesPorProducto = {};
    ventas.forEach(venta => {
      const producto = venta.producto || 'Sin especificar';
      unidadesPorProducto[producto] = (unidadesPorProducto[producto] || 0) + (venta.unidades || 0);
    });

    const productos = Object.keys(unidadesPorProducto);
    const unidades = productos.map(producto => unidadesPorProducto[producto]);

    if (productos.length === 0) {
      const parentElement = canvas.parentElement;
      if (parentElement) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'text-center py-16 text-gray-500 dark:text-gray-400';
        noDataMsg.innerHTML = 'No hay datos disponibles para este período';
        canvas.style.display = 'none';
        parentElement.appendChild(noDataMsg);
      }
      return;
    }

    const parentElement = canvas.parentElement;
    const existingMsg = parentElement?.querySelector('.text-center.py-16');
    if (existingMsg) parentElement.removeChild(existingMsg);
    canvas.style.display = 'block';

    window.graficaVolumenChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: productos,
        datasets: [{
          data: unidades,
          backgroundColor: [
            '#f56565', '#ed8936', '#ecc94b', '#48bb78',
            '#38b2ac', '#4299e1', '#667eea', '#9f7aea',
            '#ed64a6', '#a0aec0'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  } catch (error) {
    console.error("Error in sales volume chart:", error);
  }
}

// Gráfica de rendimiento por máquina
function actualizarGraficaMaquinas() {
  try {
    const canvas = document.getElementById('graficaMaquinas');
    if (!canvas) {
      console.error("Canvas 'graficaMaquinas' not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context for 'graficaMaquinas'");
      return;
    }

    if (window.graficaMaquinasChart) {
      window.graficaMaquinasChart.destroy();
    }

    const ventasPorMaquina = {};
    ventas.forEach(venta => {
      const maquinaId = venta.id_maquina;
      const maquinaNombre = venta.maquinas?.nombre || null;
      const nombreMostrar = maquinaNombre || `Máquina ${maquinaId}`;
      ventasPorMaquina[nombreMostrar] = (ventasPorMaquina[nombreMostrar] || 0) + (venta.importe || 0);
    });

    const maquinas = Object.keys(ventasPorMaquina);
    const importes = maquinas.map(maquina => ventasPorMaquina[maquina]);

    if (maquinas.length === 0) {
      const parentElement = canvas.parentElement;
      if (parentElement) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'text-center py-16 text-gray-500 dark:text-gray-400';
        noDataMsg.innerHTML = 'No hay datos disponibles para este período';
        canvas.style.display = 'none';
        parentElement.appendChild(noDataMsg);
      }
      return;
    }

    const parentElement = canvas.parentElement;
    const existingMsg = parentElement?.querySelector('.text-center.py-16');
    if (existingMsg) parentElement.removeChild(existingMsg);
    canvas.style.display = 'block';

    window.graficaMaquinasChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: maquinas,
        datasets: [{
          label: 'Ventas ($)',
          data: importes,
          backgroundColor: '#4299e1',
          borderColor: '#3182ce',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Error in machine performance chart:", error);
  }
}

// Generar CSV de ventas
function generarCSV() {
  try {
    if (!ventas || ventas.length === 0) {
      showError("No hay datos para exportar");
      return;
    }

    const filtroMaquina = document.getElementById('filtroMaquinaCSV').value;
    let ventasFiltradas = ventas;

    if (filtroMaquina) {
      ventasFiltradas = ventas.filter(venta => venta.id_maquina == filtroMaquina);
    }

    if (ventasFiltradas.length === 0) {
      showError("No hay datos para exportar con los filtros seleccionados");
      return;
    }

    const cabeceras = ['Fecha', 'Hora', 'Máquina', 'Ubicación', 'Producto', 'Unidades', 'Importe'];

    const filas = ventasFiltradas.map(venta => {
      const fecha = new Date(venta.fecha);
      const fechaFormateada = fecha.toLocaleDateString();
      const horaFormateada = fecha.toLocaleTimeString();
      return [
        fechaFormateada,
        horaFormateada,
        venta.maquinas?.nombre || `Máquina ${venta.id_maquina}`,
        venta.maquinas?.ubicacion || 'No especificada',
        venta.producto || 'No especificado',
        venta.unidades || 0,
        venta.importe || 0
      ];
    });

    const csvContent = [
      cabeceras.join(','),
      ...filas.map(fila => fila.map(valor => `"${valor}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreArchivo = `ventas_${fechaActual}.csv`;

    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);

    console.log("CSV generated and downloaded");
  } catch (error) {
    console.error("Error generating CSV:", error);
    showError("Error al generar el archivo CSV: " + error.message);
  }
}

// Inicializar event listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded, initializing dashboard...");
  const fechaDesde = document.getElementById('fechaDesde');
  const fechaHasta = document.getElementById('fechaHasta');
  const btnLogout = document.getElementById('btnLogout');
  const btnDescargarCSV = document.getElementById('btnDescargarCSV');

  if (fechaDesde && fechaHasta) {
    fechaDesde.value = inicioMes.toISOString().split('T')[0];
    fechaHasta.value = hoy.toISOString().split('T')[0];
    fechaDesde.addEventListener('change', actualizarDashboard);
    fechaHasta.addEventListener('change', actualizarDashboard);
  } else {
    console.error("Date inputs not found");
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async function(e) {
      e.preventDefault();
      await cerrarSesion();
    });
  } else {
    console.error("Logout button not found");
  }

  if (btnDescargarCSV) {
    btnDescargarCSV.addEventListener('click', generarCSV);
  } else {
    console.error("Download CSV button not found");
  }

  actualizarDashboard();
});
