// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let mapaNombreMaquina = {};

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error || !currentUser) {
        window.location.href = "/login.html";
        return;
    }
    user = currentUser;

    // Configurar fechas por defecto
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    document.getElementById("fechaDesde").value = inicioMes.toISOString().split("T")[0];
    document.getElementById("fechaHasta").value = ahora.toISOString().split("T")[0];

    // Cargar todos los datos
    await cargarDatosIniciales();

    // Configurar eventos
    configurarEventos();
});

// === CARGA DE DATOS PRINCIPAL ===
async function cargarDatosIniciales() {
    const loadingSpinner = document.getElementById('loading');
    loadingSpinner.classList.remove('hidden');

    await cargarMaquinasYVentas();
    await cargarResumen();
    await cargarGraficas();
    await cargarDistribucionVolumen();

    loadingSpinner.classList.add('hidden');
}

// === LÓGICA DE CARGA DE DATOS Y RENDERIZACIÓN ===

/**
 * CORRECCIÓN: N+1 Query.
 * Esta función ahora carga las máquinas y las ventas pendientes de corte en solo dos consultas
 * a la base de datos, en lugar de una por cada máquina. Esto mejora drásticamente el rendimiento.
 */
async function cargarMaquinasYVentas() {
    const select = document.getElementById("filtroMaquinaCSV");
    const contenedor = document.getElementById("listaMaquinasCorte");
    select.innerHTML = '<option value="">Todas las máquinas</option>';
    contenedor.innerHTML = "";
    mapaNombreMaquina = {};

    // 1. Obtener todas las máquinas y todas las ventas a la vez
    const { data: maquinas } = await supabase.from("maquinas").select("serial, nombre, ultimo_corte").eq("user_id", user.id);
    const { data: ventas } = await supabase.from("ventas").select("serial, precio_total, created_at").eq("user_id", user.id);

    // 2. Procesar los datos en JavaScript
    for (const m of maquinas) {
        mapaNombreMaquina[m.serial] = m.nombre || m.serial;

        // Poblar el dropdown de filtros
        const op = document.createElement("option");
        op.value = m.serial;
        op.textContent = m.nombre || m.serial;
        select.appendChild(op);

        // Filtrar ventas para esta máquina que son posteriores al último corte
        const ultimoCorte = m.ultimo_corte || "2000-01-01T00:00:00Z";
        const ventasPendientes = ventas.filter(v => v.serial === m.serial && new Date(v.created_at) > new Date(ultimoCorte));
        const totalPendiente = ventasPendientes.reduce((sum, v) => sum + parseFloat(v.precio_total || 0), 0);

        // Renderizar la tarjeta para el corte de caja
        renderTarjetaDeCorte(m, totalPendiente, contenedor);
    }
}

