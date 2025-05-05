// === Conexión a Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Navegación entre secciones ===
function mostrarSeccion(id) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');

  if (id === 'litros') cargarGraficoLitros();
}

// === Cargar lista de máquinas ===
async function cargarMaquinas() {
  const { data, error } = await supabase.from('maquinas').select('id, nombre');
  if (error) return console.error("Error al cargar máquinas:", error);

  const select = document.getElementById('filtroMaquina');
  select.innerHTML = '<option value="">Todas las máquinas</option>';
  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.innerText = m.nombre;
    select.appendChild(option);
  });
}

// === Resumen de ventas ===
async function cargarResumen() {
  const filtroPeriodo = document.getElementById('filtroPeriodo').value;
  const filtroMaquina = document.getElementById('filtroMaquina').value;

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
    .select('*')
    .gte('created_at', desde.toISOString())
    .lt('created_at', hasta.toISOString());

  if (filtroMaquina) {
    query = query.eq('machine_id', filtroMaquina);
  }

  const { data, error } = await query;
  if (error) return alert("❌ Error al cargar datos");

  let total = 0, litros = 0;
  const conteo = {};

  data.forEach(v => {
    total += v.total || 0;
    litros += v.volumen_litros || 0;
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

// === Gráfico de litros vendidos por día (últimos 7 días) ===
async function cargarGraficoLitros() {
  const { data, error } = await supabase
    .from('ventas')
    .select('volumen_litros, created_at')
    .gte('created_at', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString());

  if (error) return console.error('Error al cargar datos del gráfico:', error);

  const porDia = {};
  data.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString();
    porDia[fecha] = (porDia[fecha] || 0) + v.volumen_litros;
  });

  const labels = Object.keys(porDia);
  const litros = Object.values(porDia);

  const ctx = document.getElementById('graficoLitros').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Litros vendidos por día',
        data: litros,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
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
  } else {
    alert('✅ Configuración guardada correctamente');
  }
}

// === Exportar historial como CSV ===
async function exportarHistorialCSV() {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, machine_id, volumen_litros, total, created_at');

  if (error) {
    console.error('Error al exportar:', error);
    alert("❌ No se pudo exportar historial");
    return;
  }

  if (!data || data.length === 0) {
    alert("⚠️ No hay datos para exportar");
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(obj => headers.map(h => `"${obj[h] ?? ''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `historial_ventas_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// === Ejecutar al cargar ===
document.addEventListener("DOMContentLoaded", () => {
  cargarMaquinas();
  mostrarSeccion('resumen');
});
