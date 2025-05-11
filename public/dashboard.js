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
  // Verificar que window.env existe y tiene la clave
  if (!window.env || !window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Missing Supabase API key");
    showError("Error: No se ha encontrado la clave API de Supabase. Por favor, contacte al soporte técnico.");
    return false;
  }

  try {
    // Crear cliente de Supabase correctamente - usando el objeto global supabase
    supabaseClient = supabase.createClient(
      window.env.SUPABASE_URL || 'https://ikuouxllerjnibjtkll.supabase.co',
      window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log("Supabase inicializado correctamente");
    return true;
  } catch (error) {
    console.error("Error al inicializar Supabase:", error);
    showError("Error al conectar con la base de datos. Por favor, intente más tarde.");
    return false;
  }
}

async function verificarSesion() {
  try {
    // Primero asegurarse que Supabase está inicializado
    if (!inicializarSupabase()) {
      return false;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    
    // Añadir más información de depuración
    console.log("Datos de sesión recibidos:", data);
    
    if (error) {
      console.error("Error al verificar sesión:", error);
      showError("Error al verificar tu sesión: " + error.message);
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);
      return false;
    }
    
    if (!data.session) {
      console.log("No hay sesión activa - redirigiendo");
      
      // Verificar si hay datos en el almacenamiento local
      const localStorageData = localStorage.getItem('supabase.auth.token');
      console.log("Datos en localStorage:", localStorageData ? "Presentes" : "Ausentes");
      
      showError("No hay sesión activa. Redirigiendo al login...");
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);
      return false;
    }
    
    usuario = data.session.user;
    console.log("Usuario autenticado:", usuario.email);
    
    // Configurar botón de logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async function(e) {
        e.preventDefault();
        await cerrarSesion();
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error inesperado al verificar sesión:", error);
    showError("Error inesperado al verificar la sesión: " + (error.message || 'Desconocido'));
    return false;
  }
}
    
    usuario = data.session.user;
    console.log("Usuario autenticado:", usuario.email);
    
    // Configurar botón de logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async function(e) {
        e.preventDefault();
        await cerrarSesion();
      });
    }
    
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
    window.location.href = '/login.html';
  } catch (error) {
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
    
    const { data, error } = await supabaseClient
      .from('maquinas')
      .select('*')
      .eq('id_usuario', usuario.id);
    
    if (error) {
      throw error;
    }
    
    maquinas = data || [];
    console.log("Máquinas obtenidas:", maquinas.length);
    
    // Llenar el selector de máquinas
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
    
    // Si no hay máquinas, mostrar un mensaje
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
    
    // Añadir un día a fechaHasta para incluir el día seleccionado completo
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
      throw error;
    }
    
    ventas = data || [];
    console.log("Ventas obtenidas:", ventas.length);
    
    // Si no hay ventas, mostrar estado vacío
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
    
    // Solo actualizar gráficas si hay datos
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
    // Calcular métricas
    const totalVentas = ventas.reduce((sum, venta) => sum + (venta.importe || 0), 0);
    const totalUnidades = ventas.reduce((sum, venta) => sum + (venta.unidades || 0), 0);
    const ventasUnicas = new Set(ventas.map(v => v.id)).size;
    const promedioPorVenta = ventasUnicas > 0 ? totalVentas / ventasUnicas : 0;
    
    // Calcular ventas por día
    const fechaInicio = new Date(document.getElementById('fechaDesde').value);
    const fechaFin = new Date(document.getElementById('fechaHasta').value);
    const diasPeriodo = Math.max(1, Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1);
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
    // Agrupar ventas por hora
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
    
    // Etiquetas para las horas
    const etiquetas = Array(24).fill().map((_, i) => `${i}:00`);
    
    // Crear o actualizar gráfica
    const canvas = document.getElementById('graficaHoras');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
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
  } catch (error) {
    console.error("Error en gráfica de horas:", error);
  }
}

// Gráfica de ventas por día
function actualizarGraficaDias() {
  try {
    // Agrupar ventas por día
    const ventasPorDia = {};
    
    ventas.forEach(venta => {
      if (!venta.fecha) return;
      
      try {
        const fecha = venta.fecha.split('T')[0];
        if (!ventasPorDia[fecha]) {
          ventasPorDia[fecha] = 0;
        }
        ventasPorDia[fecha] += venta.importe || 0;
      } catch (e) {
        console.warn("Error al procesar fecha para gráfica de días:", venta.fecha, e);
      }
    });
    
    // Convertir a arrays para la gráfica
    const fechas = Object.keys(ventasPorDia).sort();
    const importes = fechas.map(fecha => ventasPorDia[fecha]);
    
    // Crear o actualizar gráfica
    const canvas = document.getElementById('graficaDias');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
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
  } catch (error) {
    console.error("Error en gráfica de días:", error);
  }
}

