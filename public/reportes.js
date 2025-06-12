// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let mapaNombreMaquina = {};

// Inicialización
document.addEventListener('DOMContentLoaded', getUser);

async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert('No estás autenticado.');
    return;
  }
  user = currentUser;
  await cargarFiltros();
  setDefaultDates();
  cargarReportes();

  document.getElementById('btnAplicar').addEventListener('click', cargarReportes);
  document.getElementById('btnDescargarCortes').addEventListener('click', descargarCSV);
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  });
}

// Carga la lista de máquinas en el filtro
async function cargarFiltros() {
  const { data: maquinas, error } = await supabase
    .from('maquinas')
    .select('serial, nombre')
    .eq('user_id', user.id);
  if (error) { console.error(error); return; }

  const select = document.getElementById('maquinaFiltro');
  select.innerHTML = '<option value="">Todas</option>';

  maquinas.forEach(m => {
    mapaNombreMaquina[m.serial] = m.nombre || m.serial;
    const opt = document.createElement('option');
    opt.value = m.serial;
    opt.textContent = m.nombre || m.serial;
    select.appendChild(opt);
  });
}

// Fija fechas por defecto (inicio de mes - hoy)
function setDefaultDates() {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  document.getElementById('desde').value    = inicioMes.toISOString().split('T')[0];
  document.getElementById('hasta').value    = ahora.toISOString().split('T')[0];
}

// Orquesta la carga de todas las secciones
async function cargarReportes() {
  const desde  = document.getElementById('desde').value;
  const hasta  = document.getElementById('hasta').value;
  const serial = document.getElementById('maquinaFiltro').value;
  if (!desde || !hasta) return;

  await cargarKPIs(desde, hasta, serial);
  await cargarActividadUso(desde, hasta, serial); 
  await cargarGraficasVentas(desde, hasta, serial);
  await cargarGraficasVolumen(desde, hasta, serial);
  await cargarGraficaRanking(desde, hasta, serial);
  await cargarTablaCortes(desde, hasta, serial);
}

// KPIs principales
async function cargarKPIs(desde, hasta, serial) {
  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  // Ventas
  let ventasQ = supabase
    .from('ventas')
    .select('precio_total, litros')
    .eq('user_id', user.id)
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO);
  if (serial) ventasQ = ventasQ.eq('serial', serial);
  const { data: ventas, error: errV } = await ventasQ;
  if (errV) { console.error(errV); return; }

  const totalVentas = ventas.reduce((acc, v) => acc + parseFloat(v.precio_total), 0);
  const totalLitros = ventas.reduce((acc, v) => acc + parseFloat(v.litros), 0);
  const transacciones = ventas.length;
  const ticketProm   = transacciones ? totalVentas / transacciones : 0;
  const dias         = (new Date(hasta) - new Date(desde)) / 86400000 + 1;
  const promDiario   = dias > 0 ? totalVentas / dias : 0;

  // Cortes
  let cortesQ = supabase
    .from('cortes')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha_corte', desdeISO)
    .lte('fecha_corte', hastaISO);
  if (serial) cortesQ = cortesQ.eq('serial', serial);
  const { data: cortes } = await cortesQ;

  // Renderizar
  document.getElementById('kpiVentasTotales').textContent     = `$${totalVentas.toFixed(2)}`;
  document.getElementById('kpiLitros').textContent             = `${totalLitros.toFixed(1)} L`;
  document.getElementById('kpiTicket').textContent             = `$${ticketProm.toFixed(2)}`;
  document.getElementById('kpiTransacciones').textContent     = `${transacciones}`;
  document.getElementById('kpiCortes').textContent            = `${cortes.length}`;
  document.getElementById('kpiPromedioDiario').textContent     = `$${promDiario.toFixed(2)}`;
}

// Gráfica de ventas por día
async function cargarGraficasVentas(desde, hasta, serial) {
  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  let { data: ventas } = await supabase
    .from('ventas')
    .select('precio_total, created_at')
    .eq('user_id', user.id)
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO);
  if (serial) ventas = ventas.filter(v => v.serial === serial);

  const mapa = {};
  ventas.forEach(v => {
    const day = new Date(v.created_at).toLocaleDateString('es-MX');
    mapa[day] = (mapa[day] || 0) + parseFloat(v.precio_total);
  });

  const labels = Object.keys(mapa);
  const dataPts = labels.map(d => mapa[d]);

  const ctx = document.getElementById('graficaVentasTiempo');
  if (window.chartVentasTiempo) window.chartVentasTiempo.destroy();
  window.chartVentasTiempo = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Ventas ($)', data: dataPts }] }
  });
}

