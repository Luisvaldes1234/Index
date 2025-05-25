// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let reporteActual = null;
let datosReporte = null;

document.addEventListener("DOMContentLoaded", inicializar);

async function inicializar() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    window.location.href = "/login.html";
    return;
  }
  user = currentUser;
  
  // Configurar fechas por defecto (último mes)
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setMonth(haceUnMes.getMonth() - 1);
  
  document.getElementById("fechaDesde").value = haceUnMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = hoy.toISOString().split("T")[0];
  
  await cargarMaquinas();
  configurarEventListeners();
}

async function cargarMaquinas() {
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("serial, nombre")
    .eq("user_id", user.id);
    
  const select = document.getElementById("filtroMaquina");
  select.innerHTML = '<option value="">Todas las máquinas</option>';
  
  maquinas.forEach(m => {
    const option = document.createElement("option");
    option.value = m.serial;
    option.textContent = m.nombre || m.serial;
    select.appendChild(option);
  });
}

function configurarEventListeners() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      
      e.target.classList.add('tab-active');
      const tabId = e.target.dataset.tab;
      document.getElementById(tabId).classList.remove('hidden');
    });
  });
  
  // Botón aplicar filtros
  document.getElementById("btnAplicarFiltros").addEventListener("click", () => {
    if (reporteActual) {
      mostrarReporte(reporteActual);
    }
  });
  
  // Logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
  });
}

function mostrarLoading(show = true) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

function volverALista() {
  document.getElementById("reportesContainer").classList.remove("hidden");
  document.getElementById("reporteDetallado").classList.add("hidden");
  reporteActual = null;
}

async function mostrarReporte(tipo) {
  reporteActual = tipo;
  mostrarLoading(true);
  
  // Ocultar lista, mostrar detalle
  document.getElementById("reportesContainer").classList.add("hidden");
  document.getElementById("reporteDetallado").classList.remove("hidden");
  
  const contenedor = document.getElementById("contenidoReporte");
  
  try {
    switch(tipo) {
      case 'ventasDetallado':
        await reporteVentasDetallado(contenedor);
        break;
      case 'rendimientoMaquina':
        await reporteRendimientoMaquina(contenedor);
        break;
      case 'analisisHorarios':
        await reporteAnalisisHorarios(contenedor);
        break;
      case 'corteCaja':
        await reporteCorteCaja(contenedor);
        break;
      case 'ticketPromedio':
        await reporteTicketPromedio(contenedor);
        break;
      case 'proyecciones':
        await reporteProyecciones(contenedor);
        break;
      case 'conectividad':
        await reporteConectividad(contenedor);
        break;
      case 'mantenimientoPredictivo':
        await reporteMantenimientoPredictivo(contenedor);
        break;
      case 'demandaVolumen':
        await reporteDemandaVolumen(contenedor);
        break;
      case 'eficienciaOperativa':
        await reporteEficienciaOperativa(contenedor);
        break;
      case 'dashboardEjecutivo':
        await reporteDashboardEjecutivo(contenedor);
        break;
    }
  } catch (error) {
    console.error("Error generando reporte:", error);
    contenedor.innerHTML = `<p class="text-red-600">Error al generar el reporte: ${error.message}</p>`;
  } finally {
    mostrarLoading(false);
  }
}

// === FUNCIONES DE REPORTES ===

