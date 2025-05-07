// === Inicializar Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales para guardar instancias de Chart y datos
let ventasActuales = [];
let graficaIngresos, graficaLitros, graficaDiaria, graficaTipoVolumen;

// === Al cargar la página ===
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Autenticación
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = 'login.html';

  // 2) Inicializar filtros de fecha
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById('fechaInicioResumen').value = inicioMes.toISOString().slice(0,10);
  document.getElementById('fechaFinResumen'   ).value = hoy.toISOString().slice(0,10);

  // 3) Cargar lista de máquinas
  const { data: maquinas, error: errM } = await supabase
    .from('maquinas')
    .select('id, name')
    .eq('usuario_id', user.id);
  if (errM) console.error('Error al cargar máquinas:', errM);
  else {
    const sel = document.getElementById('filtroMaquina');
    maquinas.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.name || `Máquina ${m.id}`;
      sel.appendChild(o);
    });
  }

  // 4) Botón Aplicar
  document.querySelector('button[onclick="actualizarResumen()"]')
    .addEventListener('click', actualizarResumen);

  // 5) Botón CSV
  document.querySelector('button[onclick="exportarCSV()"]')
    .addEventListener('click', exportarCSV);

  // 6) Toggle Dark
  document.querySelector('button[onclick="document.body.classList.toggle(\'dark\')"]')
    .addEventListener('click', ()=>{/* no hace falta más */});

  // 7) Lanzar primer cálculo
  actualizarResumen();
});

// === Función principal ===
async function actualizarResumen() {
  // Leer filtros
  const maquina = document.getElementById('filtroMaquina').value;
  const desde   = document.getElementById('fechaInicioResumen').value;
  const hasta   = document.getElementById('fechaFinResumen'   ).value;

  // Volver a obtener usuario
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return;

  // Construir consulta
  let q = supabase
    .from('ventas')
    .select('*')
    .eq('usuario_id', user.id)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (maquina !== 'todas') q = q.eq('maquina_id', maquina);

  const { data: ventas, error } = await q;
  if (error) return console.error('Error al obtener ventas:', error);

  ventasActuales = ventas; // para CSV

  // 1) Mostrar mensaje sin ventas
  document.getElementById('mensajeSinVentas').classList.toggle('hidden', ventas.length>0);

  // 2) Calcular y mostrar totales
  const totVtas = ventas.reduce((a,v)=>a+(v.total||0),0);
  const totLit  = ventas.reduce((a,v)=>a+(v.litros||0),0);
  const prom    = ventas.length ? totVtas/ventas.length : 0;

  document.getElementById('ventasTotales' ).textContent = `$${totVtas.toFixed(2)}`;
  document.getElementById('litrosTotales' ).textContent = `${totLit} L`;
  document.getElementById('ticketPromedio').textContent = `$${prom.toFixed(2)}`;
  document.getElementById('cantidadVentas').textContent = ventas.length;

  // 3) Actualizar gráficas
  actualizarGraficaIngresos(ventas);
  actualizarGraficaLitrosVendidos(ventas);
  actualizarGraficaVentasDiarias(ventas);
  actualizarGraficaTipoVolumen(ventas);
}

// === Top 3 Ingresos ===
function actualizarGraficaIngresos(ventas) {
  // destruir si existía
  if (graficaIngresos) graficaIngresos.destroy();

  // Agrupar totales por máquina
  const mapa = {};
  ventas.forEach(v=>{
    const key = v.name || `Máquina ${v.maquina_id}`;
    mapa[key] = (mapa[key]||0) + (v.total||0);
  });
  const arr = Object.entries(mapa).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const labels = arr.map(r=>r[0]);
  const data   = arr.map(r=>r[1]);

  // Bar chart
  const ctx = document.getElementById('graficaVolumenes').getContext('2d');
  graficaIngresos = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor:'rgba(54,162,235,0.6)' }]},
    options:{
      plugins:{
        title:{ display:true, text:'Top 3 Máquinas por Ingreso' },
        datalabels:{
          anchor:'end', align:'top',
          formatter: v=>`$${v.toFixed(2)}`,
          font:{ weight:'bold' }, color:'#111'
        }
      },
      responsive:true
    },
    plugins:[ChartDataLabels]
  });

  // Lista textual
  const ul = document.getElementById('topMaquinas');
  ul.innerHTML='';
  arr.forEach(([n,t])=>{
    const li=document.createElement('li');
    li.textContent=`${n}: $${t.toFixed(2)}`;
    ul.appendChild(li);
  });
}

