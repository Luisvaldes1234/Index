// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === ESTADO GLOBAL ===
let user = null;
let mapaNombreMaquina = {};
let maquinasUsuario = [];

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();

    if (error || !currentUser) {
        alert("No estás autenticado. Redirigiendo al login.");
        window.location.href = "/login.html";
        return;
    }
    user = currentUser;

    // Configurar escuchadores de eventos
    document.getElementById("fechaDesde").addEventListener("change", actualizarDashboard);
    document.getElementById("fechaHasta").addEventListener("change", actualizarDashboard);
    document.getElementById("filtroMaquinaCSV").addEventListener("change", actualizarDashboard);
    document.getElementById("btnDescargarCSV").addEventListener("click", descargarCSV);
    document.getElementById("btnLogout").addEventListener("click", () => supabase.auth.signOut().then(() => window.location.href = "/login.html"));

    await iniciarDashboard();
});

async function iniciarDashboard() {
    document.getElementById("loading").classList.remove("hidden");

    // Establecer fechas por defecto (mes actual)
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
    document.getElementById("fechaHasta").value = ahora.toISOString().split("T")[0];

    await cargarFiltrosYMapaMaquinas();
    await cargarTarjetasCorte();
    await actualizarDashboard();

    document.getElementById("loading").classList.add("hidden");
}

// === FUNCIONES PRINCIPALES DE CARGA Y ACTUALIZACIÓN ===

/**
 * Carga las máquinas del usuario, pobla el filtro de máquinas y crea un mapa de nombres.
 * Se ejecuta una sola vez al inicio.
 */
async function cargarFiltrosYMapaMaquinas() {
    const { data } = await supabase.from("maquinas").select("serial, nombre").eq("user_id", user.id);
    maquinasUsuario = data || [];
    mapaNombreMaquina = {};

    const select = document.getElementById("filtroMaquinaCSV");
    select.innerHTML = '<option value="">Todas las máquinas</option>'; // Limpiar y añadir opción "Todas"

    maquinasUsuario.forEach(m => {
        mapaNombreMaquina[m.serial] = m.nombre || m.serial;
        const op = document.createElement("option");
        op.value = m.serial;
        op.textContent = mapaNombreMaquina[m.serial];
        select.appendChild(op);
    });

    document.getElementById("maquinasTotal").textContent = maquinasUsuario.length;
}

/**
 * Carga las tarjetas para realizar cortes de caja.
 * Corrige el problema N+1 haciendo una sola consulta de ventas.
 */
