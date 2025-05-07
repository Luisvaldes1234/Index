// === Inicializar Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Estado global
let ventasActuales = [];
let chartVolumenes, chartLitros, chartVentasDiarias, chartTipoVolumen;

// === DOMContentLoaded ===
document.addEventListener('DOMContentLoaded', async () => {
  // Botones
  document.getElementById('btnAplicar').onclick    = actualizarResumen;
  document.getElementById('btnExportar').onclick   = exportarCSV;
  document.getElementById('btnToggleDark').onclick = () => document.documentElement.classList.toggle('dark');

  // Autenticación
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = 'login.html';

  // Fechas por defecto
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById('fechaInicioResumen').value = inicioMes.toISOString().split('T')[0];
  document.getElementById('fechaFinResumen').value    = hoy.toISOString().split('T')[0];

  // Cargar máquinas en el select
  const { data: maquinas, error } = await supabase
    .from('maquinas').select('id, nombre').eq('usuario_id', user.id);
  if (error) console.error(error.message);
  else {
    const sel = document.getElementById('filtroMaquina');
    maquinas.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nombre || `Máquina ${m.id}`;
      sel.appendChild(opt);
    });
  }

  // Inicializar gráficas vacías
  initCharts();

  // Primero resumen
  actualizarResumen();
});

function initCharts() {
  const opts = { responsive:true, plugins:{ legend:{ display:false } } };

  // Top 3 ingresos
  chartVolumenes = new Chart(
    document.getElementById('graficaVolumenes').getContext('2d'),
    { type:'bar', data:{ labels:[], datasets:[{label:'Ingresos',data:[],backgroundColor:'rgba(54,162,235,0.6)'}] }, options:{
        ...opts,
        plugins:{ ...opts.plugins, datalabels:{ anchor:'end', align:'top', formatter:v=>`$${v.toFixed(2)}`, color:'#111', font:{ weight:'bold'} } },
        title:{ display:true, text:'Top 3 Máquinas por Ingreso' }
      }
    }
  );

  // Litros por máquina
  chartLitros = new Chart(
    document.getElementById('graficaLitros').getContext('2d'),
    { type:'bar', data:{ labels:[], datasets:[{label:'Litros',data:[],backgroundColor:'rgba(75,192,192,0.6)'}] }, options:{
        ...opts, title:{ display:true, text:'Litros por Máquina' }
      }
    }
  );

  // Ventas diarias
  chartVentasDiarias = new Chart(
    document.getElementById('graficaVentasDiarias').getContext('2d'),
    { type:'line', data:{ labels:[], datasets:[{label:'Total diario',data:[],fill:false,borderWidth:2}] }, options:{
        ...opts, title:{ display:true, text:'Tendencia de Ventas Diarias' }
      }
    }
  );

  // Distribución volumen
  chartTipoVolumen = new Chart(
    document.getElementById('graficaTipoVolumen').getContext('2d'),
    { type:'pie', data:{ labels:[], datasets:[{data:[],backgroundColor:['#3b82f6','#10b981','#f59e0b','#ef4444']} ] }, options:{
        ...opts, title:{ display:true, text:'Distribución de Litros por Máquina' }
      }
    }
  );
}

async function actualizarResumen() {
  // Leer filtros
  const userRes = await supabase.auth.getUser();
  if (!userRes.data.user) return;
  const uid = userRes.data.user.id;
  const maquina = document.getElementById('filtroMaquina').value;
  const desde  = document.getElementById('fechaInicioResumen').value;
  const hasta  = document.getElementById('fechaFinResumen').value;

  // Query
  let q = supabase
    .from('ventas').select('*')
    .eq('usuario_id', uid)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (maquina!=='todas') q = q.eq('maquina_id', maquina);

  const { data: ventas, error } = await q;
  if (error) return console.error(error.message);

  ventasActuales = ventas;

  // Ocultar/mensaje si no hay datos
  document.getElementById('mensajeSinVentas').classList.toggle('hidden', ventas.length>0);

  // KPIs
  const totalIngresos = ventas.reduce((sum,v)=> sum + (v.total||0), 0);
  const totalLitros   = ventas.reduce((sum,v)=> sum + (v.litros||0), 0);
  const ticketProm    = ventas.length ? totalIngresos/ventas.length : 0;

  document.getElementById('ventasTotales').textContent  = `$${totalIngresos.toFixed(2)}`;
  document.getElementById('litrosTotales').textContent  = `${totalLitros} L`;
  document.getElementById('ticketPromedio').textContent = `$${ticketProm.toFixed(2)}`;
  document.getElementById('cantidadVentas').textContent = ventas.length;

  // Top 3 ingresos & lista
  const resumenI = {};
  const resumenL = {};
  ventas.forEach(v => {
    const key = `Máquina ${v.maquina_id}`;
    resumenI[key] = (resumenI[key]||0) + (v.total||0);
    resumenL[key] = (resumenL[key]||0) + (v.litros||0);
  });
  const topI = Object.entries(resumenI).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const topL = Object.entries(resumenL).sort((a,b)=>b[1]-a[1]).slice(0,3);

  // actualizar lista
  const ul = document.getElementById('topMaquinas');
  ul.innerHTML = '';
  topI.forEach(([name, val])=>{
    const li = document.createElement('li');
    li.textContent = `${name}: $${val.toFixed(2)}`;
    ul.appendChild(li);
  });

  // actualizar gráficas
  chartVolumenes.data.labels   = topI.map(t=>t[0]);
  chartVolumenes.data.datasets[0].data = topI.map(t=>t[1]);
  chartVolumenes.update();

  chartLitros.data.labels   = topL.map(t=>t[0]);
  chartLitros.data.datasets[0].data = topL.map(t=>t[1]);
  chartLitros.update();

  // Ventas diarias
  const byDay = {};
  ventas.forEach(v=>{
    const d = new Date(v.fecha).toLocaleDateString('sv');
    byDay[d] = (byDay[d]||0) + (v.total||0);
  });
  const days = Object.keys(byDay).sort();
  chartVentasDiarias.data.labels = days;
  chartVentasDiarias.data.datasets[0].data = days.map(d=>byDay[d]);
  chartVentasDiarias.update();

  // Pie volumen
  chartTipoVolumen.data.labels   = topL.map(t=>t[0]);
  chartTipoVolumen.data.datasets[0].data = topL.map(t=>t[1]);
  chartTipoVolumen.update();
}

function exportarCSV() {
  if (!ventasActuales.length) return alert('No hay datos para exportar');
  const cols = Object.keys(ventasActuales[0]);
  const filas = ventasActuales.map(r=> cols.map(c=>r[c]||'').join(','));
  const csv  = [cols.join(','), ...filas].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'ventas.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function cerrarSesion() {
  supabase.auth.signOut().then(()=> window.location.href='login.html');
}
