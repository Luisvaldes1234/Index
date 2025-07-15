// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


// Global state
let user = null;
let machines = [];
let sales = [];
let machineNameMap = {};

// --- INITIALIZATION ---

document.addEventListener("DOMContentLoaded", initializeDashboard);

async function initializeDashboard() {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();

    if (error || !currentUser) {
        alert("Authentication failed. Redirecting to login.");
        window.location.href = "/login.html";
        return;
    }
    user = currentUser;

    // Set default date filters
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById("fechaDesde").value = startOfMonth.toISOString().split("T")[0];
    document.getElementById("fechaHasta").value = now.toISOString().split("T")[0];

    // Add event listeners
    addEventListeners();

    // Initial data load
    await refreshAllData();
}

function addEventListeners() {
    document.getElementById("btnLogout").addEventListener("click", () => supabase.auth.signOut().then(() => window.location.href = "/login.html"));
    document.getElementById("btnDescargarCSV").addEventListener("click", downloadCSV);

    const filters = ["fechaDesde", "fechaHasta", "filtroMaquinaCSV"];
    filters.forEach(id => document.getElementById(id).addEventListener("change", refreshAllData));
}

// --- DATA FETCHING ---

async function refreshAllData() {
    const loadingDiv = document.getElementById("loading");
    loadingDiv.classList.remove("hidden");

    try {
        // Fetch all necessary data in parallel
        const machineDataPromise = supabase.from("maquinas").select("serial, nombre, ultimo_corte, last_seen").eq("user_id", user.id);
        const salesDataPromise = supabase.from("ventas").select("*").eq("user_id", user.id);

        const [{ data: machineList, error: machineError }, { data: salesList, error: salesError }] = await Promise.all([machineDataPromise, salesDataPromise]);

        if (machineError) throw machineError;
        if (salesError) throw salesError;

        machines = machineList || [];
        sales = salesList || [];

        // Create a map for easy name lookup
        machineNameMap = machines.reduce((map, m) => {
            map[m.serial] = m.nombre || m.serial;
            return map;
        }, {});

        // Render all components with the new data
        renderAllComponents();

    } catch (error) {
        console.error("Error refreshing data:", error);
        alert("Failed to load dashboard data: " + error.message);
    } finally {
        loadingDiv.classList.add("hidden");
    }
}

// --- RENDERING ---

function renderAllComponents() {
    const { fromDate, toDate, serial } = getFilters();
    const filteredSales = sales.filter(s => {
        const saleDate = new Date(s.created_at);
        const isAfterFrom = saleDate >= fromDate;
        const isBeforeTo = saleDate <= toDate;
        const matchesSerial = !serial || s.serial === serial;
        return isAfterFrom && isBeforeTo && matchesSerial;
    });

    renderMachineSelectors();
    renderCashOutList();
    renderKpis(sales); // KPIs might use all sales data, not just filtered
    renderMachineSummaries(sales);
    renderVolumeDistribution(filteredSales);
    renderAllCharts(filteredSales);
}

function renderMachineSelectors() {
    const select = document.getElementById("filtroMaquinaCSV");
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Machines</option>';
    machines.forEach(m => {
        const option = document.createElement("option");
        option.value = m.serial;
        option.textContent = machineNameMap[m.serial];
        select.appendChild(option);
    });
    select.value = currentVal;
}

