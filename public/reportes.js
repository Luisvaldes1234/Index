// =================================================================================
// reportes.js - v4 (Gráficas Avanzadas y Funciones Restauradas)
// =================================================================================

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- VARIABLES GLOBALES ---
let user = null;
let allUserMachines = []; // Almacena TODAS las máquinas del usuario para evitar re-consultas
let charts = {}; // Para gestionar las instancias de las gráficas
let lastReportData = {}; // Caché de los últimos datos cargados para la calculadora de utilidad

// --- PUNTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', initializePage);


// --- 2. SETUP INICIAL DE LA PÁGINA ---
async function initializePage() {
    setupNavigation();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        alert('No estás autenticado. Redirigiendo a login...');
        window.location.href = '/login.html';
        return;
    }
    user = session.user;
    
    await loadAllUserMachines(); // Carga datos maestros de máquinas una sola vez
    renderMachineFilters(); // Llena el dropdown de filtros
    renderOperationalStatus(); // Renderiza KPIs que no dependen de la fecha
    
    setDefaultDates();
    setupEventListeners();
    
    await loadReports(); // Carga los reportes de ventas iniciales
}

function setupNavigation() {
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const toggleMobileNav = () => {
        hamburger.classList.toggle('active');
        mobileNav.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
    };
    hamburger.addEventListener('click', toggleMobileNav);
    mobileOverlay.addEventListener('click', toggleMobileNav);
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    };
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    document.getElementById('btnLogoutMobile').addEventListener('click', handleLogout);
}

function setupEventListeners() {
    document.getElementById('btnAplicar').addEventListener('click', loadReports);
    document.getElementById('btnCalcularUtilidad').addEventListener('click', renderUtilityCalculator);
}

function setDefaultDates() {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    document.getElementById('desde').value = inicioMes.toISOString().split('T')[0];
    document.getElementById('hasta').value = ahora.toISOString().split('T')[0];
}

async function loadAllUserMachines() {
    const { data, error } = await supabase
        .from('maquinas')
        .select('serial, nombre, suscripcion_hasta, last_seen')
        .eq('user_id', user.id);

    if (error) {
        console.error('Error crítico cargando máquinas:', error);
        allUserMachines = [];
        return;
    }
    allUserMachines = data || [];
}

function renderMachineFilters() {
    const select = document.getElementById('maquinaFiltro');
    select.innerHTML = '<option value="">Todas</option>';
    allUserMachines.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.serial;
        opt.textContent = m.nombre || m.serial;
        select.appendChild(opt);
    });
}


// --- 3. LÓGICA PRINCIPAL DE CARGA Y PROCESAMIENTO ---
async function loadReports() {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('report-content');
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    
    try {
        const filters = {
            desde: document.getElementById('desde').value,
            hasta: document.getElementById('hasta').value,
            serial: document.getElementById('maquinaFiltro').value,
        };
        if (!filters.desde || !filters.hasta) throw new Error("Fechas no válidas");
        
        const reportData = await fetchReportData(filters);
        lastReportData = reportData; // Guardar datos para re-uso en la calculadora
        
        renderAllSections(reportData, filters);

    } catch (error) {
        console.error('Error general al cargar reportes:', error);
        alert('No se pudieron cargar los reportes. Revise la consola para más detalles.');
    } finally {
        loadingEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
    }
}

async function fetchReportData(filters) {
    const now = new Date();
    const activeSerials = allUserMachines
        .filter(m => m.suscripcion_hasta && new Date(m.suscripcion_hasta) > now)
        .map(m => m.serial);

    if (activeSerials.length === 0) {
        alert("No tienes máquinas con suscripción activa para mostrar reportes.");
        return { current: { sales: [] }, previous: { sales: [] } };
    }

    const previousPeriod = getPreviousPeriod(filters.desde, filters.hasta);

    const fetchDataForPeriod = async (start, end) => {
        const from = new Date(start + 'T00:00:00Z').toISOString();
        const to = new Date(end + 'T23:59:59Z').toISOString();
        
        let salesQuery = supabase.from('ventas').select('serial, precio_total, litros, created_at').eq('user_id', user.id).in('serial', activeSerials).gte('created_at', from).lte('created_at', to);
        if (filters.serial && activeSerials.includes(filters.serial)) {
            salesQuery = salesQuery.eq('serial', filters.serial);
        }
        const { data: sales, error } = await salesQuery;
        if(error) throw error;
        return sales || [];
    };

    const [currentSales, previousSales] = await Promise.all([
        fetchDataForPeriod(filters.desde, filters.hasta),
        fetchDataForPeriod(previousPeriod.start, previousPeriod.end)
    ]);

    return { current: { sales: currentSales }, previous: { sales: previousSales } };
}


