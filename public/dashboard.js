// Variables globales
let supabase;
let usuario;
let maquinas = [];
let ventas = [];

// Configuración de fechas por defecto
const hoy = new Date();
const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
document.getElementById('fechaDesde').valueAsDate = inicioMes;
document.getElementById('fechaHasta').valueAsDate = hoy;

// Inicialización segura de Supabase
function inicializarSupabase() {
  // Verificar que window.env existe y tiene la clave
  if (!window.env || !window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Missing Supabase API key");
    showError("Error: No se ha encontrado la clave API de Supabase. Por favor, contacte al soporte técnico.");
    return false;
  }

  try {
    // Crear cliente de Supabase
    supabase = supabase.createClient(
      'https://ikuouxllerjnibjtkll.supabase.co',
      window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    return true;
  } catch (error) {
    console.error("Error al inicializar Supabase:", error);
    showError("Error al conectar con la base de datos. Por favor, intente más tarde.");
    return false;
  }
}

// Verificar la sesión del usuario
async function verificarSesion() {
  try {
    // Primero asegurarse que Supabase está inicializado
    if (!inicializarSupabase()) {
      return false;
    }

    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error al verificar sesión:", error);
      window.location.href = '/login.html';
      return false;
    }
    
    if (!data.session) {
      console.log("No hay sesión activa");
      window.location.href = '/login.html';
      return false;
    }
    
    usuario = data.session.user;
    console.log("Usuario autenticado:", usuario.email);
    return true;
  } catch (error) {
    console.error("Error inesperado al verificar sesión:", error);
    showError("Error inesperado al verificar la sesión");
    return false;
  }
}

// Obtener datos de las máquinas
async function obtenerMaquinas() {
  try {
    const { data, error } = await supabase
      .from('maquinas')
      .select('*')
      .eq('id_usuario', usuario.id);
    
    if (error) throw error;
    
    maquinas = data;
    console.log("Máquinas obtenidas:", maquinas.length);
    
    // Llenar el selector de máquinas
    const selectMaquina = document.getElementById('filtroMaquinaCSV');
    selectMaquina.innerHTML = '<option value="">Todas</option>';
    
    maquinas.forEach(maquina => {
      const option = document.createElement('option');
      option.value = maquina.id;
      option.textContent = maquina.nombre;
      selectMaquina.appendChild(option);
    });
    
    return true;
  } catch (error) {
    console.error("Error al obtener máquinas:", error);
    showError("Error al cargar las máquinas");
    return false;
  }
}

// Obtener datos de ventas
async function obtenerVentas() {
  try {
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;
    
    // Añadir un día a fechaHasta para incluir el día seleccionado completo
    const fechaHastaObj = new Date(fechaHasta);
    fechaHastaObj.setDate(fechaHastaObj.getDate() + 1);
    const fechaHastaAjustada = fechaHastaObj.toISOString().split('T')[0];
    
    let query = supabase
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
    
    if (error) throw error;
    
    ventas = data;
    console.log("Ventas obtenidas:", ventas.length);
    
    return true;
  } catch (error) {
    console.error("Error al obtener ventas:", error);
    showError("Error al cargar los datos de ventas");
    return false;
  }
}

// Actualizar el dashboard
async function actualizarDashboard() {
  showLoading();
  
  if (await verificarSesion()) {
    if (await obtenerMaquinas()) {
      if (await obtenerVentas()) {
        actualizarTarjetasResumen();
        actualizarGraficas();
      }
    }
  }
  
  hideLoading();
}

// Actualizar tarjetas de resumen
function actualizarTarjetasResumen() {
  // Calcular métricas
  const totalVentas = ventas.reduce((sum, venta) => sum + venta.importe, 0);
  const totalUnidades = ventas.reduce((sum, venta) => sum + venta.unidades, 0);
  const ventasUnicas = new Set(ventas.map(v => v.id)).size;
  const promedioPorVenta = ventasUnicas > 0 ? totalVentas / ventasUnicas : 0;
  
  // Calcular ventas por día
  const fechaInicio = new Date(document.getElementById('fechaDesde').value);
  const fechaFin = new Date(document.getElementById('fechaHasta').value);
  const diasPeriodo = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
  const promedioVentasDiarias = diasPeriodo > 0 ? totalVentas / diasPeriodo : 0;
  
  // Actualizar HTML
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
}