async function reporteVentasDetallado(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  
  // Agrupar por día
  const ventasPorDia = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString('es-MX');
    if (!ventasPorDia[fecha]) {
      ventasPorDia[fecha] = { total: 0, litros: 0, ventas: 0 };
    }
    ventasPorDia[fecha].total += parseFloat(v.precio_total || 0);
    ventasPorDia[fecha].litros += parseFloat(v.litros || 0);
    ventasPorDia[fecha].ventas += 1;
  });
  
  const labels = Object.keys(ventasPorDia).sort();
  const totales = labels.map(l => ventasPorDia[l].total);
  const litros = labels.map(l => ventasPorDia[l].litros);
  
  // Calcular totales
  const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0);
  const totalLitros = ventas.reduce((sum, v) => sum + parseFloat(v.litros || 0), 0);
  const promedioVentaDiaria = totalVentas / labels.length;
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Reporte de Ventas Detallado</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Total Vendido</p>
        <p class="text-2xl font-bold">$${totalVentas.toFixed(2)}</p>
      </div>
      <div class="bg-green-50 dark:bg-green-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Litros Vendidos</p>
        <p class="text-2xl font-bold">${totalLitros.toFixed(1)} L</p>
      </div>
      <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Ventas Totales</p>
        <p class="text-2xl font-bold">${ventas.length}</p>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Promedio Diario</p>
        <p class="text-2xl font-bold">$${promedioVentaDiaria.toFixed(2)}</p>
      </div>
    </div>
    
    <!-- Gráfica de tendencia -->
    <div class="mb-8">
      <h3 class="text-lg font-bold mb-4">Tendencia de Ventas</h3>
      <canvas id="graficaTendencia"></canvas>
    </div>
    
    <!-- Tabla detallada -->
    <div class="overflow-x-auto">
      <h3 class="text-lg font-bold mb-4">Detalle por Día</h3>
      <table class="w-full table-auto">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="px-4 py-2 text-left">Fecha</th>
            <th class="px-4 py-2 text-right">Ventas</th>
            <th class="px-4 py-2 text-right">Litros</th>
            <th class="px-4 py-2 text-right">Total</th>
            <th class="px-4 py-2 text-right">Ticket Promedio</th>
          </tr>
        </thead>
        <tbody>
          ${labels.map(fecha => `
            <tr class="border-b dark:border-gray-700">
              <td class="px-4 py-2">${fecha}</td>
              <td class="px-4 py-2 text-right">${ventasPorDia[fecha].ventas}</td>
              <td class="px-4 py-2 text-right">${ventasPorDia[fecha].litros.toFixed(1)} L</td>
              <td class="px-4 py-2 text-right">$${ventasPorDia[fecha].total.toFixed(2)}</td>
              <td class="px-4 py-2 text-right">$${(ventasPorDia[fecha].total / ventasPorDia[fecha].ventas).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Crear gráfica
  const ctx = document.getElementById('graficaTendencia');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ventas ($)',
        data: totales,
        borderColor: '#3b82f6',
        backgroundColor: '#dbeafe',
        yAxisID: 'y'
      }, {
        label: 'Litros',
        data: litros,
        borderColor: '#10b981',
        backgroundColor: '#d1fae5',
        yAxisID: 'y1'
      }]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false,
          },
        },
      }
    }
  });
  
  datosReporte = { ventasPorDia, totales: { totalVentas, totalLitros, promedioVentaDiaria } };
}

async function reporteRendimientoMaquina(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  
  // Agrupar por máquina
  const ventasPorMaquina = {};
  maquinas.forEach(m => {
    ventasPorMaquina[m.serial] = {
      nombre: m.nombre || m.serial,
      total: 0,
      litros: 0,
      ventas: 0,
      ultimaVenta: null
    };
  });
  
  ventas.forEach(v => {
    if (ventasPorMaquina[v.serial]) {
      ventasPorMaquina[v.serial].total += parseFloat(v.precio_total || 0);
      ventasPorMaquina[v.serial].litros += parseFloat(v.litros || 0);
      ventasPorMaquina[v.serial].ventas += 1;
      ventasPorMaquina[v.serial].ultimaVenta = v.created_at;
    }
  });
  
  // Ordenar por total vendido
  const maquinasOrdenadas = Object.entries(ventasPorMaquina)
    .sort((a, b) => b[1].total - a[1].total);
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Rendimiento por Máquina</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- Gráfica de barras -->
    <div class="mb-8">
      <canvas id="graficaRendimiento"></canvas>
    </div>
    
    <!-- Ranking de máquinas -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${maquinasOrdenadas.map(([$serial, data], index) => {
        const diasDesdeUltima = data.ultimaVenta ? 
          Math.floor((new Date() - new Date(data.ultimaVenta)) / (1000 * 60 * 60 * 24)) : 999;
        const alertaColor = diasDesdeUltima > 7 ? 'text-red-600' : 'text-green-600';
        
        return `
          <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 ${index === 0 ? 'border-yellow-500' : index === 1 ? 'border-gray-400' : index === 2 ? 'border-orange-600' : 'border-blue-500'}">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold">${index + 1}. ${data.nombre}</h3>
              ${index < 3 ? `<span class="text-2xl">${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>` : ''}
            </div>
            <div class="space-y-1 text-sm">
              <p><span class="text-gray-600 dark:text-gray-400">Total:</span> <span class="font-bold">$${data.total.toFixed(2)}</span></p>
              <p><span class="text-gray-600 dark:text-gray-400">Ventas:</span> ${data.ventas}</p>
              <p><span class="text-gray-600 dark:text-gray-400">Litros:</span> ${data.litros.toFixed(1)} L</p>
              <p><span class="text-gray-600 dark:text-gray-400">Ticket promedio:</span> ${data.ventas > 0 ? (data.total / data.ventas).toFixed(2) : '0.00'}</p>
              <p class="${alertaColor}"><span class="text-gray-600 dark:text-gray-400">Última venta:</span> hace ${diasDesdeUltima} días</p>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Crear gráfica
  const ctx = document.getElementById('graficaRendimiento');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: maquinasOrdenadas.slice(0, 10).map(([_, data]) => data.nombre),
      datasets: [{
        label: 'Ventas Totales ($)',
        data: maquinasOrdenadas.slice(0, 10).map(([_, data]) => data.total),
        backgroundColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  datosReporte = { ventasPorMaquina, maquinasOrdenadas };
}

async function reporteAnalisisHorarios(contenedor) {
  const { ventas } = await obtenerDatosBase();
  
  // Análisis por hora
  const ventasPorHora = Array(24).fill(null).map(() => ({ total: 0, ventas: 0 }));
  const ventasPorDiaSemana = Array(7).fill(null).map(() => ({ total: 0, ventas: 0 }));
  
  ventas.forEach(v => {
    const fecha = new Date(v.created_at);
    const hora = fecha.getHours();
    const diaSemana = fecha.getDay();
    
    ventasPorHora[hora].total += parseFloat(v.precio_total || 0);
    ventasPorHora[hora].ventas += 1;
    
    ventasPorDiaSemana[diaSemana].total += parseFloat(v.precio_total || 0);
    ventasPorDiaSemana[diaSemana].ventas += 1;
  });
  
  // Encontrar horas pico
  const horasPico = ventasPorHora
    .map((data, hora) => ({ hora, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Análisis de Horarios</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- Horas pico -->
    <div class="mb-8">
      <h3 class="text-lg font-bold mb-4">🔥 Horas Pico de Ventas</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${horasPico.map((h, index) => `
          <div class="bg-gradient-to-r ${index === 0 ? 'from-yellow-400 to-yellow-600' : 'from-blue-400 to-blue-600'} text-white p-4 rounded-lg">
            <p class="text-3xl font-bold">${h.hora}:00</p>
            <p class="text-sm">${h.total.toFixed(2)} en ${h.ventas} ventas</p>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Gráficas -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div>
        <h3 class="text-lg font-bold mb-4">Ventas por Hora del Día</h3>
        <canvas id="graficaHoras"></canvas>
      </div>
      <div>
        <h3 class="text-lg font-bold mb-4">Ventas por Día de la Semana</h3>
        <canvas id="graficaDias"></canvas>
      </div>
    </div>
    
    <!-- Recomendaciones -->
    <div class="bg-blue-50 dark:bg-blue-900 p-6 rounded-lg">
      <h3 class="text-lg font-bold mb-3">💡 Recomendaciones</h3>
      <ul class="space-y-2">
        <li>• Las horas pico son entre ${horasPico[0].hora}:00 y ${horasPico[0].hora + 1}:00</li>
        <li>• Considera promociones en horas de baja demanda</li>
        <li>• ${diasSemana[ventasPorDiaSemana.indexOf(Math.max(...ventasPorDiaSemana))]} es el día con más ventas</li>
      </ul>
    </div>
  `;
  
  // Gráfica por horas
  const ctxHoras = document.getElementById('graficaHoras');
  new Chart(ctxHoras, {
    type: 'line',
    data: {
      labels: Array(24).fill(null).map((_, i) => `${i}:00`),
      datasets: [{
        label: 'Ventas ($)',
        data: ventasPorHora.map(h => h.total),
        borderColor: '#3b82f6',
        backgroundColor: '#dbeafe',
        tension: 0.4
      }]
    }
  });
  
  // Gráfica por días
  const ctxDias = document.getElementById('graficaDias');
  new Chart(ctxDias, {
    type: 'bar',
    data: {
      labels: diasSemana,
      datasets: [{
        label: 'Ventas ($)',
        data: ventasPorDiaSemana.map(d => d.total),
        backgroundColor: '#10b981'
      }]
    }
  });
  
  datosReporte = { ventasPorHora, ventasPorDiaSemana, horasPico };
}

async function reporteCorteCaja(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  
  // Calcular montos acumulados desde último corte
  const cortesInfo = await Promise.all(maquinas.map(async m => {
    const ventasDesdeCorte = ventas.filter(v => 
      v.serial === m.serial && 
      new Date(v.created_at) >= new Date(m.ultimo_corte || '2000-01-01')
    );
    
    const total = ventasDesdeCorte.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0);
    const diasDesdeCorte = m.ultimo_corte ? 
      Math.floor((new Date() - new Date(m.ultimo_corte)) / (1000 * 60 * 60 * 24)) : 999;
    
    return {
      nombre: m.nombre || m.serial,
      serial: m.serial,
      total,
      ventas: ventasDesdeCorte.length,
      ultimoCorte: m.ultimo_corte,
      diasDesdeCorte,
      alerta: total >= 2000 ? 'danger' : total >= 1000 ? 'warning' : 'ok'
    };
  }));
  
  // Ordenar por monto acumulado
  cortesInfo.sort((a, b) => b.total - a.total);
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Estado de Cortes de Caja</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- Resumen -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-red-50 dark:bg-red-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Requieren Corte Urgente</p>
        <p class="text-3xl font-bold text-red-600">${cortesInfo.filter(c => c.alerta === 'danger').length}</p>
      </div>
      <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Próximas a Corte</p>
        <p class="text-3xl font-bold text-yellow-600">${cortesInfo.filter(c => c.alerta === 'warning').length}</p>
      </div>
      <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Total Acumulado</p>
        <p class="text-3xl font-bold">${cortesInfo.reduce((sum, c) => sum + c.total, 0).toFixed(2)}</p>
      </div>
    </div>
    
    <!-- Lista de máquinas -->
    <div class="space-y-4">
      ${cortesInfo.map(c => {
        const bgColor = c.alerta === 'danger' ? 'bg-red-100 dark:bg-red-900' : 
                       c.alerta === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' : 
                       'bg-green-100 dark:bg-green-900';
        const iconColor = c.alerta === 'danger' ? 'text-red-600' : 
                         c.alerta === 'warning' ? 'text-yellow-600' : 
                         'text-green-600';
        
        return `
          <div class="${bgColor} p-4 rounded-lg flex justify-between items-center">
            <div>
              <h3 class="font-bold text-lg">${c.nombre}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-300">
                Último corte: ${c.ultimoCorte ? new Date(c.ultimoCorte).toLocaleDateString('es-MX') : 'Nunca'} 
                (hace ${c.diasDesdeCorte} días)
              </p>
              <p class="text-sm">${c.ventas} ventas desde último corte</p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-bold ${iconColor}">${c.total.toFixed(2)}</p>
              ${c.alerta === 'danger' ? '<p class="text-sm text-red-600 font-bold">⚠️ CORTE URGENTE</p>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  datosReporte = { cortesInfo };
}

async function reporteTicketPromedio(contenedor) {
  const { ventas } = await obtenerDatosBase();
  
  // Calcular ticket promedio por día
  const ticketPorDia = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString('es-MX');
    if (!ticketPorDia[fecha]) {
      ticketPorDia[fecha] = { total: 0, ventas: 0 };
    }
    ticketPorDia[fecha].total += parseFloat(v.precio_total || 0);
    ticketPorDia[fecha].ventas += 1;
  });
  
  const fechas = Object.keys(ticketPorDia).sort();
  const tickets = fechas.map(f => ticketPorDia[f].total / ticketPorDia[f].ventas);
  
  // Estadísticas
  const ticketPromedioGlobal = ventas.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0) / ventas.length;
  const ticketMax = Math.max(...tickets);
  const ticketMin = Math.min(...tickets);
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Análisis de Ticket Promedio</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Ticket Promedio</p>
        <p class="text-3xl font-bold">${ticketPromedioGlobal.toFixed(2)}</p>
      </div>
      <div class="bg-green-50 dark:bg-green-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Ticket Máximo</p>
        <p class="text-3xl font-bold">${ticketMax.toFixed(2)}</p>
      </div>
      <div class="bg-red-50 dark:bg-red-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Ticket Mínimo</p>
        <p class="text-3xl font-bold">${ticketMin.toFixed(2)}</p>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Variación</p>
        <p class="text-3xl font-bold">${((ticketMax - ticketMin) / ticketMin * 100).toFixed(1)}%</p>
      </div>
    </div>
    
    <!-- Gráfica de evolución -->
    <div class="mb-8">
      <h3 class="text-lg font-bold mb-4">Evolución del Ticket Promedio</h3>
      <canvas id="graficaTicket"></canvas>
    </div>
  `;
  
  // Crear gráfica
  const ctx = document.getElementById('graficaTicket');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: fechas,
      datasets: [{
        label: 'Ticket Promedio ($)',
        data: tickets,
        borderColor: '#3b82f6',
        backgroundColor: '#dbeafe',
        tension: 0.4
      }, {
        label: 'Promedio Global',
        data: Array(fechas.length).fill(ticketPromedioGlobal),
        borderColor: '#ef4444',
        borderDash: [5, 5],
        pointRadius: 0
      }]
    }
  });
  
  datosReporte = { ticketPorDia, estadisticas: { ticketPromedioGlobal, ticketMax, ticketMin } };
}

async function reporteProyecciones(contenedor) {
  const { ventas } = await obtenerDatosBase();
  
  // Agrupar por mes
  const ventasPorMes = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!ventasPorMes[mes]) {
      ventasPorMes[mes] = 0;
    }
    ventasPorMes[mes] += parseFloat(v.precio_total || 0);
  });
  
  const meses = Object.keys(ventasPorMes).sort();
  const valores = meses.map(m => ventasPorMes[m]);
  
  // Calcular tendencia y proyección simple
  const promedioCrecimiento = valores.length > 1 ? 
    (valores[valores.length - 1] - valores[0]) / valores.length : 0;
  
  const proyeccion = [];
  for (let i = 1; i <= 3; i++) {
    proyeccion.push(valores[valores.length - 1] + (promedioCrecimiento * i));
  }
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Ingresos y Proyecciones</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- Resumen -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Ingreso Mensual Promedio</p>
        <p class="text-3xl font-bold">${(valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2)}</p>
      </div>
      <div class="bg-green-50 dark:bg-green-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Último Mes</p>
        <p class="text-3xl font-bold">${valores[valores.length - 1].toFixed(2)}</p>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Proyección Próximo Mes</p>
        <p class="text-3xl font-bold">${proyeccion[0].toFixed(2)}</p>
      </div>
    </div>
    
    <!-- Gráfica -->
    <div class="mb-8">
      <canvas id="graficaProyeccion"></canvas>
    </div>
  `;
  
  // Crear gráfica con proyección
  const ctx = document.getElementById('graficaProyeccion');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...meses, 'Proyección +1', 'Proyección +2', 'Proyección +3'],
      datasets: [{
        label: 'Ingresos Históricos',
        data: [...valores, null, null, null],
        borderColor: '#3b82f6',
        backgroundColor: '#dbeafe',
      }, {
        label: 'Proyección',
        data: [...Array(valores.length - 1).fill(null), valores[valores.length - 1], ...proyeccion],
        borderColor: '#10b981',
        backgroundColor: '#d1fae5',
        borderDash: [5, 5]
      }]
    }
  });
  
  datosReporte = { ventasPorMes, proyeccion };
}

async function reporteConectividad(contenedor) {
  const { maquinas } = await obtenerDatosBase();
  
  // Analizar conectividad
  const ahora = new Date();
  const estadoConexion = maquinas.map(m => {
    const ultimaConexion = new Date(m.last_seen);
    const minutosDesconectado = (ahora - ultimaConexion) / 60000;
    
    return {
      nombre: m.nombre || m.serial,
      serial: m.serial,
      ultimaConexion,
      minutosDesconectado,
      estado: minutosDesconectado < 10 ? 'online' : 
              minutosDesconectado < 60 ? 'warning' : 'offline',
      diasDesconectado: Math.floor(minutosDesconectado / 1440)
    };
  });
  
  const online = estadoConexion.filter(e => e.estado === 'online').length;
  const warning = estadoConexion.filter(e => e.estado === 'warning').length;
  const offline = estadoConexion.filter(e => e.estado === 'offline').length;
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Estado de Conectividad</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- Resumen -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-green-50 dark:bg-green-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">En Línea</p>
        <p class="text-3xl font-bold text-green-600">${online}</p>
      </div>
      <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Advertencia</p>
        <p class="text-3xl font-bold text-yellow-600">${warning}</p>
      </div>
      <div class="bg-red-50 dark:bg-red-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Sin Conexión</p>
        <p class="text-3xl font-bold text-red-600">${offline}</p>
      </div>
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded text-center">
        <p class="text-sm text-gray-600 dark:text-gray-300">Disponibilidad</p>
        <p class="text-3xl font-bold">${((online / maquinas.length) * 100).toFixed(1)}%</p>
      </div>
    </div>
    
    <!-- Lista de máquinas -->
    <div class="space-y-2">
      ${estadoConexion
        .sort((a, b) => b.minutosDesconectado - a.minutosDesconectado)
        .map(e => {
          const statusColor = e.estado === 'online' ? 'bg-green-500' : 
                            e.estado === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
          const statusText = e.estado === 'online' ? 'En línea' : 
                           e.estado === 'warning' ? 'Advertencia' : 'Sin conexión';
          
          return `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg flex justify-between items-center">
              <div class="flex items-center gap-3">
                <div class="${statusColor} w-3 h-3 rounded-full"></div>
                <div>
                  <h3 class="font-bold">${e.nombre}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
              ${m.litrosFaltantes.toFixed(0)} litros para próximo mantenimiento (${m.porcentajeUso.toFixed(1)}% completado)
            </p>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  datosReporte = { mantenimientoInfo, configuracion: { LITROS_MANTENIMIENTO } };
}

async function reporteDemandaVolumen(contenedor) {
  const { ventas } = await obtenerDatosBase();
  
  // Contar ventas por volumen
  const volumenes = {
    "20L": 0,
    "10L": 0,
    "5L": 0,
    "Galón": 0,
    "Otros": 0
  };
  
  const ventasPorVolumen = {
    "20L": 0,
    "10L": 0,
    "5L": 0,
    "Galón": 0,
    "Otros": 0
  };
  
  ventas.forEach(v => {
    const litros = parseFloat(v.litros);
    const precio = parseFloat(v.precio_total || 0);
    
    if (litros === 20) {
      volumenes["20L"]++;
      ventasPorVolumen["20L"] += precio;
    } else if (litros === 10) {
      volumenes["10L"]++;
      ventasPorVolumen["10L"] += precio;
    } else if (litros === 5) {
      volumenes["5L"]++;
      ventasPorVolumen["5L"] += precio;
    } else if (litros === 3.785) {
      volumenes["Galón"]++;
      ventasPorVolumen["Galón"] += precio;
    } else {
      volumenes["Otros"]++;
      ventasPorVolumen["Otros"] += precio;
    }
  });
  
  const totalVentas = Object.values(volumenes).reduce((a, b) => a + b, 0);
  const volumenMasVendido = Object.entries(volumenes).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Análisis de Demanda por Volumen</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Volumen Más Popular</p>
        <p class="text-3xl font-bold">${volumenMasVendido}</p>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Total de Ventas</p>
        <p class="text-3xl font-bold">${totalVentas}</p>
      </div>
      <div class="bg-green-50 dark:bg-green-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Diversidad</p>
        <p class="text-3xl font-bold">${Object.values(volumenes).filter(v => v > 0).length} tipos</p>
      </div>
    </div>
    
    <!-- Gráficas -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div>
        <h3 class="text-lg font-bold mb-4">Distribución por Cantidad</h3>
        <canvas id="graficaVolumenCantidad"></canvas>
      </div>
      <div>
        <h3 class="text-lg font-bold mb-4">Distribución por Ingresos</h3>
        <canvas id="graficaVolumenIngresos"></canvas>
      </div>
    </div>
    
    <!-- Tabla detallada -->
    <div class="overflow-x-auto">
      <table class="w-full table-auto">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="px-4 py-2 text-left">Volumen</th>
            <th class="px-4 py-2 text-right">Cantidad</th>
            <th class="px-4 py-2 text-right">% del Total</th>
            <th class="px-4 py-2 text-right">Ingresos</th>
            <th class="px-4 py-2 text-right">Precio Promedio</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(volumenes).map(([vol, cant]) => `
            <tr class="border-b dark:border-gray-700 ${vol === volumenMasVendido ? 'bg-blue-50 dark:bg-blue-900' : ''}">
              <td class="px-4 py-2 font-bold">${vol}</td>
              <td class="px-4 py-2 text-right">${cant}</td>
              <td class="px-4 py-2 text-right">${totalVentas > 0 ? ((cant / totalVentas) * 100).toFixed(1) : 0}%</td>
              <td class="px-4 py-2 text-right">${ventasPorVolumen[vol].toFixed(2)}</td>
              <td class="px-4 py-2 text-right">${cant > 0 ? (ventasPorVolumen[vol] / cant).toFixed(2) : '0.00'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Gráfica de cantidad
  const ctxCantidad = document.getElementById('graficaVolumenCantidad');
  new Chart(ctxCantidad, {
    type: 'doughnut',
    data: {
      labels: Object.keys(volumenes),
      datasets: [{
        data: Object.values(volumenes),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280']
      }]
    }
  });
  
  // Gráfica de ingresos
  const ctxIngresos = document.getElementById('graficaVolumenIngresos');
  new Chart(ctxIngresos, {
    type: 'doughnut',
    data: {
      labels: Object.keys(ventasPorVolumen),
      datasets: [{
        data: Object.values(ventasPorVolumen),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280']
      }]
    }
  });
  
  datosReporte = { volumenes, ventasPorVolumen, estadisticas: { totalVentas, volumenMasVendido } };
}

async function reporteEficienciaOperativa(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  
  // Calcular métricas de eficiencia por máquina
  const eficienciaInfo = maquinas.map(m => {
    const ventasMaquina = ventas.filter(v => v.serial === m.serial);
    const diasAnalisis = 30;
    const horasPorDia = 24;
    const horasTotales = diasAnalisis * horasPorDia;
    
    // Calcular tiempo entre ventas
    const tiemposEntreVentas = [];
    for (let i = 1; i < ventasMaquina.length; i++) {
      const tiempo = (new Date(ventasMaquina[i].created_at) - new Date(ventasMaquina[i-1].created_at)) / 3600000; // en horas
      tiemposEntreVentas.push(tiempo);
    }
    
    const tiempoPromedioEntreVentas = tiemposEntreVentas.length > 0 ? 
      tiemposEntreVentas.reduce((a, b) => a + b, 0) / tiemposEntreVentas.length : 0;
    
    const ventasPorDia = ventasMaquina.length / diasAnalisis;
    const ingresosPorDia = ventasMaquina.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0) / diasAnalisis;
    const utilizacion = (ventasMaquina.length / (horasTotales / 8)) * 100; // Asumiendo operación 8 horas/día
    
    return {
      nombre: m.nombre || m.serial,
      serial: m.serial,
      ventasPorDia,
      ingresosPorDia,
      tiempoPromedioEntreVentas,
      utilizacion: Math.min(utilizacion, 100),
      totalVentas: ventasMaquina.length,
      eficiencia: ingresosPorDia > 100 ? 'alta' : ingresosPorDia > 50 ? 'media' : 'baja'
    };
  });
  
  eficienciaInfo.sort((a, b) => b.ingresosPorDia - a.ingresosPorDia);
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Eficiencia Operativa</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- Resumen general -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-green-50 dark:bg-green-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Alta Eficiencia</p>
        <p class="text-3xl font-bold text-green-600">${eficienciaInfo.filter(e => e.eficiencia === 'alta').length}</p>
      </div>
      <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Eficiencia Media</p>
        <p class="text-3xl font-bold text-yellow-600">${eficienciaInfo.filter(e => e.eficiencia === 'media').length}</p>
      </div>
      <div class="bg-red-50 dark:bg-red-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Baja Eficiencia</p>
        <p class="text-3xl font-bold text-red-600">${eficienciaInfo.filter(e => e.eficiencia === 'baja').length}</p>
      </div>
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded">
        <p class="text-sm text-gray-600 dark:text-gray-300">Utilización Promedio</p>
        <p class="text-3xl font-bold">${(eficienciaInfo.reduce((sum, e) => sum + e.utilizacion, 0) / eficienciaInfo.length).toFixed(1)}%</p>
      </div>
    </div>
    
    <!-- Tabla de eficiencia -->
    <div class="overflow-x-auto">
      <table class="w-full table-auto">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="px-4 py-2 text-left">Máquina</th>
            <th class="px-4 py-2 text-right">Ventas/Día</th>
            <th class="px-4 py-2 text-right">$/Día</th>
            <th class="px-4 py-2 text-right">Tiempo entre ventas</th>
            <th class="px-4 py-2 text-right">Utilización</th>
            <th class="px-4 py-2 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${eficienciaInfo.map(e => {
            const estadoColor = e.eficiencia === 'alta' ? 'bg-green-100 text-green-800' : 
                              e.eficiencia === 'media' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800';
            
            return `
              <tr class="border-b dark:border-gray-700">
                <td class="px-4 py-2 font-bold">${e.nombre}</td>
                <td class="px-4 py-2 text-right">${e.ventasPorDia.toFixed(1)}</td>
                <td class="px-4 py-2 text-right">${e.ingresosPorDia.toFixed(2)}</td>
                <td class="px-4 py-2 text-right">${e.tiempoPromedioEntreVentas.toFixed(1)} hrs</td>
                <td class="px-4 py-2 text-right">${e.utilizacion.toFixed(1)}%</td>
                <td class="px-4 py-2 text-center">
                  <span class="px-2 py-1 rounded text-xs ${estadoColor}">
                    ${e.eficiencia.toUpperCase()}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  datosReporte = { eficienciaInfo };
}

async function reporteDashboardEjecutivo(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  
  // Calcular KPIs principales
  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hace30Dias.getDate() - 30);
  const hace60Dias = new Date(hoy);
  hace60Dias.setDate(hace60Dias.getDate() - 60);
  
  const ventasUltimos30 = ventas.filter(v => new Date(v.created_at) >= hace30Dias);
  const ventas30a60 = ventas.filter(v => new Date(v.created_at) >= hace60Dias && new Date(v.created_at) < hace30Dias);
  
  const ingresos30 = ventasUltimos30.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0);
  const ingresos30a60 = ventas30a60.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0);
  const crecimiento = ingresos30a60 > 0 ? ((ingresos30 - ingresos30a60) / ingresos30a60 * 100) : 0;
  
  const maquinasActivas = maquinas.filter(m => 
    (new Date() - new Date(m.last_seen)) / 60000 < 1440
  ).length;
  
  const ticketPromedio = ventasUltimos30.length > 0 ? 
    ingresos30 / ventasUltimos30.length : 0;
  
  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Dashboard Ejecutivo</h2>
      <button onclick="mostrarModalExportar()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Exportar
      </button>
    </div>
    
    <!-- KPIs Principales -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
        <p class="text-sm opacity-80">Ingresos (30 días)</p>
        <p class="text-3xl font-bold">${ingresos30.toFixed(2)}</p>
        <p class="text-sm mt-2">${crecimiento >= 0 ? '↑' : '↓'} ${Math.abs(crecimiento).toFixed(1)}% vs período anterior</p>
      </div>
      
      <div class="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg">
        <p class="text-sm opacity-80">Ventas Totales</p>
        <p class="text-3xl font-bold">${ventasUltimos30.length}</p>
        <p class="text-sm mt-2">${(ventasUltimos30.length / 30).toFixed(1)} ventas/día</p>
      </div>
      
      <div class="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg">
        <p class="text-sm opacity-80">Ticket Promedio</p>
        <p class="text-3xl font-bold">${ticketPromedio.toFixed(2)}</p>
        <p class="text-sm mt-2">Últimos 30 días</p>
      </div>
      
      <div class="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg">
        <p class="text-sm opacity-80">Máquinas Activas</p>
        <p class="text-3xl font-bold">${maquinasActivas}/${maquinas.length}</p>
        <p class="text-sm mt-2">${((maquinasActivas / maquinas.length) * 100).toFixed(0)}% disponibilidad</p>
      </div>
    </div>
    
    <!-- Gráficas comparativas -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 class="text-lg font-bold mb-4">Tendencia de Ingresos (Últimos 7 días)</h3>
        <canvas id="graficaTendenciaEjecutiva"></canvas>
      </div>
      <div>
        <h3 class="text-lg font-bold mb-4">Top 5 Máquinas por Ingresos</h3>
        <canvas id="graficaTop5"></canvas>
      </div>
    </div>
  `;
  
  // Preparar datos para gráficas
  const ultimos7Dias = [];
  const ingresosPor7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fecha);
    fechaFin.setHours(23, 59, 59, 999);
    
    const ventasDia = ventasUltimos30.filter(v => 
      new Date(v.created_at) >= fecha && new Date(v.created_at) <= fechaFin
    );
    
    ultimos7Dias.push(fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }));
    ingresosPor7Dias.push(ventasDia.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0));
  }
  
  // Gráfica de tendencia
  const ctxTendencia = document.getElementById('graficaTendenciaEjecutiva');
  new Chart(ctxTendencia, {
    type: 'line',
    data: {
      labels: ultimos7Dias,
      datasets: [{
        label: 'Ingresos',
        data: ingresosPor7Dias,
        borderColor: '#3b82f6',
        backgroundColor: '#dbeafe',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  // Top 5 máquinas
  const ingresosPorMaquina = {};
  ventasUltimos30.forEach(v => {
    if (!ingresosPorMaquina[v.serial]) {
      ingresosPorMaquina[v.serial] = 0;
    }
    ingresosPorMaquina[v.serial] += parseFloat(v.precio_total || 0);
  });
  
  const top5 = Object.entries(ingresosPorMaquina)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const ctxTop5 = document.getElementById('graficaTop5');
  new Chart(ctxTop5, {
    type: 'bar',
    data: {
      labels: top5.map(([serial, _]) => {
        const maquina = maquinas.find(m => m.serial === serial);
        return maquina?.nombre || serial;
      }),
      datasets: [{
        label: 'Ingresos',
        data: top5.map(([_, ingresos]) => ingresos),
        backgroundColor: '#10b981'
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  datosReporte = { 
    kpis: { ingresos30, crecimiento, ventasTotal: ventasUltimos30.length, ticketPromedio, maquinasActivas },
    tendencia: { ultimos7Dias, ingresosPor7Dias },
    top5 
  };
}

// === FUNCIONES AUXILIARES ===

async function obtenerDatosBase() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const serial = document.getElementById("filtroMaquina").value;
  
  // Obtener ventas con filtros
  let queryVentas = supabase
    .from("ventas")
    .select("*")
    .gte("created_at", new Date(desde).toISOString())
    .lte("created_at", new Date(hasta + "T23:59:59").toISOString());
    
  if (serial) {
    queryVentas = queryVentas.eq("serial", serial);
  }
  
  const { data: ventas } = await queryVentas;
  
  // Obtener máquinas
  let queryMaquinas = supabase
    .from("maquinas")
    .select("*")
    .eq("user_id", user.id);
    
  if (serial) {
    queryMaquinas = queryMaquinas.eq("serial", serial);
  }
  
  const { data: maquinas } = await queryMaquinas;
  
  return { ventas: ventas || [], maquinas: maquinas || [] };
}

// === FUNCIONES DE EXPORTACIÓN ===

function mostrarModalExportar() {
  document.getElementById("modalExportar").classList.remove("hidden");
  document.getElementById("modalExportar").classList.add("flex");
}

function cerrarModalExportar() {
  document.getElementById("modalExportar").classList.add("hidden");
  document.getElementById("modalExportar").classList.remove("flex");
}

async function exportarReporte(formato) {
  cerrarModalExportar();
  
  if (!datosReporte) {
    alert("No hay datos para exportar");
    return;
  }
  
  switch(formato) {
    case 'csv':
      exportarCSV();
      break;
    case 'excel':
      alert("Exportación a Excel próximamente disponible");
      break;
    case 'pdf':
      alert("Exportación a PDF próximamente disponible");
      break;
  }
}

function exportarCSV() {
  let csv = "";
  const nombreReporte = reporteActual.replace(/([A-Z])/g, ' $1').trim();
  
  // Generar CSV según el tipo de reporte
  switch(reporteActual) {
    case 'ventasDetallado':
      csv = "Fecha,Ventas,Litros,Total,Ticket Promedio\n";
      Object.entries(datosReporte.ventasPorDia).forEach(([fecha, data]) => {
        csv += `${fecha},${data.ventas},${data.litros.toFixed(1)},${data.total.toFixed(2)},${(data.total/data.ventas).toFixed(2)}\n`;
      });
      break;
      
    case 'rendimientoMaquina':
      csv = "Máquina,Total Vendido,Ventas,Litros,Ticket Promedio\n";
      datosReporte.maquinasOrdenadas.forEach(([serial, data]) => {
        csv += `${data.nombre},${data.total.toFixed(2)},${data.ventas},${data.litros.toFixed(1)},${data.ventas > 0 ? (data.total/data.ventas).toFixed(2) : '0.00'}\n`;
      });
      break;
      
    // Agregar más casos según sea necesario
    
    default:
      csv = "Datos del reporte " + nombreReporte + "\n";
      csv += JSON.stringify(datosReporte, null, 2);
  }
}