// --- 4. FUNCIONES DE RENDERIZADO ---

function renderAllSections({ current, previous }, filters) {
    const currentTotals = processSalesData(current.sales);
    const previousTotals = processSalesData(previous.sales);

    renderKPIs(currentTotals, previousTotals, filters);
    renderActivityKPIs(current.sales);
    renderAdvancedCharts(current.sales);
    renderUtilityCalculator();
}

function renderOperationalStatus() {
    const now = new Date();
    
    const onlineMachines = allUserMachines.filter(m => {
        const lastSeen = m.last_seen ? new Date(m.last_seen) : null;
        if (!lastSeen) return false;
        const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
        return diffMinutes < 10;
    }).length;
    document.getElementById('kpiMaquinasOnline').textContent = `${onlineMachines} / ${allUserMachines.length}`;

    const activeSubscriptions = allUserMachines.filter(m => m.suscripcion_hasta && new Date(m.suscripcion_hasta) > now).length;
    document.getElementById('kpiSuscripcionesActivas').textContent = `${activeSubscriptions} / ${allUserMachines.length}`;
}

function renderKPIs(current, previous, filters) {
    const { totalSales, totalLiters, transactionCount } = current;
    const ticketProm = transactionCount > 0 ? totalSales / transactionCount : 0;
    const dias = (new Date(filters.hasta) - new Date(filters.desde)) / 86400000 + 1;
    const promDiario = dias > 0 ? totalSales / dias : 0;

    document.getElementById('kpiVentasTotales').textContent = `$${totalSales.toFixed(2)}`;
    document.getElementById('kpiLitros').textContent = `${totalLiters.toFixed(1)} L`;
    document.getElementById('kpiTransacciones').textContent = transactionCount;
    document.getElementById('kpiTicket').textContent = `$${ticketProm.toFixed(2)}`;
    document.getElementById('kpiPromedioDiario').textContent = `$${promDiario.toFixed(2)}`;

    renderComparison(totalSales, previous.totalSales, 'kpiVentasTotales_comp');
    renderComparison(totalLiters, previous.totalLiters, 'kpiLitros_comp');
    renderComparison(transactionCount, previous.transactionCount, 'kpiTransacciones_comp');
}

function renderActivityKPIs(sales) {
    if (sales.length === 0) {
        document.getElementById('kpiHoraPico').textContent = '--:--';
        document.getElementById('kpiDiaFuerte').textContent = '---';
        return;
    }
    // Hora Pico
    const hours = sales.map(v => new Date(v.created_at).getHours());
    const hourCounts = hours.reduce((acc, hour) => { acc[hour] = (acc[hour] || 0) + 1; return acc; }, {});
    const peakHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b);
    document.getElementById('kpiHoraPico').textContent = `${peakHour.toString().padStart(2, '0')}:00`;

    // Día más fuerte
    const days = sales.map(v => new Date(v.created_at).getDay()); // 0=Domingo, 1=Lunes...
    const dayCounts = days.reduce((acc, day) => { acc[day] = (acc[day] || 0) + 1; return acc; }, {});
    const busiestDayIndex = Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b);
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    document.getElementById('kpiDiaFuerte').textContent = dayNames[busiestDayIndex];
}

function renderUtilityCalculator() {
    const sales = lastReportData.current?.sales || [];
    const costPerM3 = parseFloat(document.getElementById('costoMetro').value) || 0;
    const opEx = parseFloat(document.getElementById('gastosOperativos').value) || 0;
    
    const { totalSales, totalLiters } = processSalesData(sales);
    const waterCost = (costPerM3 / 1000) * totalLiters;
    const utility = totalSales - (waterCost + opEx);

    document.getElementById('volumenCostes').innerHTML = `
        <div class="kpi-card"><p class="kpi-label">Ingresos Totales</p><h3 class="kpi-value">$${totalSales.toFixed(2)}</h3></div>
        <div class="kpi-card"><p class="kpi-label">Coste de Agua Total</p><h3 class="kpi-value">$${waterCost.toFixed(2)}</h3></div>
        <div class="kpi-card"><p class="kpi-label">Utilidad Estimada</p><h3 class="kpi-value text-green-600">$${utility.toFixed(2)}</h3></div>
    `;
}

