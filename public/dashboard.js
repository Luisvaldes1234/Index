// === Conexión a Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Variables para gráficas ===
let graficaMaquinas = null;
let graficaHorarios = null;
let miGraficoLitros = null;

// === Navegación entre secciones ===
function mostrarSeccion(id) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');

  if (id === 'litros') {
    generarCheckboxesMaquinas();
    cargarGraficoLitros();
  }

  if (id === 'historial') cargarHistorial();
}

// === Cargar lista de máquinas al inicio ===
async function cargarMaquinas() {
  const { data, error } = await supabase.from('maquinas').select('id, nombre');
  if (error) {
    console.error("Error al cargar máquinas:", error);
    return;
  }

  const select = document.getElementById('filtroMaquina');
  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.innerText = m.nombre;
    select.appendChild(option);
  });
}

// === Resumen general (botón azul) ===
async function cargarResumen() {
  const filtroPeriodo = document.getElementById('filtroPeriodo').value;
  const filtroMaquina = document.getElementById('filtroMaquina').value;

  const ahora = new Date();
  let desde, hasta;

  if (filtroPeriodo === 'dia') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  } else if (filtroPeriodo === 'semana') {
    const primerDia = ahora.getDate() - ahora.getDay();
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), primerDia);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth(), primerDia + 7);
  } else if (filtroPeriodo === 'mes') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  } else {
    desde = new Date(ahora.getFullYear(), 0, 1);
    hasta = new Date(ahora.getFullYear() + 1, 0, 1);
  }

  let query = supabase
    .from('ventas')
    .select('*')
    .gte('fecha', desde.toISOString())
    .lt('fecha', hasta.toISOString());

  if (filtroMaquina) query = query.eq('machine_id', filtroMaquina);

  const { data, error } = await query;
  if (error) {
    console.error('Error al cargar ventas:', error);
    alert("Error al cargar datos de Supabase");
    return;
  }

  let total = 0;
  let litros = 0;
  const conteo = {};

  data.forEach(v => {
    total += v.total;
    litros += v.volumen_litros;
    const clave = `${v.volumen_litros}L`;
    conteo[clave] = (conteo[clave] || 0) + 1;
  });

  document.getElementById('ventasTotales').innerText = `$${total.toFixed(2)}`;
  document.getElementById('litrosTotales').innerText = `${litros} L`;

  const lista = document.getElementById('volumenesVendidos');
  lista.innerHTML = '';
  for (const clave in conteo) {
    const li = document.createElement('li');
    li.innerText = `${clave}: ${conteo[clave]} ventas`;
    lista.appendChild(li);
  }
}
// === Gráficas personalizadas por rango de fechas (filtro manual) ===
async function actualizarResumen() {
  const inicio = document.getElementById('fechaInicioResumen').value;
  const fin = document.getElementById('fechaFinResumen').value;

  if (!inicio || !fin) {
    alert("Selecciona un rango de fechas.");
    return;
  }

  const { data: ventas, error } = await supabase
    .from('ventas')
    .select('*')
    .gte('fecha', inicio)
    .lte('fecha', fin);

  if (error) {
    console.error('Error al obtener ventas:', error);
    return;
  }

  cargarGraficaPorMaquina(ventas);
  cargarGraficaPorHorario(ventas);

  // === Actualizar los cuadros del resumen con este mismo rango ===
  let total = 0;
  let litros = 0;
  const conteo = {};

  ventas.forEach(v => {
    total += v.total;
    litros += v.volumen_litros;
    const clave = `${v.volumen_litros}L`;
    conteo[clave] = (conteo[clave] || 0) + 1;
  });

  document.getElementById('ventasTotales').innerText = `$${total.toFixed(2)}`;
  document.getElementById('litrosTotales').innerText = `${litros} L`;

  const lista = document.getElementById('volumenesVendidos');
  lista.innerHTML = '';
  for (const clave in conteo) {
    const li = document.createElement('li');
    li.innerText = `${clave}: ${conteo[clave]} ventas`;
    lista.appendChild(li);
  }
}

