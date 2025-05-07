// dashboard.js

// === Inicializar Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Variables globales
let ventasActuales = []
let grafIngresos, grafLitros, grafDiaria, grafTipo

// 3. Al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  // 3.1 Autenticación
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return window.location.href = 'login.html'

  // 3.2 Inicializar fechas
  const hoy   = new Date()
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  document.getElementById('fechaInicioResumen').value = inicio.toISOString().slice(0,10)
  document.getElementById('fechaFinResumen'   ).value = hoy.toISOString().slice(0,10)

  // 3.3 Cargar máquinas en el select
  const { data: maquinas, error: errM } = await supabase
    .from('maquinas')
    .select('id, name')
    .eq('usuario_id', user.id)
  if (errM) console.error('Error al cargar máquinas:', errM.message)
  else {
    const sel = document.getElementById('filtroMaquina')
    maquinas.forEach(m => {
      const o = document.createElement('option')
      o.value       = m.id
      o.textContent = m.name || `Máquina ${m.id}`
      sel.appendChild(o)
    })
  }

  // 3.4 Enlazar botones
  document.getElementById('btnAplicar'   ).addEventListener('click', actualizarResumen)
  document.getElementById('btnExportar'  ).addEventListener('click', exportarCSV)
  document.getElementById('btnToggleDark').addEventListener('click', () => {
    document.body.classList.toggle('dark')
  })

  // 3.5 Primera carga
  actualizarResumen()
})

// 4. Función principal: obtiene datos y actualiza todo
async function actualizarResumen() {
  // 4.1 Leer filtros
  const maq   = document.getElementById('filtroMaquina').value
  const desde = document.getElementById('fechaInicioResumen').value
  const hasta = document.getElementById('fechaFinResumen').value

  // 4.2 Re-obtener usuario
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // 4.3 Construir consulta
  let q = supabase
    .from('ventas')
    .select('*')
    .eq('usuario_id', user.id)
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (maq !== 'todas') q = q.eq('maquina_id', maq)

  const { data: ventas, error } = await q
  if (error) return console.error('Error al obtener ventas:', error.message)

  ventasActuales = ventas

  // 4.4 Mostrar/ocultar mensaje “sin ventas”
  document.getElementById('mensajeSinVentas')
    .classList.toggle('hidden', ventas.length > 0)

  // 4.5 Calcular totales
  const totalV = ventas.reduce((sum, v) => sum + (v.total || 0), 0)
  const totalL = ventas.reduce((sum, v) => sum + (v.litros || 0), 0)
  const prom   = ventas.length ? totalV / ventas.length : 0

  document.getElementById('ventasTotales' ).textContent = `$${totalV.toFixed(2)}`
  document.getElementById('litrosTotales' ).textContent = `${totalL} L`
  document.getElementById('ticketPromedio').textContent = `$${prom.toFixed(2)}`
  document.getElementById('cantidadVentas').textContent = ventas.length

  // 4.6 Actualizar gráficas
  actualizarGraficaIngresos(ventas)
  actualizarGraficaLitrosVendidos(ventas)
  actualizarGraficaVentasDiarias(ventas)
  actualizarGraficaTipoVolumen(ventas)
}

// 5. Top 3 Ingresos (barra + lista)
function actualizarGraficaIngresos(ventas) {
  if (grafIngresos) grafIngresos.destroy()

  const mapa = {}
  ventas.forEach(v => {
    const key = v.name || `Máquina ${v.maquina_id}`
    mapa[key] = (mapa[key]||0) + (v.total||0)
  })
  const arr = Object.entries(mapa)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
  const labels = arr.map(r=>r[0])
  const data   = arr.map(r=>r[1])

  const ctx = document.getElementById('graficaVolumenes').getContext('2d')
  grafIngresos = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ data, backgroundColor:'rgba(54,162,235,0.6)' }] },
    options: {
      responsive:true,
      plugins:{ title:{ display:true, text:'Top 3 Máquinas por Ingreso' }},
      scales:{ y:{ beginAtZero:true } }
    }
  })

  const ul = document.getElementById('topMaquinas')
  ul.innerHTML = ''
  arr.forEach(([n,t])=>{
    const li = document.createElement('li')
    li.textContent = `${n}: $${t.toFixed(2)}`
    ul.appendChild(li)
  })
}

// 6. Top 3 Litros vendidos
function actualizarGraficaLitrosVendidos(ventas) {
  if (grafLitros) grafLitros.destroy()

  const mapa = {}
  ventas.forEach(v => {
    const key = v.name || `Máquina ${v.maquina_id}`
    mapa[key] = (mapa[key]||0) + (v.litros||0)
  })
  const arr = Object.entries(mapa)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
  const labels = arr.map(r=>r[0])
  const data   = arr.map(r=>r[1])

  const ctx = document.getElementById('graficaLitrosPorMaquina').getContext('2d')
  grafLitros = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ data, backgroundColor:'rgba(75,192,192,0.6)' }] },
    options: {
      responsive:true,
      plugins:{ title:{ display:true, text:'Top 3 Máquinas por Litros Vendidos' }},
      scales:{ y:{ beginAtZero:true } }
    }
  })
}

// 7. Tendencia diaria (línea)
function actualizarGraficaVentasDiarias(ventas) {
  if (grafDiaria) grafDiaria.destroy()

  const mapa = {}
  ventas.forEach(v => {
    const d = v.fecha.slice(0,10)
    mapa[d] = (mapa[d]||0) + (v.total||0)
  })
  const arr = Object.entries(mapa).sort((a,b)=>a[0].localeCompare(b[0]))
  const labels = arr.map(r=>r[0])
  const data   = arr.map(r=>r[1])

  const ctx = document.getElementById('graficaVentasDiarias').getContext('2d')
  grafDiaria = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets:[{ data, borderColor:'orange', fill:false }] },
    options: {
      responsive:true,
      plugins:{ title:{ display:true, text:'Tendencia de Ventas Diarias' }},
      scales:{ y:{ beginAtZero:true } }
    }
  })
}

// 8. Distribución volumen (pastel)
function actualizarGraficaTipoVolumen(ventas) {
  if (grafTipo) grafTipo.destroy()

  const mapa = {}
  ventas.forEach(v => {
    const tipo = v.tipo_volumen || 'Otro'
    mapa[tipo] = (mapa[tipo]||0) + (v.litros||0)
  })
  const labels = Object.keys(mapa)
  const data   = Object.values(mapa)
  const colors = ['#4ade80','#facc15','#60a5fa','#f87171','#a78bfa']

  const ctx = document.getElementById('graficaTipoVolumen').getContext('2d')
  grafTipo = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets:[{ data, backgroundColor:colors }] },
    options: {
      responsive:true,
      plugins:{ title:{ display:true, text:'Distribución por Tipo de Volumen' }}
    }
  })
}

// 9. Exportar CSV
function exportarCSV() {
  if (!ventasActuales.length) {
    return alert('No hay datos para exportar')
  }
  const cols = Object.keys(ventasActuales[0])
  const rows = ventasActuales.map(v => cols.map(c=>v[c]??''))
  const lines = [ cols.join(','), ...rows.map(r=>r.join(',')) ]
  const blob = new Blob([lines.join('\n')], { type:'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'ventas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// 10. Cerrar sesión
function cerrarSesion() {
  supabase.auth.signOut().then(()=>window.location.href='login.html')
}
