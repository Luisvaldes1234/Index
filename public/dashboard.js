// dashboard.js (fixed to properly handle Supabase authentication and data fetching)

// Initialize Supabase client with proper error handling
let supabase;
try {
  // Get the key from environment or directly (safer approach in production would be environment variables)
  const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
  const supabaseKey = window.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseKey) {
    console.error("Missing Supabase API key");
    alert("Error de configuración: Falta la clave API de Supabase");
  } else {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
  }
} catch (error) {
  console.error("Error initializing Supabase:", error);
  alert("Error al inicializar la conexión con la base de datos");
}

let ventas = [];
let maquinasActivas = [];

// Verify session before continuing
async function verificarSesion() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error verificando sesión:", error);
      alert("Error de autenticación: " + error.message);
      window.location.href = "/login.html";
      return null;
    }
    
    if (!session) {
      console.log("No hay sesión activa");
      window.location.href = "/login.html";
      return null;
    }
    
    return session.user;
  } catch (error) {
    console.error("Error inesperado al verificar sesión:", error);
    alert("Error inesperado al verificar la sesión");
    window.location.href = "/login.html";
    return null;
  }
}

// Main initialization function
async function inicializarDashboard() {
  try {
    const user = await verificarSesion();
    if (!user) return;

    // Set default dates to current month
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    
    const fechaDesdeEl = document.getElementById("fechaDesde");
    const fechaHastaEl = document.getElementById("fechaHasta");
    
    if (fechaDesdeEl && fechaHastaEl) {
      fechaDesdeEl.value = inicioMes.toISOString().split("T")[0];
      fechaHastaEl.value = ahora.toISOString().split("T")[0];
      
      // Add event listeners to refresh data when dates change
      fechaDesdeEl.addEventListener("change", cargarVentas);
      fechaHastaEl.addEventListener("change", cargarVentas);
    }

    // Fetch active machines with subscription
    const { data: maquinas, error } = await supabase
      .from("maquinas")
      .select("serial, suscripcion_hasta")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error al cargar máquinas:", error);
      return alert("Error al cargar las máquinas: " + error.message);
    }

    if (!maquinas || maquinas.length === 0) {
      document.getElementById("resumen").innerHTML = `
        <div class="col-span-full p-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 shadow rounded">
          No tienes máquinas activas. Dirígete a la sección "Mis Máquinas" para registrar una nueva.
        </div>
      `;
      return;
    }

    // Filter active machines
    maquinasActivas = maquinas
      .filter(m => m.suscripcion_hasta && new Date(m.suscripcion_hasta) > new Date())
      .map(m => m.serial);

    if (maquinasActivas.length === 0) {
      document.getElementById("resumen").innerHTML = `
        <div class="col-span-full p-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 shadow rounded">
          No tienes máquinas con suscripción activa. Dirígete a la sección "Suscripción" para renovar.
        </div>
      `;
    }

    await cargarVentas();
  } catch (error) {
    console.error("Error en inicialización:", error);
    alert("Error al inicializar el dashboard: " + error.message);
  }
}

async function cargarVentas() {
  try {
    const fechaDesdeEl = document.getElementById("fechaDesde");
    const fechaHastaEl = document.getElementById("fechaHasta");
    
    if (!fechaDesdeEl || !fechaHastaEl) {
      return alert("Error: No se encontraron los elementos de fecha");
    }
    
    const desde = fechaDesdeEl.value;
    const hasta = fechaHastaEl.value;

    if (!desde || !hasta) {
      return alert("Por favor, selecciona un rango de fechas válido");
    }

    // Show loading state
    document.getElementById("resumen").innerHTML = `
      <div class="col-span-full p-4 bg-white dark:bg-gray-800 shadow rounded">
        Cargando datos...
      </div>
    `;

    // Format dates properly for the query
    const fechaDesde = new Date(desde);
    fechaDesde.setHours(0, 0, 0, 0);
    
    const fechaHasta = new Date(hasta);
    fechaHasta.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("ventas")
      .select("*")
      .gte("created_at", fechaDesde.toISOString())
      .lte("created_at", fechaHasta.toISOString());

    if (error) {
      console.error("Error al cargar ventas:", error);
      return alert("Error al cargar ventas: " + error.message);
    }

    // Filter by active machines
    ventas = data.filter(v => maquinasActivas.includes(v.serial));

    actualizarResumen();
    actualizarGraficas();
    actualizarCSVSelector();
  } catch (error) {
    console.error("Error al cargar ventas:", error);
    alert("Error al cargar datos de ventas: " + error.message);
  }
}

function actualizarResumen() {
  const resumen = {
    totalLitros: 0,
    totalVentas: 0,
    ticketPromedio: 0,
    maquinas: new Set(),
    ultimaVenta: null
  };

  if (ventas.length === 0) {
    document.getElementById("resumen").innerHTML = `
      <div class="col-span-full p-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 shadow rounded">
        No hay ventas en el periodo seleccionado.
      </div>
    `;
    return;
  }

  ventas.forEach(v => {
    resumen.totalLitros += v.litros || 0;
    resumen.totalVentas += v.precio_total || 0;
    if (v.serial) resumen.maquinas.add(v.serial);
    if (!resumen.ultimaVenta || new Date(v.created_at) > new Date(resumen.ultimaVenta)) {
      resumen.ultimaVenta = v.created_at;
    }
  });

  resumen.ticketPromedio = ventas.length
    ? resumen.totalVentas / ventas.length
    : 0;

  document.getElementById("resumen").innerHTML = `
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">💧 <strong>${resumen.totalLitros.toFixed(1)}</strong> litros vendidos</div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">💰 $<strong>${resumen.totalVentas.toFixed(2)}</strong> en ventas</div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">🎟️ Ticket promedio: $<strong>${resumen.ticketPromedio.toFixed(2)}</strong></div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">🖥️ Máquinas activas: <strong>${resumen.maquinas.size}</strong></div>
    <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">📆 Última venta: <strong>${resumen.ultimaVenta ? new Date(resumen.ultimaVenta).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : 'N/A'}</strong></div>
  `;
}