// === Gráfica: Ventas por máquina ===
function cargarGraficaPorMaquina(ventas) {
  const totales = {};
  ventas.forEach(v => {
    const id = v.machine_id || v.maquina_id;
    totales[id] = (totales[id] || 0) + v.total;
  });

  const labels = Object.keys(totales);
  const datos = Object.values(totales);

  if (graficaMaquinas) graficaMaquinas.destroy();

  const ctx = document.getElementById("graficaVentasMaquina").getContext("2d");
  graficaMaquinas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ventas $',
        data: datos,
        backgroundColor: 'rgba(54, 162, 235, 0.6)'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// === Gráfica: Ventas por horario ===
function cargarGraficaPorHorario(ventas) {
  const rangos = {
    '00:00 – 08:00': 0,
    '08:01 – 16:00': 0,
    '16:01 – 23:59': 0
  };

  ventas.forEach(v => {
    const hora = new Date(v.fecha).getHours();
    if (hora <= 8) rangos['00:00 – 08:00'] += v.total;
    else if (hora <= 16) rangos['08:01 – 16:00'] += v.total;
    else rangos['16:01 – 23:59'] += v.total;
  });

  if (graficaHorarios) graficaHorarios.destroy();

  const ctx = document.getElementById("graficaHorarios").getContext("2d");
  graficaHorarios = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(rangos),
      datasets: [{
        label: 'Ventas por horario ($)',
        data: Object.values(rangos),
        backgroundColor: 'rgba(255, 159, 64, 0.6)'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// === Generar checkboxes para seleccionar máquinas ===
async function generarCheckboxesMaquinas() {
  const contenedor = document.getElementById('filtrosMaquinasGrafico');
  contenedor.innerHTML = ''; // Limpiar

  const { data: maquinas, error } = await supabase.from('maquinas').select('id, nombre');
  if (error) {
    console.error('Error al cargar máquinas:', error);
    return;
  }

  maquinas.forEach(m => {
    const label = document.createElement('label');
    label.className = 'inline-flex items-center space-x-2';
    label.innerHTML = `
      <input type="checkbox" value="${m.id}" checked class="maquinaCheckbox">
      <span>${m.nombre}</span>
    `;
    contenedor.appendChild(label);
  });

  document.querySelectorAll('.maquinaCheckbox').forEach(chk => {
    chk.addEventListener('change', cargarGraficoLitros);
  });
}
// === Gráfica de litros vendidos por fecha y máquina ===
async function cargarGraficoLitros() {
  const filtroPeriodo = document.getElementById('filtroPeriodo').value;

  const ahora = new Date();
  let desde, hasta;

  if (filtroPeriodo === 'dia') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  } else if (filtroPeriodo === 'semana') {
    const primerDia = ahora.getDate() - ahora.getDay();
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), primerDia);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth(), primerDia + 7);
  } else if (filtroPeriodo === 'mes') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  } else {
    desde = new Date(ahora.getFullYear(), 0, 1);
    hasta = new Date(ahora.getFullYear() + 1, 0, 1);
  }

  const seleccionadas = Array.from(document.querySelectorAll('.maquinaCheckbox:checked')).map(cb => parseInt(cb.value));

  const { data: ventas, error } = await supabase
    .from('ventas')
    .select('fecha, volumen_litros, machine_id')
    .gte('fecha', desde.toISOString())
    .lt('fecha', hasta.toISOString());

  if (error) {
    console.error('Error cargando ventas:', error);
    return;
  }

  const { data: maquinas } = await supabase.from('maquinas').select('id, nombre');
  const nombreMaquina = {};
  maquinas.forEach(m => nombreMaquina[m.id] = m.nombre);

  const agrupado = {};
  ventas.forEach(v => {
    if (!seleccionadas.includes(v.machine_id)) return;
    const fecha = new Date(v.fecha).toISOString().split('T')[0];
    if (!agrupado[fecha]) agrupado[fecha] = {};
    if (!agrupado[fecha][v.machine_id]) agrupado[fecha][v.machine_id] = 0;
    agrupado[fecha][v.machine_id] += v.volumen_litros;
  });

  const fechas = Object.keys(agrupado).sort();
  const datasets = [];

  maquinas.forEach((m, idx) => {
    if (!seleccionadas.includes(m.id)) return;

    const datos = fechas.map(f => agrupado[f]?.[m.id] || 0);
    const color = `hsl(${(idx * 137) % 360}, 70%, 50%)`;

    datasets.push({
      label: nombreMaquina[m.id],
      data: datos,
      backgroundColor: color
    });
  });

  const ctx = document.getElementById('graficoLitros').getContext('2d');
  if (miGraficoLitros) miGraficoLitros.destroy();

  miGraficoLitros = new Chart(ctx, {
    type: 'bar',
    data: { labels: fechas, datasets },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// === Cargar historial de ventas ===
async function cargarHistorial() {
  const periodo = document.getElementById('filtroHistorialPeriodo').value;
  const ahora = new Date();
  let desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  let hasta = new Date();

  if (periodo === 'anio') {
    desde = new Date(ahora.getFullYear(), 0, 1);
  } else if (periodo === 'todo') {
    desde = new Date(2000, 0, 1); // Muy atrás
  }

  const { data, error } = await supabase
    .from('ventas')
    .select('*')
    .gte('fecha', desde.toISOString())
    .lte('fecha', hasta.toISOString())
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error cargando historial:', error);
    return;
  }

  const tabla = document.getElementById('tablaHistorial');
  tabla.innerHTML = `
    <table class="w-full text-sm">
      <thead><tr><th>Fecha</th><th>Máquina</th><th>Volumen</th><th>Total</th></tr></thead>
      <tbody>
        ${data.map(v => `
          <tr>
            <td>${new Date(v.fecha).toLocaleString()}</td>
            <td>${v.machine_id}</td>
            <td>${v.volumen_litros} L</td>
            <td>$${v.total}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// === Guardar configuración remota ===
async function guardarConfiguracion() {
  const form = document.getElementById('formConfig');

  const config = {
    maquina_id: document.getElementById('filtroMaquina').value || 'default',
    btn1_litros: parseFloat(form.btn1_litros.value),
    btn1_precio: parseFloat(form.btn1_precio.value),
    actualizada_en: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('configuracion_maquina')
    .upsert(config, { onConflict: ['maquina_id'] });

  if (error) {
    console.error('Error al guardar configuración:', error);
    alert('❌ Error al guardar configuración');
    return;
  }

  alert('✅ Configuración guardada correctamente');
}

// === Exportar historial como CSV ===
function exportarHistorialCSV() {
  const tabla = document.querySelector('#tablaHistorial table');
  if (!tabla) return alert("No hay historial para exportar");

  let csv = '';
  const filas = tabla.querySelectorAll('tr');

  filas.forEach(fila => {
    const celdas = fila.querySelectorAll('th, td');
    const valores = Array.from(celdas).map(c => `"${c.innerText}"`);
    csv += valores.join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'historial_ventas.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// === Inicialización al cargar la página ===
document.addEventListener("DOMContentLoaded", () => {
  cargarMaquinas();
  mostrarSeccion('resumen');

  // Preselecciona la fecha de hoy en los filtros del resumen
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("fechaInicioResumen").value = hoy;
  document.getElementById("fechaFinResumen").value = hoy;

  actualizarResumen(); // Mostrar gráficas y cuadros con fecha actual
});