function renderAdvancedCharts(sales) {
    const machineNameMap = new Map(allUserMachines.map(m => [m.serial, m.nombre || m.serial]));
    const colorPalette = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const machineColors = {};
    let colorIndex = 0;

    const dailyData = {};
    sales.forEach(v => {
        const dayKey = new Date(v.created_at).toISOString().split('T')[0];
        if (!dailyData[dayKey]) dailyData[dayKey] = { totalSales: 0, totalLiters: 0, salesByMachine: {}, litersByMachine: {} };
        dailyData[dayKey].totalSales += parseFloat(v.precio_total) || 0;
        dailyData[dayKey].totalLiters += parseFloat(v.litros) || 0;
        dailyData[dayKey].salesByMachine[v.serial] = (dailyData[dayKey].salesByMachine[v.serial] || 0) + (parseFloat(v.precio_total) || 0);
        dailyData[dayKey].litersByMachine[v.serial] = (dailyData[dayKey].litersByMachine[v.serial] || 0) + (parseFloat(v.litros) || 0);
    });

    const sortedDays = Object.keys(dailyData).sort();
    const chartLabels = sortedDays.map(day => new Date(day + "T12:00:00Z"));

    const uniqueMachineSerials = [...new Set(sales.map(s => s.serial))];
    uniqueMachineSerials.forEach(serial => {
        machineColors[serial] = colorPalette[colorIndex++ % colorPalette.length];
    });

    // Datasets para gráfica de ventas (multi-línea)
    const salesDatasets = [{
        label: 'Ventas Totales', data: sortedDays.map(day => dailyData[day].totalSales),
        borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.1, borderWidth: 3, order: 0
    }];
    uniqueMachineSerials.forEach(serial => {
        salesDatasets.push({
            label: machineNameMap.get(serial) || serial,
            data: sortedDays.map(day => (dailyData[day].salesByMachine[serial] || 0)),
            borderColor: machineColors[serial], backgroundColor: machineColors[serial],
            tension: 0.1, borderWidth: 1.5, order: 1
        });
    });

    // Datasets para gráfica de volumen (barras apiladas)
    const volumeDatasets = uniqueMachineSerials.map(serial => ({
        label: machineNameMap.get(serial) || serial,
        data: sortedDays.map(day => (dailyData[day].litersByMachine[serial] || 0)),
        backgroundColor: machineColors[serial]
    }));
    
    updateChart('graficaVentasTiempo', 'line', chartLabels, salesDatasets);
    updateChart('graficaVolumenTiempo', 'bar', chartLabels, volumeDatasets, { scales: { x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'dd-MMM' }}, stacked: true }, y: { stacked: true } } });
}

// --- 5. FUNCIONES DE AYUDA (Helpers) ---
function getPreviousPeriod(startDate, endDate) {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');
    const duration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { start: previousStart.toISOString().split('T')[0], end: previousEnd.toISOString().split('T')[0] };
}

function renderComparison(current, previous, elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    if (previous === 0) {
        element.textContent = current > 0 ? '(∞)' : '';
        element.style.color = '#3b82f6';
        return;
    }
    const change = ((current - previous) / previous) * 100;
    element.textContent = `(${change > 0 ? '+' : ''}${change.toFixed(1)}%)`;
    element.style.color = change >= 0 ? '#10b981' : '#ef4444';
}

function updateChart(canvasId, type, labels, datasets, extraOptions = {}) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: { labels, datasets },
        options: { responsive: true, maintainAspectRatio: false, ...extraOptions }
    });
}

function processSalesData(sales) {
    if (!sales || sales.length === 0) return { totalSales: 0, totalLiters: 0, transactionCount: 0 };
    const totalSales = sales.reduce((sum, v) => sum + (parseFloat(v.precio_total) || 0), 0);
    const totalLiters = sales.reduce((sum, v) => sum + (parseFloat(v.litros) || 0), 0);
    return { totalSales, totalLiters, transactionCount: sales.length };
}

// Estas funciones de setup y la inicialización global deben estar al principio del archivo.
// Asegúrate de que no haya duplicados si copias y pegas en un archivo existente.
