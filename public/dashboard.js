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
        .eq("user_id", user.id)                        // ← filtrando solo tus ventas
        .eq("serial", m.serial)
        .gte("created_at", m.ultimo_corte || "2000-01-01T00:00:00Z");

    const total = ventas?.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0) || 0;
    let color = "bg-yellow-400 text-black";
    if (total >= 500) color = "bg-green-500 text-white";
    if (total >= 2000) color = "bg-red-600 text-white";

    const div = document.createElement("div");
    div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow";

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
      user_id:      user.id,
      serial:       serial,
      fecha_corte:  nuevoCorteISO,
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

async function cargarResumen() {
  const ahora = new Date();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const semanaInicio = new Date(ahora);
  semanaInicio.setDate(semanaInicio.getDate() - semanaInicio.getDay() + (semanaInicio.getDay() === 0 ? -6 : 1)); // Lunes como inicio de semana
  semanaInicio.setHours(0, 0, 0, 0);
  const mesInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  mesInicio.setHours(0, 0, 0, 0);

  // 1. Obtenemos todos los datos necesarios una sola vez
  const { data: maquinas } = await supabase.from("maquinas").select("serial, nombre, last_seen").eq("user_id", user.id);
  const { data: ventas } = await supabase.from("ventas").select("created_at, precio_total, litros, serial").eq("user_id", user.id);

  // 2. Calculamos los totales generales
  const resumen = { litrosHoy: 0, totalHoy: 0, ultimaVenta: null, ticketMes: 0, activas: 0, cantidad: 0 };
  resumen.cantidad = maquinas.length;
  resumen.activas = maquinas.filter(m => (ahora - new Date(m.last_seen)) / 60000 < 10).length;

  const hoyVentas = ventas.filter(v => new Date(v.created_at) >= hoy);
  const semanaVentas = ventas.filter(v => new Date(v.created_at) >= semanaInicio);
  const mesVentas = ventas.filter(v => new Date(v.created_at) >= mesInicio);

  if (hoyVentas.length > 0) {
    resumen.litrosHoy = hoyVentas.reduce((s, v) => s + (parseFloat(v.litros) || 0), 0);
    resumen.totalHoy = hoyVentas.reduce((s, v) => s + (parseFloat(v.precio_total) || 0), 0);
  }

  if (ventas.length > 0) {
      // Ordenamos para encontrar la última venta de todas
      ventas.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      resumen.ultimaVenta = ventas[0].created_at;
  }
  
  // *** CAMBIO: Ticket promedio ahora es mensual ***
  if (mesVentas.length > 0) {
    const totalMes = mesVentas.reduce((s, v) => s + (parseFloat(v.precio_total) || 0), 0);
    resumen.ticketMes = totalMes / mesVentas.length;
    document.getElementById("ventasMes").textContent = `$${totalMes.toFixed(2)}`;
  } else {
    document.getElementById("ventasMes").textContent = `$0.00`;
  }
  
  const totalSemana = semanaVentas.reduce((s, v) => s + (parseFloat(v.precio_total) || 0), 0);
  document.getElementById("ventasSemana").textContent = `$${totalSemana.toFixed(2)}`;

  renderResumen(resumen); // Renderiza las tarjetas de totales

  // 3. *** NUEVO: Calculamos y renderizamos las tarjetas por cada máquina ***
  const contenedorMaquinas = document.getElementById("resumenMaquinas");
  contenedorMaquinas.innerHTML = ''; // Limpiamos el contenedor

  maquinas.forEach(m => {
    const ventasMaquina = ventas.filter(v => v.serial === m.serial);
    
    const ventasHoyMaquina = ventasMaquina.filter(v => new Date(v.created_at) >= hoy);
    const ventasSemanaMaquina = ventasMaquina.filter(v => new Date(v.created_at) >= semanaInicio);
    const ventasMesMaquina = ventasMaquina.filter(v => new Date(v.created_at) >= mesInicio);

    const resumenMaquina = {
      nombre: m.nombre || m.serial,
      totalHoy: ventasHoyMaquina.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0),
      totalSemana: ventasSemanaMaquina.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0),
      totalMes: ventasMesMaquina.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0),
    };

    renderResumenPorMaquina(resumenMaquina, contenedorMaquinas);
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
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const serial = document.getElementById("filtroMaquinaCSV").value;

  if (!desde || !hasta) return;

  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + "T23:59:59").toISOString();

  // Get sales data
  let query = supabase
    .from("ventas")
    .select("litros")
    .eq("user_id", user.id)
    .gte("created_at", desdeISO)
    .lte("created_at", hastaISO);

  if (serial) {
    query = query.eq("serial", serial);
  }

  const { data: ventas, error } = await query;
  
  if (error) {
    console.error("Error loading volume distribution:", error);
    return;
  }

  // Count volumes
  const volumeCounts = {
    "20L": 0,
    "10L": 0,
    "5L": 0,
    "Galón": 0,
    "Otros": 0
  };

  ventas.forEach(venta => {
    const litros = parseFloat(venta.litros);
    
    if (litros === 20) {
      volumeCounts["20L"]++;
    } else if (litros === 10) {
      volumeCounts["10L"]++;
    } else if (litros === 5) {
      volumeCounts["5L"]++;
    } else if (litros === 3.75) { // Gallon in liters
      volumeCounts["Galón"]++;
    } else {
      volumeCounts["Otros"]++;
    }
  });

  // Update or create the volume distribution cards
  renderVolumeCards(volumeCounts);
}

