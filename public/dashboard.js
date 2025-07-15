// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let mapaNombreMaquina = {};

document.addEventListener("DOMContentLoaded", getUser);

async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    return;
  }
  user = currentUser;
  await cargarMaquinasParaCSV();

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = ahora.toISOString().split("T")[0];

  cargarResumen();
  cargarGraficas();
  cargarDistribucionVolumen();
}

async function cargarMaquinasParaCSV() {
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("serial, nombre, ultimo_corte")
    .eq("user_id", user.id);

  const select = document.getElementById("filtroMaquinaCSV");
  const contenedor = document.getElementById("listaMaquinasCorte");
  select.innerHTML = "";
  contenedor.innerHTML = "";

  const todas = document.createElement("option");
  todas.value = "";
  todas.textContent = "Todas las máquinas";
  select.appendChild(todas);

  mapaNombreMaquina = {};

  for (const m of maquinas) {
    mapaNombreMaquina[m.serial] = m.nombre || m.serial;

    const op = document.createElement("option");
    op.value = m.serial;
    op.textContent = m.nombre || m.serial;
    select.appendChild(op);

    const { data: ventas } = await supabase
        .from("ventas")
        .select("precio_total")
        .eq("user_id", user.id)                        // ← filtrando solo tus ventas
        .eq("serial", m.serial)
        .gte("created_at", m.ultimo_corte || "2000-01-01T00:00:00Z");

    const total = ventas?.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0) || 0;
    let color = "bg-green-500 text-black";
    if (total >= 3000) color = "bg-yellow-400 text-white";
    if (total >= 6000) color = "bg-red-600 text-white";

    const div = document.createElement("div");
    div.className = "bg-white";

    div.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <p>💧 ${m.nombre || m.serial}</p>
        <button class="bg-blue-600 text-white px-3 py-1 rounded" onclick="hacerCorteDeCaja('${m.serial}')">Corte de caja</button>
      </div>
      <div class="${color} p-2 rounded text-center text-sm font-semibold">
        $${total.toFixed(2)} desde último corte
      </div>
    `;

    contenedor.appendChild(div);
  }
}

async function hacerCorteDeCaja(serial) {
  if (!confirm("¿Estás seguro de hacer el corte de caja?")) return;

  // 1) Traer la fecha del último corte
  const { data: maquina } = await supabase
    .from('maquinas')
    .select('ultimo_corte')
    .eq('serial', serial)
    .eq('user_id', user.id)
    .single();

  const ultimaFecha = maquina.ultimo_corte || '2000-01-01T00:00:00Z';

  // 2) Sumar todas las ventas desde esa fecha
  const { data: ventas, error: ventasErr } = await supabase
    .from('ventas')
    .select('precio_total')
    .eq('serial', serial)
    .eq('user_id', user.id)
    .gte('created_at', ultimaFecha);

  if (ventasErr) {
    console.error('Error sumando ventas:', ventasErr);
    alert('No se pudo calcular el total de ventas.');
    return;
  }

  const total = ventas.reduce((sum, v) => sum + parseFloat(v.precio_total), 0);

  // 3) Actualizar la fecha de último corte en la tabla máquinas
  const nuevoCorteISO = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('maquinas')
    .update({ ultimo_corte: nuevoCorteISO })
    .eq('serial', serial)
    .eq('user_id', user.id);

  if (updErr) {
    console.error('Error actualizando último corte:', updErr);
    alert('No se pudo actualizar la fecha de corte.');
    return;
  }

  // 4) Insertar registro en la tabla cortes
  const { error: corteErr } = await supabase
    .from('cortes')
    .insert({
      user_id:      user.id,
      serial:       serial,
      fecha_corte:  nuevoCorteISO,
      total_ventas: total
    });

  if (corteErr) {
    console.error('Error guardando el corte:', corteErr);
    alert('No se pudo registrar el corte de caja.');
    return;
  }

  alert(`Corte realizado: $${total.toFixed(2)} en ventas.`);
  
  // 5) Refrescar vista
  cargarResumen();
  cargarGraficas();
  cargarDistribucionVolumen();
  cargarMaquinasParaCSV();
}

// REEMPLAZA tu función cargarResumen() existente con esta versión mejorada.

async function cargarResumen() {
    // 1. Definir los rangos de fecha de manera consistente
    const ahora = new Date();
    const hoy_inicio = new Date();
    hoy_inicio.setHours(0, 0, 0, 0); // Inicio del día de hoy (medianoche)

    const semana_inicio = new Date(ahora);
    // Lógica para que la semana siempre empiece en Lunes
    semana_inicio.setDate(semana_inicio.getDate() - semana_inicio.getDay() + (semana_inicio.getDay() === 0 ? -6 : 1));
    semana_inicio.setHours(0, 0, 0, 0);

    const mes_inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // 2. CORRECCIÓN: Realizar consultas específicas y en paralelo para cada métrica
    const [
        ventasHoyData,
        ventasSemanaData,
        ventasMesData,
        ultimaVentaData,
        maquinasData
    ] = await Promise.all([
        supabase.from("ventas").select("precio_total, litros").eq("user_id", user.id).gte("created_at", hoy_inicio.toISOString()),
        supabase.from("ventas").select("precio_total").eq("user_id", user.id).gte("created_at", semana_inicio.toISOString()),
        supabase.from("ventas").select("precio_total").eq("user_id", user.id).gte("created_at", mes_inicio.toISOString()),
        supabase.from("ventas").select("created_at").eq("user_id", user.id).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from("maquinas").select("serial, nombre, last_seen").eq("user_id", user.id)
    ]);

    // 3. Procesar los resultados de las consultas
    const ventasHoy = ventasHoyData.data || [];
    const ventasSemana = ventasSemanaData.data || [];
    const ventasMes = ventasMesData.data || [];
    const ultimaVenta = ultimaVentaData.data;
    const maquinas = maquinasData.data || [];

    const resumen = {
        litrosHoy: ventasHoy.reduce((sum, v) => sum + parseFloat(v.litros || 0), 0),
        totalHoy: ventasHoy.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0),
        totalSemana: ventasSemana.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0),
        totalMes: ventasMes.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0),
        ticketMes: ventasMes.length > 0 ? (ventasMes.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0) / ventasMes.length) : 0,
        ultimaVenta: ultimaVenta ? ultimaVenta.created_at : null,
        activas: maquinas.filter(m => (ahora - new Date(m.last_seen)) / 60000 < 10).length,
        cantidad: maquinas.length,
    };

    // 4. Renderizar los KPIs y las tarjetas por máquina
    renderResumen(resumen);

    const contenedorMaquinas = document.getElementById("resumenMaquinas");
    contenedorMaquinas.innerHTML = '';
    
    // Obtener todas las ventas del mes para el resumen por máquina sin consultar de nuevo
    const ventasDelMesCompleto = (await supabase.from("ventas").select("serial, precio_total, created_at").eq("user_id", user.id).gte('created_at', mes_inicio.toISOString())).data || [];

    maquinas.forEach(m => {
        const ventasMaquina = ventasDelMesCompleto.filter(v => v.serial === m.serial);
        const resumenMaquina = {
            nombre: m.nombre || m.serial,
            totalHoy: ventasMaquina.filter(v => new Date(v.created_at) >= hoy_inicio).reduce((s, v) => s + parseFloat(v.precio_total || 0), 0),
            totalSemana: ventasMaquina.filter(v => new Date(v.created_at) >= semana_inicio).reduce((s, v) => s + parseFloat(v.precio_total || 0), 0),
            totalMes: ventasMaquina.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0),
        };
        renderResumenPorMaquina(resumenMaquina, contenedorMaquinas);
        renderMachineMap(maquinas, allSales || []);


    });
}


// REEMPLAZA tu función renderResumen actual por esta:
function renderResumen(r) {
    // Solo actualizamos el contenido de las tarjetas, ya no las creamos aquí
    document.getElementById("litrosHoy").textContent = `${r.litrosHoy.toFixed(1)} L`;
    document.getElementById("ventasHoy").textContent = `$${r.totalHoy.toFixed(2)}`;
    document.getElementById("ticketPromedio").textContent = `$${r.ticketMes.toFixed(2)}`; // Ahora es mensual
    document.getElementById("maquinasActivas").textContent = `${r.activas}/${r.cantidad}`;
    document.getElementById("ultimaVenta").textContent = r.ultimaVenta ? new Date(r.ultimaVenta).toLocaleString("es-MX") : "N/A";
    document.getElementById("ventasSemana").textContent = `$${r.totalSemana.toFixed(2)}`;
    document.getElementById("ventasMes").textContent = `$${r.totalMes.toFixed(2)}`;
}




// AÑADE esta función nueva a tu archivo .js
function renderResumenPorMaquina(r, contenedor) {
    const div = document.createElement('div');
    div.className = 'section-card kpi-machine-card'; // Usamos una nueva clase para estilo opcional
    div.innerHTML = `
        <h3 class="text-lg font-bold text-blue-600 mb-3">${r.nombre}</h3>
        <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span>Ventas Hoy:</span> <span class="font-semibold">$${r.totalHoy.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Ventas Semana:</span> <span class="font-semibold">$${r.totalSemana.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Ventas Mes:</span> <span class="font-semibold">$${r.totalMes.toFixed(2)}</span></div>
        </div>
    `;
    contenedor.appendChild(div);
}

async function cargarDistribucionVolumen() {
    // Para consistencia con el resto del código, usamos getFilters() que devuelve objetos Date
    const { fromDate, toDate, serial } = getFilters();

    // Verificación de que las fechas son válidas
    if (!fromDate || !toDate) {
        console.error("Fechas de filtro inválidas.");
        return;
    }

    try {
        let query = supabase.from("ventas")
            .select("litros")
            .eq("user_id", user.id)
            .gte("created_at", fromDate.toISOString())
            .lte("created_at", toDate.toISOString());

        if (serial) {
            query = query.eq("serial", serial);
        }

        // CORRECCIÓN 1: Manejo de errores
        const { data: ventas, error } = await query;

        if (error) {
            // Si Supabase devuelve un error, lo lanzamos para que el bloque catch lo maneje
            throw error;
        }

        if (!ventas) {
            // Si no hay ventas, no hay nada que hacer
            return;
        }

        const volumeCounts = { "20L": 0, "10L": 0, "5L": 0, "Galón": 0, "Otros": 0 };

        ventas.forEach(v => {
            const litros = parseFloat(v.litros);
            if (litros === 20) volumeCounts["20L"]++;
            else if (litros === 10) volumeCounts["10L"]++;
            else if (litros === 5) volumeCounts["5L"]++;
            // CORRECCIÓN 2: Valor más preciso para el galón
            else if (litros === 3.7) volumeCounts["Galón"]++; 
            else volumeCounts["Otros"]++;
        });

        renderVolumeCards(volumeCounts);

    } catch (error) {
        console.error("Error al cargar la distribución de volumen:", error);
        alert("No se pudieron cargar los datos de volumen: " + error.message);
    }
}
async function cargarGraficas() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const serial = document.getElementById("filtroMaquinaCSV").value;

  if (!desde || !hasta) return;

  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + "T23:59:59").toISOString();

  const { data: ventas } = await supabase
    .from("ventas")
    .select("*")
    .eq("user_id", user.id)  
    .gte("created_at", desdeISO)
    .lte("created_at", hastaISO);

  const filtradas = serial ? ventas.filter(v => v.serial === serial) : ventas;

  renderGraficaHoras(filtradas);
  renderGraficaDias(filtradas);
  renderGraficaVolumen(filtradas);
  renderGraficaMaquinas(filtradas);
  renderHeatmap(filtradas);

}

function renderGraficaHoras(ventas) {
  // 1. Paleta de colores para las barras
  const colores = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#d946ef', '#ec4899', '#65a30d', '#f97316'
  ];

  const mapaVentas = {}; // { 0: { "serial_1": 100, "serial_2": 50 }, 1: {...}, ... }
  const maquinasUnicas = new Set();

  // 2. Procesamos las ventas para agruparlas por hora y por máquina
  ventas.forEach(v => {
    const hora = new Date(v.created_at).getHours();
    const serial = v.serial;
    const totalVenta = parseFloat(v.precio_total || 0);

    maquinasUnicas.add(serial);

    if (!mapaVentas[hora]) {
      mapaVentas[hora] = {};
    }
    if (!mapaVentas[hora][serial]) {
      mapaVentas[hora][serial] = 0;
    }

    mapaVentas[hora][serial] += totalVenta;
  });

  // 3. Preparamos las etiquetas para el eje X (0:00 a 23:00)
  const labels = [...Array(24).keys()].map(h => `${h}:00`);

  // 4. Creamos un "dataset" para cada máquina
  const datasets = Array.from(maquinasUnicas).map((serial, index) => {
    const datosMaquina = labels.map((label, horaIndex) => {
      // Obtenemos las ventas de esa hora para esa máquina, o 0 si no hubo
      return (mapaVentas[horaIndex] && mapaVentas[horaIndex][serial]) || 0;
    });
    
    const color = colores[index % colores.length];

    return {
      label: mapaNombreMaquina[serial] || serial,
      data: datosMaquina,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1
    };
  });

  // 5. Renderizamos la nueva gráfica agrupada
  const ctx = document.getElementById("graficaHoras").getContext('2d');
  if (window.chartHoras) {
    window.chartHoras.destroy();
  }

  window.chartHoras = new Chart(ctx, {
    type: 'bar', // Mantenemos el tipo de gráfica de barras
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Ventas por Hora por Máquina'
        }
      },
      scales: {
        x: {
          stacked: false, // false para agrupar las barras, true para apilarlas
        },
        y: {
          stacked: false,
          beginAtZero: true
        }
      }
    }
  });
}

function renderGraficaDias(ventas) {
  // Paleta de colores para las líneas de la gráfica
  const colores = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#d946ef', '#ec4899', '#65a30d', '#f97316'
  ];

  const mapaVentas = {}; // { "26/6/2025": { "serial_1": 100, "serial_2": 50 }, ... }
  const maquinasUnicas = new Set();
  const fechasUnicas = new Set();

  // 1. Procesamos todas las ventas para agruparlas por fecha y por máquina
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString("es-MX", { year: '2-digit', month: '2-digit', day: '2-digit' });
    const serial = v.serial;
    const totalVenta = parseFloat(v.precio_total || 0);

    fechasUnicas.add(fecha);
    maquinasUnicas.add(serial);

    if (!mapaVentas[fecha]) {
      mapaVentas[fecha] = {};
    }
    if (!mapaVentas[fecha][serial]) {
      mapaVentas[fecha][serial] = 0;
    }

    mapaVentas[fecha][serial] += totalVenta;
  });

  // 2. Preparamos las etiquetas (labels) para el eje X, ordenadas por fecha
  const labels = Array.from(fechasUnicas).sort((a, b) => {
    const [dayA, monthA, yearA] = a.split('/');
    const [dayB, monthB, yearB] = b.split('/');
    return new Date(`20${yearA}-${monthA}-${dayA}`) - new Date(`20${yearB}-${monthB}-${dayB}`);
  });

  // 3. Creamos un "dataset" (un conjunto de datos) para cada máquina
  const datasets = Array.from(maquinasUnicas).map((serial, index) => {
    const datosMaquina = labels.map(fecha => mapaVentas[fecha][serial] || 0);
    const color = colores[index % colores.length]; // Reutilizamos colores si hay muchas máquinas

    return {
      label: mapaNombreMaquina[serial] || serial, // Usamos el nombre de la máquina si existe
      data: datosMaquina,
      borderColor: color,
      backgroundColor: `${color}33`, // Mismo color pero con transparencia
      fill: false,
      tension: 0.1
    };
  });

  // 4. (Opcional) Creamos un dataset para las ventas totales
  const datosTotales = labels.map(fecha => {
    return Object.values(mapaVentas[fecha]).reduce((total, venta) => total + venta, 0);
  });

  datasets.unshift({ // .unshift() lo añade al principio de la lista
    label: 'Ventas Totales ($)',
    data: datosTotales,
    borderColor: '#1e40af',
    backgroundColor: '#1e40af33',
    borderWidth: 3, // Hacemos la línea de totales más gruesa
    fill: false,
    tension: 0.1
  });


  // 5. Renderizamos la gráfica con los nuevos datasets
  const ctx = document.getElementById("graficaDias").getContext('2d');
  if (window.chartDias) {
    window.chartDias.destroy(); // Destruimos la gráfica anterior si existe
  }

  window.chartDias = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets // Usamos nuestro nuevo array de datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Ventas Diarias por Máquina'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderGraficaVolumen(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.litros || 0);
  });

  const labels = Object.keys(mapa).map(s => mapaNombreMaquina[s] || s);
  const valores = Object.values(mapa);

  const ctx = document.getElementById("graficaVolumen");
  if (window.chartVolumen) window.chartVolumen.destroy();
  window.chartVolumen = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Litros vendidos por máquina", data: valores, backgroundColor: "#10b981" }]
    }
  });
}

function renderGraficaMaquinas(ventas) {
  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total || 0);
  });

  const labels = Object.keys(mapa).map(s => mapaNombreMaquina[s] || s);
  const valores = Object.values(mapa);

  const ctx = document.getElementById("graficaMaquinas");
  if (window.chartMaquinas) window.chartMaquinas.destroy();
  window.chartMaquinas = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Ventas por máquina ($)", data: valores, backgroundColor: "#f59e0b" }]
    }
  });
}

// CSV Download functionality
document.getElementById("btnDescargarCSV").addEventListener("click", async () => {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const serial = document.getElementById("filtroMaquinaCSV").value;

  if (!desde || !hasta) {
    alert("Por favor selecciona un rango de fechas");
    return;
  }

  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + "T23:59:59").toISOString();

  let query = supabase
    .from("ventas")
    .select("*")
    .gte("created_at", desdeISO)
    .lte("created_at", hastaISO);

  if (serial) {
    query = query.eq("serial", serial);
  }

  const { data: ventas, error } = await query;

  if (error) {
    alert("Error al obtener datos: " + error.message);
    return;
  }

  // Generate CSV
  let csv = "Fecha,Hora,Máquina,Litros,Precio Total,Tipo Dispositivo,Duración\n";
  
  ventas.forEach(v => {
    const fecha = new Date(v.created_at);
    const fechaStr = fecha.toLocaleDateString("es-MX");
    const horaStr = fecha.toLocaleTimeString("es-MX");
    const maquina = mapaNombreMaquina[v.serial] || v.serial;
    
    csv += `${fechaStr},${horaStr},${maquina},${v.litros},${v.precio_total},${v.tipo_dispositivo || "N/A"},${v.duracion_segundos || "N/A"}\n`;
  });

  // Download CSV
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `ventas_${desde}_${hasta}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
function getFilters() {
    const fromDateStr = document.getElementById("fechaDesde").value;
    const toDateStr = document.getElementById("fechaHasta").value;
    const serial = document.getElementById("filtroMaquinaCSV").value;

    const fromDate = new Date(fromDateStr);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(toDateStr);
    toDate.setHours(23, 59, 59, 999);

    return { fromDate, toDate, serial };
}
function renderVolumeCards(volumeCounts) {
    const container = document.getElementById("volumeDistribution");
    container.innerHTML = ""; // Clear previous cards

    const colors = {
        "20L": "bg-blue-500",
        "10L": "bg-green-500",
        "5L": "bg-yellow-500",
        "Galón": "bg-purple-500",
        "Otros": "bg-gray-500"
    };
    
    const totalVentas = Object.values(volumeCounts).reduce((sum, count) => sum + count, 0);

    for (const [volume, count] of Object.entries(volumeCounts)) {
        const percentage = totalVentas > 0 ? ((count / totalVentas) * 100).toFixed(1) : 0;
        const cardHTML = `
            <div class="bg-white p-4 rounded-lg shadow text-center">
                <p class="text-gray-500 text-sm mb-2">${volume}</p>
                <div class="${colors[volume]} text-white rounded-full w-16 h-16 mx-auto flex items-center justify-center text-xl font-bold mb-2">${count}</div>
                <p class="text-sm text-gray-600">${percentage}%</p>
            </div>
        `;
        container.innerHTML += cardHTML;
    }
}
function renderMachineMap(machines, allSales) {
    // Initialize map and cluster group only once
    if (!window.machineMap) {
        window.machineMap = L.map('machineMap').setView([25.6866, -100.3161], 10); // Centered on Monterrey
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(window.machineMap);
        window.markerClusterGroup = L.markerClusterGroup().addTo(window.machineMap);
    }

    // Clear existing markers from the cluster group
    window.markerClusterGroup.clearLayers();

    // Define custom icons with different colors
    const greenIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    const yellowIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    const redIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    
    // Get sales data for today to determine marker color
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    machines.forEach(machine => {
        if (machine.latitude && machine.longitude) {
            // Calculate today's sales for this machine
            const salesToday = allSales
                .filter(s => s.serial === machine.serial && new Date(s.created_at) >= todayStart)
                .reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);

            // Determine marker color based on sales
            let icon = redIcon; // Default to red
            if (salesToday > 50) icon = yellowIcon; // Over $50 is yellow
            if (salesToday > 200) icon = greenIcon;  // Over $200 is green
            
            // Check machine status
            const isActive = (new Date() - new Date(machine.last_seen)) / 60000 < 10;
            const statusText = isActive ? 'Online 🟢' : 'Offline 🔴';

            // Create marker and pop-up content
            const marker = L.marker([machine.latitude, machine.longitude], { icon: icon });
            const popupContent = `
                <b>${machine.nombre || machine.serial}</b><br>
                <b>Status:</b> ${statusText}<br>
                <b>Today's Sales:</b> $${salesToday.toFixed(2)}
            `;
            marker.bindPopup(popupContent);
            
            // Add the marker to the cluster group
            window.markerClusterGroup.addLayer(marker);
        }
    });
}

function renderHeatmap(ventas) {
    const ctx = document.getElementById('graficaHeatmap').getContext('2d');
    
    if (window.chartHeatmap) {
        window.chartHeatmap.destroy();
    }

    // Process data for the heatmap
    const dataByDayHour = {}; // { '0-23': 0, '1-0': 12, ... } (day-hour: totalSales)
    for (let i = 0; i < 7; i++) { // 0=Sunday, 6=Saturday
        for (let j = 0; j < 24; j++) {
            const key = `${i}-${j}`;
            dataByDayHour[key] = 0;
        }
    }

    ventas.forEach(v => {
        const date = new Date(v.created_at);
        const day = date.getDay();
        const hour = date.getHours();
        const key = `${day}-${hour}`;
        dataByDayHour[key] += parseFloat(v.precio_total || 0);
    });

    const chartData = Object.entries(dataByDayHour).map(([key, value]) => {
        const [day, hour] = key.split('-');
        return { x: parseInt(hour), y: parseInt(day), v: value };
    });

    window.chartHeatmap = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Ventas ($)',
                data: chartData,
                backgroundColor: function(context) {
                    const value = context.dataset.data[context.dataIndex].v;
                    if (value === 0) return 'rgba(230, 230, 230, 0.5)';
                    const alpha = Math.min(0.2 + (value / 50), 1); // Normalize color intensity based on sales value
                    return `rgba(75, 192, 192, ${alpha})`;
                },
                borderColor: 'rgba(200, 200, 200, 0.6)',
                borderWidth: 1,
                width: ({chart}) => (chart.chartArea || {}).width / 24 - 1,
                height: ({chart}) => (chart.chartArea || {}).height / 7 - 1,
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            const item = context.dataset.data[context.dataIndex];
                            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                            return `${days[item.y]} a las ${item.x}:00 - $${item.v.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'category',
                    labels: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
                    offset: true
                },
                x: {
                    type: 'category',
                    labels: [...Array(24).keys()].map(h => `${h}`),
                    offset: true
                }
            }
        }
    });
}


// Logout functionality
document.getElementById("btnLogout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});