function actualizarCSVSelector() {
  const select = document.getElementById("filtroMaquinaCSV");
  if (!select) return;
  
  select.innerHTML = `<option value="">Todas</option>`;
  maquinasActivas.forEach(serial => {
    select.innerHTML += `<option value="${serial}">${serial}</option>`;
  });
}

async function descargarCSV() {
  try {
    const fechaDesdeEl = document.getElementById("fechaDesde");
    const fechaHastaEl = document.getElementById("fechaHasta");
    const filtroEl = document.getElementById("filtroMaquinaCSV");
    
    if (!fechaDesdeEl || !fechaHastaEl || !filtroEl) {
      return alert("Error: No se encontraron los elementos de filtro");
    }
    
    const desde = fechaDesdeEl.value;
    const hasta = fechaHastaEl.value;
    const filtro = filtroEl.value;

    if (ventas.length === 0) {
      return alert("No hay datos para exportar");
    }

    const seleccionadas = ventas.filter(v => (!filtro || v.serial === filtro));
    
    if (seleccionadas.length === 0) {
      return alert("No hay ventas que correspondan a los filtros seleccionados");
    }

    const encabezados = ["Fecha", "Hora", "Máquina", "Litros", "Precio"];
    const filas = seleccionadas.map(v => {
      const fecha = new Date(v.created_at);
      return [
        fecha.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }),
        fecha.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" }),
        v.serial,
        v.litros,
        v.precio_total.toFixed(2)
      ];
    });

    const csv = encabezados.join(",") + "\n" + filas.map(f => f.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar CSV:", error);
    alert("Error al descargar CSV: " + error.message);
  }
}

function actualizarGraficas() {
  try {
    if (ventas.length === 0) {
      // Clear charts with no data message
      ["graficaHoras", "graficaDias", "graficaVolumen", "graficaMaquinas"].forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        
        const ctx = canvas.getContext("2d");
        if (window[id]) window[id].destroy();
        
        ctx.font = "16px Arial";
        ctx.fillStyle = "#718096";
        ctx.textAlign = "center";
        ctx.fillText("No hay datos disponibles", canvas.width / 2, canvas.height / 2);
      });
      return;
    }

    const porHora = Array(24).fill(0);
    const porDia = {};
    const porVolumen = { "5L": 0, "10L": 0, "20L": 0 };
    const porMaquina = {};

    ventas.forEach(v => {
      if (!v.created_at) return;
      
      const fecha = new Date(v.created_at);
      const hora = fecha.getHours();
      const dia = fecha.toLocaleDateString("es-MX");
      
      porHora[hora]++;
      porDia[dia] = (porDia[dia] || 0) + (v.precio_total || 0);

      const litros = v.litros || 0;
      if (litros <= 5.5) porVolumen["5L"] += litros;
      else if (litros <= 11) porVolumen["10L"] += litros;
      else porVolumen["20L"] += litros;

      if (v.serial) {
        porMaquina[v.serial] = (porMaquina[v.serial] || 0) + (v.precio_total || 0);
      }
    });

    renderBarChart("graficaHoras", porHora, "Ventas por hora", [...Array(24).keys()].map(h => h + ":00"));
    renderBarChart("graficaDias", Object.values(porDia), "Ventas por día", Object.keys(porDia));
    renderBarChart("graficaVolumen", Object.values(porVolumen), "Volumen vendido", Object.keys(porVolumen));
    renderBarChart("graficaMaquinas", Object.values(porMaquina), "Rendimiento por máquina", Object.keys(porMaquina));
  } catch (error) {
    console.error("Error al actualizar gráficas:", error);
    alert("Error al generar gráficas: " + error.message);
  }
}

function renderBarChart(id, data, label, labels) {
  try {
    const canvas = document.getElementById(id);
    if (!canvas) {
      console.error(`Canvas con ID ${id} no encontrado`);
      return;
    }
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(`No se pudo obtener contexto para ${id}`);
      return;
    }
    
    // Destroy existing chart if it exists
    if (window[id]) {
      window[id].destroy();
    }
    
    // Create color palette based on theme
    const isDark = document.documentElement.classList.contains('dark');
    const colors = isDark ? 
      'rgba(59, 130, 246, 0.8)' : // Blue for dark mode
      'rgba(37, 99, 235, 0.8)';   // Darker blue for light mode
    
    const textColor = isDark ? '#e2e8f0' : '#4a5568';
    
    window[id] = new Chart(ctx, {
      type: "bar",
      data: { 
        labels, 
        datasets: [{ 
          label, 
          data,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }] 
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: true,
        plugins: { 
          legend: { 
            display: false,
            labels: {
              color: textColor
            }
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            ticks: {
              color: textColor
            },
            grid: {
              color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            ticks: {
              color: textColor
            },
            grid: {
              color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error al renderizar gráfica ${id}:`, error);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', inicializarDashboard);