async function cargarTarjetasCorte() {
    const { data: maquinas } = await supabase.from("maquinas").select("serial, nombre, ultimo_corte").eq("user_id", user.id);
    if (!maquinas || maquinas.length === 0) return;

    const { data: todasLasVentas } = await supabase.from("ventas").select("serial, precio_total, created_at").eq("user_id", user.id).in('serial', maquinas.map(m => m.serial));

    const contenedor = document.getElementById("listaMaquinasCorte");
    contenedor.innerHTML = "";

    maquinas.forEach(m => {
        const ventasDeLaMaquina = (todasLasVentas || []).filter(v =>
            v.serial === m.serial && new Date(v.created_at) >= new Date(m.ultimo_corte || "2000-01-01T00:00:00Z")
        );
        const total = ventasDeLaMaquina.reduce((s, v) => s + parseFloat(v.precio_total || 0), 0);

        let color = "bg-yellow-400 text-black";
        if (total >= 500) color = "bg-green-500 text-white";
        if (total >= 2000) color = "bg-red-600 text-white";

        const div = document.createElement("div");
        div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <p class="font-bold">💧 ${m.nombre || m.serial}</p>
                <button class="modern-button corte" onclick="hacerCorteDeCaja('${m.serial}')">Hacer Corte</button>
            </div>
            <div class="${color} p-2 rounded text-center font-semibold">
                $${total.toFixed(2)} <span class="font-normal">desde último corte</span>
            </div>`;
        contenedor.appendChild(div);
    });
}


/**
 * Función central que se ejecuta al cambiar filtros. Obtiene los datos y llama a las funciones de renderizado.
 */
async function actualizarDashboard() {
    const desde = document.getElementById("fechaDesde").value;
    const hasta = document.getElementById("fechaHasta").value;
    if (!desde || !hasta) return;

    const desdeISO = new Date(desde).toISOString();
    const hastaISO = new Date(hasta + "T23:59:59").toISOString();

    // ÚNICA LLAMADA para obtener los datos de ventas del rango seleccionado
    const { data: ventas } = await supabase.from("ventas").select("*").eq("user_id", user.id).gte("created_at", desdeISO).lte("created_at", hastaISO);
    
    // Filtramos por máquina si hay una seleccionada
    const serialSeleccionado = document.getElementById("filtroMaquinaCSV").value;
    const ventasFiltradas = serialSeleccionado ? (ventas || []).filter(v => v.serial === serialSeleccionado) : (ventas || []);

    // Actualizamos todos los componentes con los datos obtenidos
    renderizarResumen(ventas || []); // El resumen general siempre usa todos los datos del rango
    renderizarVentasPorMaquina(ventasFiltradas);
    renderizarGraficas(ventasFiltradas);
    cargarDistribucionVolumen(ventasFiltradas);
}

// === FUNCIONES DE RENDERIZADO (MOSTRAR DATOS) ===

function renderizarResumen(ventas) {
    const ahora = new Date();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - ahora.getDay() + (ahora.getDay() === 0 ? -6 : 1)); // Lunes como inicio de semana
    inicioSemana.setHours(0, 0, 0, 0);

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // Filtrar ventas por periodos
    const ventasHoy = ventas.filter(v => new Date(v.created_at) >= hoy);
    const ventasSemana = ventas.filter(v => new Date(v.created_at) >= inicioSemana);
    const ventasMes = ventas.filter(v => new Date(v.created_at) >= inicioMes);

    // Calcular totales
    const totalHoy = ventasHoy.reduce((s, v) => s + (v.precio_total || 0), 0);
    const litrosHoy = ventasHoy.reduce((s, v) => s + (v.litros || 0), 0);
    const totalSemana = ventasSemana.reduce((s, v) => s + (v.precio_total || 0), 0);
    const totalMes = ventasMes.reduce((s, v) => s + (v.precio_total || 0), 0);
    
    // Calcular tickets promedio
    const ticketHoy = ventasHoy.length > 0 ? totalHoy / ventasHoy.length : 0;
    const ticketSemana = ventasSemana.length > 0 ? totalSemana / ventasSemana.length : 0;
    const ticketMes = ventasMes.length > 0 ? totalMes / ventasMes.length : 0;

    // Actualizar DOM de forma segura
    document.getElementById("ventasHoy").textContent = `$${totalHoy.toFixed(2)}`;
    document.getElementById("litrosHoy").textContent = `${litrosHoy.toFixed(1)} L`;
    document.getElementById("ticketPromedioHoy").textContent = `$${ticketHoy.toFixed(2)}`;
    
    document.getElementById("ventasSemana").textContent = `$${totalSemana.toFixed(2)}`;
    document.getElementById("ticketPromedioSemana").textContent = `$${ticketSemana.toFixed(2)}`;

    document.getElementById("ventasMes").textContent = `$${totalMes.toFixed(2)}`;
    document.getElementById("ticketPromedioMes").textContent = `$${ticketMes.toFixed(2)}`;

    if (ventasHoy.length > 0) {
        const ultimaVenta = new Date(ventasHoy[ventasHoy.length - 1].created_at);
        document.getElementById("ultimaVenta").textContent = ultimaVenta.toLocaleTimeString('es-MX');
    } else {
        document.getElementById("ultimaVenta").textContent = "N/A";
    }
}

function renderizarVentasPorMaquina(ventas) {
    const contenedor = document.getElementById("resumenPorMaquina");
    contenedor.innerHTML = ""; // Limpiar antes de renderizar

    if (ventas.length === 0) {
        contenedor.innerHTML = `<p class="text-gray-500 col-span-full text-center">No hay ventas para mostrar con los filtros seleccionados.</p>`;
        return;
    }

    const ventasAgrupadas = ventas.reduce((acc, venta) => {
        const serial = venta.serial;
        if (!acc[serial]) {
            acc[serial] = 0;
        }
        acc[serial] += venta.precio_total || 0;
        return acc;
    }, {});

    for (const serial in ventasAgrupadas) {
        const total = ventasAgrupadas[serial];
        const nombreMaquina = mapaNombreMaquina[serial] || serial;

        const card = document.createElement("div");
        card.className = "kpi-card"; // Reutilizamos el estilo de las tarjetas KPI
        card.innerHTML = `
            <p class="kpi-label">💧 ${nombreMaquina}</p>
            <h2 class="kpi-value">$${total.toFixed(2)}</h2>`;
        contenedor.appendChild(card);
    }
}

function renderizarGraficas(ventas) {
    renderGraficaHoras(ventas);
    renderGraficaDias(ventas);
    renderGraficaVolumen(ventas);
    renderGraficaMaquinas(ventas);
}

function renderGraficaHoras(ventas) {
    const horas = Array(24).fill(0);
    ventas.forEach(v => {
        const h = new Date(v.created_at).getHours();
        horas[h] += parseFloat(v.precio_total || 0);
    });

    const ctx = document.getElementById("graficaHoras").getContext('2d');
    if (window.chartHoras) window.chartHoras.destroy();
    window.chartHoras = new Chart(ctx, { type: "bar", data: { labels: [...Array(24).keys()].map(h => `${h}:00`), datasets: [{ label: "Ventas por hora ($)", data: horas, backgroundColor: "#60a5fa" }] } });
}

function renderGraficaDias(ventas) {
    const mapa = {};
    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString("es-MX", { day: '2-digit', month: '2-digit' });
        mapa[fecha] = (mapa[fecha] || 0) + parseFloat(v.precio_total || 0);
    });

    const labels = Object.keys(mapa).sort((a,b) => {
        const [dayA, monthA] = a.split('/');
        const [dayB, monthB] = b.split('/');
        return new Date(`2000-${monthA}-${dayA}`) - new Date(`2000-${monthB}-${dayB}`);
    });
    const valores = labels.map(k => mapa[k]);

    const ctx = document.getElementById("graficaDias").getContext('2d');
    if (window.chartDias) window.chartDias.destroy();
    window.chartDias = new Chart(ctx, { type: "line", data: { labels, datasets: [{ label: "Ventas por día ($)", data: valores, borderColor: "#3b82f6", backgroundColor: "#bfdbfe", tension: 0.1 }] } });
}

function renderGraficaVolumen(ventas) {
    const mapa = {};
    ventas.forEach(v => {
        const nombre = mapaNombreMaquina[v.serial] || v.serial;
        mapa[nombre] = (mapa[nombre] || 0) + parseFloat(v.litros || 0);
    });

    const labels = Object.keys(mapa);
    const valores = Object.values(mapa);

    const ctx = document.getElementById("graficaVolumen").getContext('2d');
    if (window.chartVolumen) window.chartVolumen.destroy();
    window.chartVolumen = new Chart(ctx, { type: "bar", data: { labels, datasets: [{ label: "Litros vendidos por máquina", data: valores, backgroundColor: "#10b981" }] } });
}

function renderGraficaMaquinas(ventas) {
    const mapa = {};
    ventas.forEach(v => {
        const nombre = mapaNombreMaquina[v.serial] || v.serial;
        mapa[nombre] = (mapa[nombre] || 0) + parseFloat(v.precio_total || 0);
    });

    const labels = Object.keys(mapa);
    const valores = Object.values(mapa);

    const ctx = document.getElementById("graficaMaquinas").getContext('2d');
    if (window.chartMaquinas) window.chartMaquinas.destroy();
    window.chartMaquinas = new Chart(ctx, { type: "bar", data: { labels, datasets: [{ label: "Ventas por máquina ($)", data: valores, backgroundColor: "#f59e0b" }] } });
}

function cargarDistribucionVolumen(ventas) {
  const volumeCounts = { "20L": 0, "10L": 0, "5L": 0, "Galón": 0, "Otros": 0 };

  ventas.forEach(venta => {
    const litros = parseFloat(venta.litros);
    if (litros === 20) volumeCounts["20L"]++;
    else if (litros === 10) volumeCounts["10L"]++;
    else if (litros === 5) volumeCounts["5L"]++;
    else if (litros === 3.785) volumeCounts["Galón"]++;
    else volumeCounts["Otros"]++;
  });
  renderVolumeCards(volumeCounts);
}

function renderVolumeCards(volumeCounts) {
  let container = document.getElementById("volumeDistribution");
  if (!container) {
    container = document.createElement("div");
    container.id = "volumeDistribution";
    container.className = "section-card";
    container.innerHTML = `
        <h2 class="section-title">Distribución por Volumen</h2>
        <div id="volumeCards" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"></div>
    `;
    const resumenGeneral = document.querySelector(".section-card");
    resumenGeneral.parentNode.insertBefore(container, resumenGeneral.nextSibling.nextSibling);
  }
  
  const cardsContainer = document.getElementById("volumeCards");
  cardsContainer.innerHTML = "";
  
  const colors = { "20L": "bg-blue-500", "10L": "bg-green-500", "5L": "bg-yellow-500", "Galón": "bg-purple-500", "Otros": "bg-gray-500" };
  const totalVentas = Object.values(volumeCounts).reduce((sum, val) => sum + val, 0);

  Object.entries(volumeCounts).forEach(([volume, count]) => {
    const card = document.createElement("div");
    card.className = "bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center";
    const percentage = totalVentas > 0 ? ((count / totalVentas) * 100).toFixed(1) : 0;
    card.innerHTML = `
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">${volume}</p>
        <div class="${colors[volume]} text-white rounded-full w-16 h-16 mx-auto flex items-center justify-center text-xl font-bold mb-2">${count}</div>
        <p class="text-sm text-gray-600 dark:text-gray-300">${percentage}%</p>
    `;
    cardsContainer.appendChild(card);
  });
}

// === FUNCIONES DE ACCIÓN ===

async function hacerCorteDeCaja(serial) {
    if (!confirm(`¿Estás seguro de hacer el corte de caja para la máquina "${mapaNombreMaquina[serial]}"? Esta acción no se puede deshacer.`)) return;

    const { data: maquina } = await supabase.from('maquinas').select('ultimo_corte').eq('serial', serial).eq('user_id', user.id).single();
    const ultimaFecha = maquina.ultimo_corte || '2000-01-01T00:00:00Z';

    const { data: ventas } = await supabase.from('ventas').select('precio_total').eq('serial', serial).eq('user_id', user.id).gte('created_at', ultimaFecha);
    const total = (ventas || []).reduce((sum, v) => sum + parseFloat(v.precio_total), 0);

    const nuevoCorteISO = new Date().toISOString();
    const { error: updErr } = await supabase.from('maquinas').update({ ultimo_corte: nuevoCorteISO }).eq('serial', serial).eq('user_id', user.id);
    if (updErr) { alert('Error actualizando la fecha de corte.'); return; }

    const { error: corteErr } = await supabase.from('cortes').insert({ user_id: user.id, serial: serial, fecha_corte: nuevoCorteISO, total_ventas: total });
    if (corteErr) { alert('No se pudo registrar el corte de caja.'); return; }

    alert(`Corte realizado con éxito: $${total.toFixed(2)}`);
    
    // Refrescar las vistas relevantes
    await cargarTarjetasCorte();
    await actualizarDashboard();
}

async function descargarCSV() {
    const desde = document.getElementById("fechaDesde").value;
    const hasta = document.getElementById("fechaHasta").value;
    const serial = document.getElementById("filtroMaquinaCSV").value;

    if (!desde || !hasta) { alert("Por favor selecciona un rango de fechas"); return; }
    
    const desdeISO = new Date(desde).toISOString();
    const hastaISO = new Date(hasta + "T23:59:59").toISOString();

    let query = supabase.from("ventas").select("*").eq("user_id", user.id).gte("created_at", desdeISO).lte("created_at", hastaISO);
    if (serial) { query = query.eq("serial", serial); }

    const { data: ventas, error } = await query;
    if (error) { alert("Error al obtener datos: " + error.message); return; }

    let csv = "Fecha,Hora,Máquina,Litros,Precio Total,Tipo Dispositivo,Duración\n";
    ventas.forEach(v => {
        const fecha = new Date(v.created_at);
        csv += `${fecha.toLocaleDateString("es-MX")},${fecha.toLocaleTimeString("es-MX")},"${mapaNombreMaquina[v.serial] || v.serial}",${v.litros},${v.precio_total},${v.tipo_dispositivo || "N/A"},${v.duracion_segundos || "N/A"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `ventas_${desde}_a_${hasta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
