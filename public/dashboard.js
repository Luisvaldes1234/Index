// === Conexión a Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Navegación entre secciones ===
function mostrarSeccion(id) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');

  if (id === 'litros') cargarGraficoLitros();
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

// === Cargar resumen de ventas ===
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

// === Cargar gráfico de litros vendidos ===
async function cargarGraficoLitros() {
  const filtroMaquina = document.getElementById('filtroMaquina').value;
  const filtroPeriodo = document.getElementById('filtroPeriodo').value;

  const ahora = new Date();
  let desde, hasta;

  if (filtroPeriodo === 'dia') {
    desde = new Date(ahora.setHours(0, 0, 0, 0));
    hasta = new Date(ahora.setHours(23, 59, 59, 999));
  } else if (filtroPeriodo === 'semana') {
    const primerDia = ahora.getDate() - ahora.getDay();
    desde = new Date(ahora.setDate(primerDia));
    hasta = new Date(ahora.setDate(primerDia + 7));
  } else if (filtroPeriodo === 'mes') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  } else {
    desde = new Date(ahora.getFullYear(), 0, 1);
    hasta = new Date(ahora.getFullYear() + 1, 0, 1);
  }

  let query = supabase
    .from('ventas')
    .select('fecha, volumen_litros')
    .gte('fecha', desde.toISOString())
    .lt('fecha', hasta.toISOString());

  if (filtroMaquina) query = query.eq('machine_id', filtroMaquina);

  const { data, error } = await query;
  if (error) {
    console.error('Error al cargar datos para gráfico:', error);
    return;
  }

  const resumenPorDia = {};
  data.forEach(v => {
    const fecha = new Date(v.fecha).toISOString().split('T')[0];
    resumenPorDia[fecha] = (resumenPorDia[fecha] || 0) + v.volumen_litros;
  });

  const labels = Object.keys(resumenPorDia).sort();
  const valores = labels.map(dia => resumenPorDia[dia]);

  const ctx = document.getElementById('graficoLitros').getContext('2d');
  if (window.miGraficoLitros) window.miGraficoLitros.destroy();

  window.miGraficoLitros = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Litros vendidos por día',
        data: valores,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
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

// === Cargar historial de ventas ===
async function cargarHistorial() {
  const filtroMaquina = document.getElementById('filtroMaquina').value;

  let query = supabase
    .from('ventas')
    .select('fecha, volumen_litros, total')
    .order('fecha', { ascending: false })
    .limit(100);

  if (filtroMaquina) query = query.eq('machine_id', filtroMaquina);

  const { data, error } = await query;
  if (error) {
    console.error('Error al cargar historial:', error);
    return;
  }

  const tabla = document.createElement('table');
  tabla.classList.add('min-w-full', 'divide-y', 'divide-gray-200');

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr class="bg-gray-100">
      <th class="px-4 py-2 text-left">Fecha</th>
      <th class="px-4 py-2 text-left">Litros</th>
      <th class="px-4 py-2 text-left">Total ($)</th>
    </tr>`;
  tabla.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2">${new Date(row.fecha).toLocaleString()}</td>
      <td class="px-4 py-2">${row.volumen_litros} L</td>
      <td class="px-4 py-2">$${row.total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);

  const contenedor = document.getElementById('tablaHistorial');
  contenedor.innerHTML = '';
  contenedor.appendChild(tabla);
}

// === Guardar configuración remota ===
async function guardarConfiguracion() {
  const form = document.getElementById('formConfig');
  
// === Cargar historial de ventas con filtro ===
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

// === Exportar CSV del historial mostrado ===
function exportarHistorialCSV() {
  const rows = Array.from(document.querySelectorAll('#tablaHistorial table tr')).map(row =>
    Array.from(row.children).map(cell => cell.innerText)
  );

  const csvContent = rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "historial_ventas.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// === Escuchar cambios de filtro ===
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('filtroHistorialPeriodo').addEventListener('change', cargarHistorial);
});


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

// === Ejecutar al cargar ===
document.addEventListener("DOMContentLoaded", () => {
  cargarMaquinas();
  mostrarSeccion('resumen');
});
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