function renderTarjetaDeCorte(maquina, total, contenedor) {
    let color = "bg-yellow-400 text-black";
    if (total >= 500) color = "bg-green-500 text-white";
    if (total >= 2000) color = "bg-red-600 text-white";

    const div = document.createElement("div");
    div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow";
    div.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <p>💧 ${maquina.nombre || maquina.serial}</p>
            <button class="bg-blue-600 text-white px-3 py-1 rounded" onclick="hacerCorteDeCaja('${maquina.serial}')">Corte de caja</button>
        </div>
        <div class="${color} p-2 rounded text-center text-sm font-semibold">
            $${total.toFixed(2)} desde último corte
        </div>
    `;
    contenedor.appendChild(div);
}

async function hacerCorteDeCaja(serial) {
    if (!confirm("¿Estás seguro de hacer el corte de caja? Esta acción no se puede deshacer.")) return;

    const { data: maquina } = await supabase.from('maquinas').select('ultimo_corte').eq('serial', serial).eq('user_id', user.id).single();
    const ultimaFecha = maquina.ultimo_corte || '2000-01-01T00:00:00Z';

    const { data: ventas } = await supabase.from('ventas').select('precio_total').eq('serial', serial).eq('user_id', user.id).gte('created_at', ultimaFecha);
    const total = ventas.reduce((sum, v) => sum + parseFloat(v.precio_total), 0);

    const nuevoCorteISO = new Date().toISOString();
    await supabase.from('maquinas').update({ ultimo_corte: nuevoCorteISO }).eq('serial', serial).eq('user_id', user.id);

    await supabase.from('cortes').insert({ user_id: user.id, serial: serial, fecha_corte: nuevoCorteISO, total_ventas: total });

    alert(`Corte realizado: $${total.toFixed(2)} en ventas.`);
    cargarDatosIniciales(); // Recargar toda la data del dashboard
}

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
    });
}
function renderResumen(r) {
    document.getElementById("litrosHoy").textContent = `${r.litrosHoy.toFixed(1)} L`;
    document.getElementById("ventasHoy").textContent = `$${r.totalHoy.toFixed(2)}`;
    document.getElementById("ticketPromedio").textContent = `$${r.ticketMes.toFixed(2)}`;
    document.getElementById("maquinasActivas").textContent = `${r.activas}/${r.cantidad}`;
    document.getElementById("ultimaVenta").textContent = r.ultimaVenta ? new Date(r.ultimaVenta).toLocaleString("es-MX") : "N/A";
    document.getElementById("ventasSemana").textContent = `$${r.totalSemana.toFixed(2)}`;
    document.getElementById("ventasMes").textContent = `$${r.totalMes.toFixed(2)}`;
}

function renderResumenPorMaquina(r, contenedor) {
    const div = document.createElement('div');
    div.className = 'section-card p-4'; // Clases simplificadas
    div.innerHTML = `
        <h3 class="text-lg font-bold text-blue-600 mb-3">${r.nombre}</h3>
        <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span>Hoy:</span> <span class="font-semibold">$${r.totalHoy.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Semana:</span> <span class="font-semibold">$${r.totalSemana.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Mes:</span> <span class="font-semibold">$${r.totalMes.toFixed(2)}</span></div>
        </div>
    `;
    contenedor.appendChild(div);
}

async function cargarDistribucionVolumen() {
    const { desdeISO, hastaISO, serial } = obtenerFiltros();
    if (!desdeISO || !hastaISO) return;

    let query = supabase.from("ventas").select("litros").eq("user_id", user.id).gte("created_at", desdeISO).lte("created_at", hastaISO);
    if (serial) query = query.eq("serial", serial);
    
    const { data: ventas } = await query;
    if (!ventas) return;

    const volumeCounts = { "20L": 0, "10L": 0, "5L": 0, "Galón": 0, "Otros": 0 };
    ventas.forEach(v => {
        const litros = parseFloat(v.litros);
        if (litros === 20) volumeCounts["20L"]++;
        else if (litros === 10) volumeCounts["10L"]++;
        else if (litros === 5) volumeCounts["5L"]++;
        else if (litros === 3.785) volumeCounts["Galón"]++; // Valor más preciso para galón
        else volumeCounts["Otros"]++;
    });
    renderVolumeCards(volumeCounts);
}

function renderVolumeCards(volumeCounts) {
    const container = document.getElementById("volumeDistribution");
    container.innerHTML = ""; // Limpiar antes de renderizar
    const colors = { "20L": "bg-blue-500", "10L": "bg-green-500", "5L": "bg-yellow-500", "Galón": "bg-purple-500", "Otros": "bg-gray-500" };
    const totalVentas = Object.values(volumeCounts).reduce((s, c) => s + c, 0);

    for (const [volume, count] of Object.entries(volumeCounts)) {
        const percentage = totalVentas > 0 ? ((count / totalVentas) * 100).toFixed(1) : 0;
        container.innerHTML += `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center">
                <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">${volume}</p>
                <div class="${colors[volume]} text-white rounded-full w-16 h-16 mx-auto flex items-center justify-center text-xl font-bold mb-2">${count}</div>
                <p class="text-sm text-gray-600 dark:text-gray-300">${percentage}%</p>
            </div>
        `;
    }
}

// === LÓGICA DE GRÁFICAS ===

async function cargarGraficas() {
    const { desdeISO, hastaISO, serial } = obtenerFiltros();
    if (!desdeISO || !hastaISO) return;

    let query = supabase.from("ventas").select("*").eq("user_id", user.id).gte("created_at", desdeISO).lte("created_at", hastaISO);
    const { data: ventas } = await query;
    if (!ventas) return;
    
    const filtradas = serial ? ventas.filter(v => v.serial === serial) : ventas;
    
    renderGraficaHoras(filtradas);
    renderGraficaDias(filtradas);
    renderGraficaVolumen(filtradas);
    renderGraficaMaquinas(filtradas);
}

function renderGraficaHoras(ventas) {
    const ctx = document.getElementById("graficaHoras").getContext('2d');
    if (window.chartHoras) window.chartHoras.destroy();

    const dataPorHora = Array(24).fill(0);
    ventas.forEach(v => {
        const hora = new Date(v.created_at).getHours();
        dataPorHora[hora] += parseFloat(v.precio_total || 0);
    });

    window.chartHoras = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [...Array(24).keys()].map(h => `${h}:00`),
            datasets: [{
                label: 'Ventas por Hora ($)',
                data: dataPorHora,
                backgroundColor: '#3b82f6'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderGraficaDias(ventas) {
    const ctx = document.getElementById("graficaDias").getContext('2d');
    if (window.chartDias) window.chartDias.destroy();

    const ventasPorDia = {};
    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString("es-MX");
        ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + parseFloat(v.precio_total || 0);
    });

    window.chartDias = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(ventasPorDia),
            datasets: [{
                label: 'Ventas por Día ($)',
                data: Object.values(ventasPorDia),
                borderColor: '#10b981',
                tension: 0.1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderGraficaVolumen(ventas) {
    const ctx = document.getElementById("graficaVolumen").getContext('2d');
    if (window.chartVolumen) window.chartVolumen.destroy();

    const mapa = {};
    ventas.forEach(v => {
        mapa[mapaNombreMaquina[v.serial] || v.serial] = (mapa[mapaNombreMaquina[v.serial] || v.serial] || 0) + parseFloat(v.litros || 0);
    });
    
    window.chartVolumen = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(mapa),
            datasets: [{ label: "Litros vendidos por máquina", data: Object.values(mapa), backgroundColor: "#10b981" }]
        }
    });
}

function renderGraficaMaquinas(ventas) {
    const ctx = document.getElementById("graficaMaquinas").getContext('2d');
    if (window.chartMaquinas) window.chartMaquinas.destroy();

    const mapa = {};
    ventas.forEach(v => {
        mapa[mapaNombreMaquina[v.serial] || v.serial] = (mapa[mapaNombreMaquina[v.serial] || v.serial] || 0) + parseFloat(v.precio_total || 0);
    });
    
    window.chartMaquinas = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(mapa),
            datasets: [{ label: "Ventas por máquina ($)", data: Object.values(mapa), backgroundColor: "#f59e0b" }]
        }
    });
}

// === EVENTOS Y UTILIDADES ===

function configurarEventos() {
    // CORRECCIÓN: Script del menú de hamburguesa movido aquí desde el HTML.
    const hamburgerButton = document.getElementById('hamburgerMenu');
    const mainNavMenu = document.getElementById('mainNavMenu');
    if (hamburgerButton && mainNavMenu) {
        hamburgerButton.addEventListener('click', () => {
            hamburgerButton.classList.toggle('active');
            mainNavMenu.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!hamburgerButton.contains(e.target) && !mainNavMenu.contains(e.target)) {
                hamburgerButton.classList.remove('active');
                mainNavMenu.classList.remove('active');
            }
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                hamburgerButton.classList.remove('active');
                mainNavMenu.classList.remove('active');
            }
        });
    }

    // Eventos de filtros
    document.getElementById('fechaDesde').addEventListener('change', cargarDatosIniciales);
    document.getElementById('fechaHasta').addEventListener('change', cargarDatosIniciales);
    document.getElementById('filtroMaquinaCSV').addEventListener('change', () => {
        cargarGraficas();
        cargarDistribucionVolumen();
    });

    // Descarga CSV
    document.getElementById("btnDescargarCSV").addEventListener("click", descargarCSV);
    
    // Logout
    document.getElementById("btnLogout").addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
    });
}

async function descargarCSV() {
    const { desdeISO, hastaISO, serial } = obtenerFiltros();
    if (!desdeISO || !hastaISO) {
        alert("Por favor selecciona un rango de fechas");
        return;
    }

    let query = supabase.from("ventas").select("*").gte("created_at", desdeISO).lte("created_at", hastaISO);
    if (serial) query = query.eq("serial", serial);
    
    const { data: ventas, error } = await query;
    if (error) { alert("Error al obtener datos: " + error.message); return; }

    let csv = "Fecha,Hora,Máquina,Litros,Precio Total,Tipo Dispositivo,Duración\n";
    ventas.forEach(v => {
        const fecha = new Date(v.created_at);
        csv += `${fecha.toLocaleDateString("es-MX")},${fecha.toLocaleTimeString("es-MX")},${mapaNombreMaquina[v.serial] || v.serial},${v.litros},${v.precio_total},${v.tipo_dispositivo || "N/A"},${v.duracion_segundos || "N/A"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `ventas_${document.getElementById("fechaDesde").value}_a_${document.getElementById("fechaHasta").value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function obtenerFiltros() {
    const desde = document.getElementById("fechaDesde").value;
    const hasta = document.getElementById("fechaHasta").value;
    return {
        desdeISO: desde ? new Date(desde).toISOString() : null,
        hastaISO: hasta ? new Date(hasta + "T23:59:59").toISOString() : null,
        serial: document.getElementById("filtroMaquinaCSV").value,
    };
}