// === Litros vendidos por máquina (Top 3) ===
function actualizarGraficaLitrosVendidos(ventas) {
  if (graficaLitros) graficaLitros.destroy();

  const mapa = {};
  ventas.forEach(v=>{
    const key = v.name || `Máquina ${v.maquina_id}`;
    mapa[key] = (mapa[key]||0) + (v.litros||0);
  });
  const arr = Object.entries(mapa).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const labels = arr.map(r=>r[0]);
  const data   = arr.map(r=>r[1]);

  const canvas = document.getElementById('graficaLitrosPorMaquina');
  const ctx    = canvas.getContext('2d');
  graficaLitros = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor:'rgba(75,192,192,0.6)' }]},
    options:{
      plugins:{
        title:{ display:true, text:'Top 3 Máquinas por Litros Vendidos' },
        datalabels:{
          anchor:'end', align:'top',
          formatter: v=>`${v} L`,
          font:{ weight:'bold' }, color:'#111'
        }
      },
      responsive:true
    },
    plugins:[ChartDataLabels]
  });
}

// === Tendencia de ventas diarias ===
function actualizarGraficaVentasDiarias(ventas) {
  if (graficaDiaria) graficaDiaria.destroy();

  // acumular totales por día
  const mapa = {};
  ventas.forEach(v=>{
    const dia = v.fecha.slice(0,10); // YYYY-MM-DD
    mapa[dia] = (mapa[dia]||0) + (v.total||0);
  });
  const arr = Object.entries(mapa).sort((a,b)=>a[0].localeCompare(b[0]));
  const labels = arr.map(r=>r[0]);
  const data   = arr.map(r=>r[1]);

  const ctx = document.getElementById('graficaVentasDiarias').getContext('2d');
  graficaDiaria = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ data, fill:false, borderColor:'rgba(255,159,64,0.8)' }]},
    options:{
      plugins:{
        title:{ display:true, text:'Tendencia de Ventas Diarias' }
      },
      scales:{ y:{ beginAtZero:true } },
      responsive:true
    }
  });
}

// === Distribución por tipo de volumen (pastel) ===
function actualizarGraficaTipoVolumen(ventas) {
  if (graficaTipoVolumen) graficaTipoVolumen.destroy();

  // Supuestamente tienes un campo v.tipoVolumen (por ejemplo "AC", "FRIO", etc.)
  const mapa = {};
  ventas.forEach(v=>{
    const tipo = v.tipo_volumen || 'Desconocido';
    mapa[tipo] = (mapa[tipo]||0) + (v.litros||0);
  });
  const labels = Object.keys(mapa);
  const data   = Object.values(mapa);

  const ctx = document.getElementById('graficaTipoVolumen').getContext('2d');
  graficaTipoVolumen = new Chart(ctx, {
    type:'pie',
    data:{ labels, datasets:[{ data, backgroundColor:[
      '#4ade80','#facc15','#60a5fa','#f87171','#a78bfa'
    ]}]},
    options:{
      plugins:{ title:{ display:true, text:'Distribución de Volumen por Tipo' }},
      responsive:true
    }
  });
}

// === Exportar CSV ===
function exportarCSV() {
  if (!ventasActuales.length) {
    return alert('No hay datos para exportar');
  }
  const cols = Object.keys(ventasActuales[0]);
  const rows = ventasActuales.map(v=> cols.map(c=>v[c]||''));
  const lines = [ cols.join(','), ...rows.map(r=>r.join(',')) ];
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'ventas.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// === Cerrar sesión ===
function cerrarSesion() {
  supabase.auth.signOut().then(()=> window.location.href='login.html');
}