// Gráfica de volumen por día
async function cargarGraficasVolumen(desde, hasta, serial) {
  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  let { data: ventas } = await supabase
    .from('ventas')
    .select('litros, created_at')
    .eq('user_id', user.id)
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO);
  if (serial) ventas = ventas.filter(v => v.serial === serial);

  const mapa = {};
  ventas.forEach(v => {
    const day = new Date(v.created_at).toLocaleDateString('es-MX');
    mapa[day] = (mapa[day] || 0) + parseFloat(v.litros);
  });

  const labels = Object.keys(mapa);
  const dataPts = labels.map(d => mapa[d]);

  const ctx = document.getElementById('graficaVolumenTiempo');
  if (window.chartVolumenTiempo) window.chartVolumenTiempo.destroy();
  window.chartVolumenTiempo = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Litros vendidos', data: dataPts }] }
  });
}

// Ranking de máquinas por ventas
async function cargarGraficaRanking(desde, hasta, serial) {
  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  let { data: ventas } = await supabase
    .from('ventas')
    .select('serial, precio_total')
    .eq('user_id', user.id)
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO);
  if (serial) ventas = ventas.filter(v => v.serial === serial);

  const mapa = {};
  ventas.forEach(v => {
    mapa[v.serial] = (mapa[v.serial] || 0) + parseFloat(v.precio_total);
  });

  const labels = Object.keys(mapa).map(s => mapaNombreMaquina[s] || s);
  const dataPts = Object.values(mapa);

  const ctx = document.getElementById('graficaRankingMaquinas');
  if (window.chartRanking) window.chartRanking.destroy();
  window.chartRanking = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Ventas por máquina ($)', data: dataPts }] }
  });
}

// Historial de cortes con litros e intervalo
async function cargarTablaCortes(desde, hasta, serial) {
  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  let cortesQ = supabase
    .from('cortes')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha_corte', desdeISO)
    .lte('fecha_corte', hastaISO)
    .order('fecha_corte', { ascending: false });
  if (serial) cortesQ = cortesQ.eq('serial', serial);

  const { data: cortes, error } = await cortesQ;
  if (error) { console.error(error); return; }

  const tbody = document.getElementById('tablaCortes');
  tbody.innerHTML = '';

  for (let i = 0; i < cortes.length; i++) {
    const corte   = cortes[i];
    const prev    = cortes[i + 1];
    const current = new Date(corte.fecha_corte);

    // Intervalo
    let intervalo = '-';
    if (prev) {
      const diff = current - new Date(prev.fecha_corte);
      const dias = Math.floor(diff / 86400000);
      const horas = Math.floor((diff % 86400000) / 3600000);
      intervalo = `${dias}d ${horas}h`;
    }

    // Litros sumados entre cortes
    let litrosSum = '-';
    if (prev) {
      const { data: ventasC, error: errC } = await supabase
        .from('ventas')
        .select('litros')
        .eq('user_id', user.id)
        .eq('serial', corte.serial)
        .gte('created_at', prev.fecha_corte)
        .lt('created_at', corte.fecha_corte);
      litrosSum = errC ? '-' : ventasC.reduce((a, v) => a + parseFloat(v.litros), 0).toFixed(1);
    }

    const row = `<tr>
      <td class="px-4 py-2">${current.toLocaleString('es-MX')}</td>
      <td class="px-4 py-2">${mapaNombreMaquina[corte.serial] || corte.serial}</td>
      <td class="px-4 py-2">$${parseFloat(corte.total_ventas).toFixed(2)}</td>
      <td class="px-4 py-2">${litrosSum}</td>
      <td class="px-4 py-2">${intervalo}</td>
    </tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
  }
}

// Descarga CSV del historial de cortes
function descargarCSV() {
  const rows = Array.from(document.querySelectorAll('#tablaCortes tr'));
  let csv = 'Fecha,Máquina,Total Ventas,Litros,Intervalo\n';
  rows.forEach(tr => {
    const vals = Array.from(tr.children).map(td => td.textContent.replace(/\$/g, ''));
    csv += vals.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `cortes_${document.getElementById('desde').value}_${document.getElementById('hasta').value}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
// 3. Actividad y Uso
async function cargarActividadUso(desde, hasta, serial) {
  const desdeISO = new Date(desde).toISOString();
  const hastaISO = new Date(hasta + 'T23:59:59').toISOString();

  let { data: ventas } = await supabase
    .from('ventas')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO);
  if (serial) ventas = ventas.filter(v => v.serial === serial);

  // Número de ventas
  document.getElementById('kpiNumVentas').textContent = ventas.length;

  // Hora Pico
  const horas = {};
  ventas.forEach(v => {
    const h = new Date(v.created_at).getHours();
    horas[h] = (horas[h] || 0) + 1;
  });
  const pico = Object.entries(horas).sort((a,b) => b[1]-a[1])[0]?.[0] || 0;
  document.getElementById('kpiHoraPico').textContent = `${String(pico).padStart(2,'0')}:00`;

  // Intervalo Medio entre ventas (minutos)
  const tiempos = ventas.map(v => new Date(v.created_at).getTime()).sort();
  const diffs = tiempos.slice(1).map((t,i) => (t - tiempos[i]) / 60000);
  const promedio = diffs.length
    ? Math.round(diffs.reduce((a,b) => a + b, 0) / diffs.length)
    : 0;
  document.getElementById('kpiIntervaloMedio').textContent = `${promedio} min`;
}