// Actualizar gráficas
function actualizarGraficas() {
  actualizarGraficaHoras();
  actualizarGraficaDias();
  actualizarGraficaVolumen();
  actualizarGraficaMaquinas();
}

// Gráfica de ventas por hora
function actualizarGraficaHoras() {
  // Agrupar ventas por hora
  const ventasPorHora = Array(24).fill(0);
  
  ventas.forEach(venta => {
    const fecha = new Date(venta.fecha);
    const hora = fecha.getHours();
    ventasPorHora[hora] += venta.importe;
  });
  
  // Etiquetas para las horas
  const etiquetas = Array(24).fill().map((_, i) => `${i}:00`);
  
  // Crear o actualizar gráfica
  const ctx = document.getElementById('graficaHoras').getContext('2d');
  
  if (window.graficaHorasChart) {
    window.graficaHorasChart.destroy();
  }
  
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
}

// Gráfica de ventas por día
function actualizarGraficaDias() {
  // Agrupar ventas por día
  const ventasPorDia = {};
  
  ventas.forEach(venta => {
    const fecha = venta.fecha.split('T')[0];
    if (!ventasPorDia[fecha]) {
      ventasPorDia[fecha] = 0;
    }
    ventasPorDia[fecha] += venta.importe;
  });
  
  // Convertir a arrays para la gráfica
  const fechas = Object.keys(ventasPorDia).sort();
  const importes = fechas.map(fecha => ventasPorDia[fecha]);
  
  // Crear o actualizar gráfica
  const ctx = document.getElementById('graficaDias').getContext('2d');
  
  if (window.graficaDiasChart) {
    window.graficaDiasChart.destroy();
  }
  
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
}

// Gráfica de volumen vendido
function actualizarGraficaVolumen() {
  // Agrupar unidades por producto
  const unidadesPorProducto = {};
  
  ventas.forEach(venta => {
    const producto = venta.producto || 'Sin especificar';
    if (!unidadesPorProducto[producto]) {
      unidadesPorProducto[producto] = 0;
    }
    unidadesPorProducto[producto] += venta.unidades;
  });
  
  // Convertir a arrays para la gráfica
  const productos = Object.keys(unidadesPorProducto);
  const unidades = productos.map(producto => unidadesPorProducto[producto]);
  
  // Crear o actualizar gráfica
  const ctx = document.getElementById('graficaVolumen').getContext('2d');
  
  if (window.graficaVolumenChart) {
    window.graficaVolumenChart.destroy();
  }
  
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
}

// Gráfica de rendimiento por máquina
function actualizarGraficaMaquinas() {
  // Agrupar ventas por máquina
  const ventasPorMaquina = {};
  
  ventas.forEach(venta => {
    const maquinaId = venta.id_maquina;
    const maquinaNombre = venta.maquinas ? venta.maquinas.nombre : 'Desconocida';
    const nombreMostrar = maquinaNombre || `Máquina ${maquinaId}`;
    
    if (!ventasPorMaquina[nombreMostrar]) {
      ventasPorMaquina[nombreMostrar] = 0;
    }
    ventasPorMaquina[nombreMostrar] += venta.importe;
  });
  
  // Convertir a arrays para la gráfica
  const maquinas = Object.keys(ventasPorMaquina);
  const importes = maquinas.map(maquina => ventasPorMaquina[maquina]);
  
  // Crear o actualizar gráfica
  const ctx = document.getElementById('graficaMaquinas').getContext('2d');
  
  if (window.graficaMaquinasChart) {
    window.graficaMaquinasChart.destroy();
  }
  
  window.graficaMaquinasChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: maquinas,
      datasets: [{
        label: 'Ventas ($)',
        data: importes,
        backgroundColor: '#667eea',
        borderColor: '#5a67d8',
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
}

// Descargar datos en formato CSV
function descargarCSV() {
  // Filtrar por máquina si es necesario
  const filtroMaquina = document.getElementById('filtroMaquinaCSV').value;
  let ventasFiltradas = ventas;
  
  if (filtroMaquina) {
    ventasFiltradas = ventas.filter(venta => venta.id_maquina == filtroMaquina);
  }
  
  // Preparar encabezados
  const encabe