function renderCashOutList() {
    const container = document.getElementById("listaMaquinasCorte");
    container.innerHTML = "";
    machines.forEach(m => {
        const lastCutoff = m.ultimo_corte || '2000-01-01T00:00:00Z';
        const salesSinceCutoff = sales
            .filter(s => s.serial === m.serial && new Date(s.created_at) > new Date(lastCutoff))
            .reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);

        let colorClass = "bg-yellow-400 text-black";
        if (salesSinceCutoff >= 500) colorClass = "bg-green-500 text-white";
        if (salesSinceCutoff >= 2000) colorClass = "bg-red-600 text-white";

        const div = document.createElement("div");
        div.className = "bg-white p-3 rounded shadow";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <p>💧 ${machineNameMap[m.serial]}</p>
                <button class="bg-blue-600 text-white px-3 py-1 rounded" onclick="handleCashOut('${m.serial}')">Corte de caja</button>
            </div>
            <div class="${colorClass} p-2 rounded text-center text-sm font-semibold">
                $${salesSinceCutoff.toFixed(2)} desde último corte
            </div>
        `;
        container.appendChild(div);
    });
}

function renderKpis(allSales) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const salesToday = allSales.filter(s => new Date(s.created_at) >= todayStart);
    const salesThisWeek = allSales.filter(s => new Date(s.created_at) >= weekStart);
    const salesThisMonth = allSales.filter(s => new Date(s.created_at) >= monthStart);

    const totalToday = salesToday.reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);
    const litersToday = salesToday.reduce((sum, s) => sum + parseFloat(s.litros || 0), 0);
    const totalWeek = salesThisWeek.reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);
    const totalMonth = salesThisMonth.reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);
    const avgTicketMonth = salesThisMonth.length > 0 ? totalMonth / salesThisMonth.length : 0;
    
    const activeMachines = machines.filter(m => (now - new Date(m.last_seen)) / 60000 < 10).length;

    const lastSale = allSales.length > 0 ? new Date(Math.max(...allSales.map(s => new Date(s.created_at)))).toLocaleString('es-MX') : "N/A";

    document.getElementById("litrosHoy").textContent = `${litersToday.toFixed(1)} L`;
    document.getElementById("ventasHoy").textContent = `$${totalToday.toFixed(2)}`;
    document.getElementById("ventasSemana").textContent = `$${totalWeek.toFixed(2)}`;
    document.getElementById("ventasMes").textContent = `$${totalMonth.toFixed(2)}`;
    document.getElementById("ticketPromedio").textContent = `$${avgTicketMonth.toFixed(2)}`;
    document.getElementById("maquinasActivas").textContent = `${activeMachines}/${machines.length}`;
    document.getElementById("ultimaVenta").textContent = lastSale;
}

function renderMachineSummaries(allSales) {
    const container = document.getElementById("resumenMaquinas");
    container.innerHTML = "";

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    machines.forEach(m => {
        const machineSales = allSales.filter(s => s.serial === m.serial);
        const totalToday = machineSales.filter(s => new Date(s.created_at) >= todayStart).reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);
        const totalWeek = machineSales.filter(s => new Date(s.created_at) >= weekStart).reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);
        const totalMonth = machineSales.filter(s => new Date(s.created_at) >= monthStart).reduce((sum, s) => sum + parseFloat(s.precio_total || 0), 0);

        const div = document.createElement('div');
        div.className = 'section-card';
        div.innerHTML = `
            <h3 class="text-lg font-bold text-blue-600 mb-3">${machineNameMap[m.serial]}</h3>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span>Hoy:</span> <span class="font-semibold">$${totalToday.toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Semana:</span> <span class="font-semibold">$${totalWeek.toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Mes:</span> <span class="font-semibold">$${totalMonth.toFixed(2)}</span></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderVolumeDistribution(filteredSales) {
    const container = document.getElementById("volumeDistribution");
    container.innerHTML = "";
    const volumeCounts = { "20L": 0, "10L": 0, "5L": 0, "Galón": 0, "Otros": 0 };
    filteredSales.forEach(v => {
        const liters = parseFloat(v.litros);
        if (liters === 20) volumeCounts["20L"]++;
        else if (liters === 10) volumeCounts["10L"]++;
        else if (liters === 5) volumeCounts["5L"]++;
        else if (liters === 3.785) volumeCounts["Galón"]++; // More precise value for gallon
        else volumeCounts["Otros"]++;
    });

    const totalCount = Object.values(volumeCounts).reduce((sum, count) => sum + count, 0);
    const colors = { "20L": "bg-blue-500", "10L": "bg-green-500", "5L": "bg-yellow-500", "Galón": "bg-purple-500", "Otros": "bg-gray-500" };

    for (const [volume, count] of Object.entries(volumeCounts)) {
        const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-lg shadow text-center";
        card.innerHTML = `
            <p class="text-gray-500 text-sm mb-2">${volume}</p>
            <div class="${colors[volume]} text-white rounded-full w-16 h-16 mx-auto flex items-center justify-center text-xl font-bold mb-2">${count}</div>
            <p class="text-sm text-gray-600">${percentage}%</p>
        `;
        container.appendChild(card);
    }
}

function renderAllCharts(filteredSales) {
    renderChart(filteredSales, 'graficaHoras', 'Ventas por Hora', 'hour');
    renderChart(filteredSales, 'graficaDias', 'Ventas por Día', 'day');
    renderChart(filteredSales, 'graficaVolumen', 'Litros por Máquina', 'volume');
    renderChart(filteredSales, 'graficaMaquinas', 'Ventas por Máquina', 'machine');
}

// --- CHART RENDERING ---

function renderChart(sales, canvasId, title, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window[canvasId]) {
        window[canvasId].destroy();
    }

    let chartData;
    let chartType = 'bar';

    switch (type) {
        case 'hour':
            chartData = processDataForChart(sales, s => new Date(s.created_at).getHours(), 24, h => `${h}:00`);
            break;
        case 'day':
            chartData = processDataForChart(sales, s => new Date(s.created_at).toLocaleDateString('es-MX'), -1, l => l, (a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
            chartType = 'line';
            break;
        case 'volume':
            chartData = processDataForChart(sales, s => s.serial, -1, s => machineNameMap[s], null, 'litros');
            break;
        case 'machine':
            chartData = processDataForChart(sales, s => s.serial, -1, s => machineNameMap[s]);
            break;
    }

    window[canvasId] = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' }, title: { display: true, text: title } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function processDataForChart(sales, keyExtractor, labelCount, labelFormatter, sortFn, valueField = 'precio_total') {
    const dataMap = {};
    const uniqueSerials = [...new Set(sales.map(s => s.serial))];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    sales.forEach(sale => {
        const key = keyExtractor(sale);
        if (!dataMap[key]) dataMap[key] = {};
        dataMap[key][sale.serial] = (dataMap[key][sale.serial] || 0) + parseFloat(sale[valueField] || 0);
    });
    
    let labels = labelCount === -1 ? Object.keys(dataMap) : [...Array(labelCount).keys()];
    if(sortFn) labels.sort(sortFn);

    const datasets = uniqueSerials.map((serial, index) => ({
        label: machineNameMap[serial],
        data: labels.map(label => (dataMap[label] && dataMap[label][serial]) || 0),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        fill: false,
        tension: 0.1
    }));
    
    return { labels: labels.map(labelFormatter), datasets };
}


// --- ACTIONS ---

async function handleCashOut(serial) {
    if (!confirm(`Are you sure you want to process the cash out for ${machineNameMap[serial]}?`)) return;

    try {
        const { data: machine, error: machineError } = await supabase.from('maquinas').select('ultimo_corte').eq('serial', serial).single();
        if (machineError) throw machineError;

        const lastCutoff = machine.ultimo_corte || '2000-01-01T00:00:00Z';
        const { data: salesToSum, error: salesError } = await supabase.from('ventas').select('precio_total').eq('serial', serial).gte('created_at', lastCutoff);
        if (salesError) throw salesError;
        
        const total = salesToSum.reduce((sum, v) => sum + parseFloat(v.precio_total), 0);
        const newCutoffTime = new Date().toISOString();

        const { error: updateError } = await supabase.from('maquinas').update({ ultimo_corte: newCutoffTime }).eq('serial', serial);
        if (updateError) throw updateError;

        const { error: insertError } = await supabase.from('cortes').insert({ user_id: user.id, serial: serial, fecha_corte: newCutoffTime, total_ventas: total });
        if (insertError) throw insertError;

        alert(`Cash out successful: $${total.toFixed(2)}`);
        await refreshAllData();

    } catch (error) {
        console.error("Error during cash out:", error);
        alert("Failed to process cash out: " + error.message);
    }
}

async function downloadCSV() {
    const { fromDate, toDate, serial } = getFilters();
    const { data: salesData, error } = await supabase
        .from("ventas")
        .select("*")
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString())
        .eq(serial ? 'serial' : 'user_id', serial || user.id);

    if (error) return alert("Error fetching data for CSV: " + error.message);

    let csv = "Fecha,Hora,Máquina,Litros,Precio Total,Tipo Dispositivo,Duración\n";
    salesData.forEach(v => {
        const date = new Date(v.created_at);
        csv += `${date.toLocaleDateString("es-MX")},`;
        csv += `${date.toLocaleTimeString("es-MX")},`;
        csv += `${machineNameMap[v.serial] || v.serial},`;
        csv += `${v.litros || 'N/A'},`;
        csv += `${v.precio_total || 0},`;
        csv += `${v.tipo_dispositivo || "N/A"},`;
        csv += `${v.duracion_segundos || "N/A"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${fromDate.toISOString().split('T')[0]}_to_${toDate.toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

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