// Gráfica de volumen vendido
function actualizarGraficaVolumen() {
  try {
    // Agrupar unidades por producto
    const unidadesPorProducto = {};
    
    ventas.forEach(venta => {
      const producto = venta.producto || 'Sin especificar';
      if (!unidadesPorProducto[producto]) {
        unidadesPorProducto[producto] = 0;
      }
      unidadesPorProducto[producto] += venta.unidades || 0;
    });
    
    // Convertir a arrays para la gráfica
    const productos = Object.keys(unidadesPorProducto);
    const unidades = productos.map(producto => unidadesPorProducto[producto]);
    
    // Crear o actualizar gráfica
    const canvas = document.getElementById('graficaVolumen');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (window.graficaVolumenChart) {
      window.graficaVolumenChart.destroy();
    }
    
    // Si no hay datos, mostrar mensaje
    if (productos.length === 0) {
      const parentElement = canvas.parentElement;
      if (parentElement) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'text-center py-16 text-gray-500 dark:text-gray-400';
        noDataMsg.innerHTML = 'No hay datos disponibles para este período';
        
        // Asegurarse de que no hay mensaje previo
        const existingMsg = parentElement.querySelector('.text-center.py-16');
        if (existingMsg) parentElement.removeChild(existingMsg);
        
        canvas.style.display = 'none';
        parentElement.appendChild(noDataMsg);
      }
      return;
    }
    
    // Si hay datos, eliminar cualquier mensaje de no datos
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
    console.error("Error en gráfica de volumen:", error);
  }
}

// Gráfica de rendimiento por máquina
function actualizarGraficaMaquinas() {
  try {
    // Agrupar ventas por máquina
    const ventasPorMaquina = {};
    
    ventas.forEach(venta => {
      const maquinaId = venta.id_maquina;
      const maquinaNombre = venta.maquinas ? venta.maquinas.nombre : null;
      const nombreMostrar = maquinaNombre || `Máquina ${maquinaId}`;
      
      if (!ventasPorMaquina[nombreMostrar]) {
        ventasPorMaquina[nombreMostrar] = 0;
      }
      ventasPorMaquina[nombreMostrar] += venta.importe || 0;
    });
    
    // Convertir a arrays para la gráfica
    const maquinas = Object.keys(ventasPorMaquina);
    const importes = maquinas.map(maquina => ventasPorMaquina[maquina]);
    
    // Crear o actualizar gráfica
    const canvas = document.getElementById('graficaMaquinas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (window.graficaMaquinasChart) {
      window.graficaMaquinasChart.destroy();
    }
    
    // Si no hay datos, mostrar mensaje
    if (maquinas.length === 0) {
      const parentElement = canvas.parentElement;
      if (parentElement) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'text-center py-16 text-gray-500 dark:text-gray-400';
        noDataMsg.innerHTML = 'No hay datos disponibles para este período';
        
        // Asegurarse de que no hay mensaje previo
        const existingMsg = parentElement.querySelector('.text-center.py-16');
        if (existingMsg) parentElement.removeChild(existingMsg);
        
        canvas.style.display = 'none';
        parentElement.appendChild(noDataMsg);
      }
      return;
    }
    
    // Si hay datos, eliminar cualquier mensaje de no datos
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
        indexAxis: 'y', // Gráfico horizontal
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Error en gráfica de máquinas:", error);
  }
}

// Generar CSV de ventas
function generarCSV() {
  try {
    if (!ventas || ventas.length === 0) {
      showError("No hay datos para exportar");
      return;
    }
    
    // Filtrar por máquina si es necesario
    const filtroMaquina = document.getElementById('filtroMaquinaCSV').value;
    let ventasFiltradas = ventas;
    
    if (filtroMaquina) {
      ventasFiltradas = ventas.filter(venta => venta.id_maquina == filtroMaquina);
    }
    
    if (ventasFiltradas.length === 0) {
      showError("No hay datos para exportar con los filtros seleccionados");
      return;
    }
    
    // Cabeceras del CSV
    const cabeceras = ['Fecha', 'Hora', 'Máquina', 'Ubicación', 'Producto', 'Unidades', 'Importe'];
    
    // Preparar filas
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
    
    // Combinar cabeceras y filas
    const csvContent = [
      cabeceras.join(','),
      ...filas.map(fila => fila.map(valor => `"${valor}"`).join(','))
    ].join('\n');
    
    // Crear blob y enlace de descarga
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreArchivo = `ventas_${fechaActual}.csv`;
    
    // Crear y hacer clic en el enlace para descargar
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    
    console.log("CSV generado y descargado");
  } catch (error) {
    console.error("Error al generar CSV:", error);
    showError("Error al generar el archivo CSV: " + error.message);
  }
}

// Inicializar event listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log("Dashboard inicializándose...");
  
  // Establecer fechas por defecto
  const fechaDesde = document.getElementById('fechaDesde');
  const fechaHasta = document.getElementById('fechaHasta');
  
  if (fechaDesde && fechaHasta) {
    // Iniciar con el mes actual por defecto
    fechaDesde.value = inicioMes.toISOString().split('T')[0];
    fechaHasta.value = hoy.toISOString().split('T')[0];
    
    // Event listeners para actualizar cuando cambien las fechas
    fechaDesde.addEventListener('change', actualizarDashboard);
    fechaHasta.addEventListener('change', actualizarDashboard);
  }
  
  // Event listener para descargar CSV
  const btnDescargarCSV = document.getElementById('btnDescargarCSV');
  if (btnDescargarCSV) {
    btnDescargarCSV.addEventListener('click', generarCSV);
  }
  
  // Cargar datos iniciales
  actualizarDashboard();
});

// Exportar para testing
if (typeof module !== 'undefined') {
  module.exports = {
    inicializarSupabase,
    verificarSesion,
    obtenerMaquinas,
    obtenerVentas
  };
}