function renderVolumeCards(volumeCounts) {
  // Check if container exists, if not create it
  let container = document.getElementById("volumeDistribution");
  
  if (!container) {
    // Create container after the resumen section
    container = document.createElement("div");
    container.id = "volumeDistribution";
    container.className = "mt-8";
    
    // Add title
    const title = document.createElement("h2");
    title.className = "text-xl font-bold mb-4";
    title.textContent = "Distribución por Volumen";
    container.appendChild(title);
    
    // Add cards container
    const cardsContainer = document.createElement("div");
    cardsContainer.id = "volumeCards";
    cardsContainer.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4";
    container.appendChild(cardsContainer);
    
    // Insert after resumen
    const resumen = document.getElementById("resumen");
    resumen.parentNode.insertBefore(container, resumen.nextSibling);
  }
  
  // Update cards
  const cardsContainer = document.getElementById("volumeCards");
  cardsContainer.innerHTML = "";
  
  // Define colors for each volume type
  const colors = {
    "20L": "bg-blue-500",
    "10L": "bg-green-500",
    "5L": "bg-yellow-500",
    "Galón": "bg-purple-500",
    "Otros": "bg-gray-500"
  };
  
  // Create cards for each volume type
  Object.entries(volumeCounts).forEach(([volume, count]) => {
    const card = document.createElement("div");
    card.className = "bg-white dark:bg-gray-800 p-4 rounded shadow text-center";
    
    const volumeLabel = document.createElement("p");
    volumeLabel.className = "text-gray-500 dark:text-gray-400 text-sm mb-2";
    volumeLabel.textContent = volume;
    
    const countDisplay = document.createElement("div");
    countDisplay.className = `${colors[volume]} text-white rounded-full w-16 h-16 mx-auto flex items-center justify-center text-xl font-bold mb-2`;
    countDisplay.textContent = count;
    
    const percentageDisplay = document.createElement("p");
    const total = Object.values(volumeCounts).reduce((sum, val) => sum + val, 0);
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    percentageDisplay.className = "text-sm text-gray-600 dark:text-gray-300";
    percentageDisplay.textContent = `${percentage}%`;
    
    card.appendChild(volumeLabel);
    card.appendChild(countDisplay);
    card.appendChild(percentageDisplay);
    
    cardsContainer.appendChild(card);
  });
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

// Logout functionality
document.getElementById("btnLogout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});
