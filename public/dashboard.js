// === Conexión a Supabase ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Navegación entre secciones ===
function mostrarSeccion(id) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
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

  if (filtroMaquina) {
    query = query.eq('machine_id', filtroMaquina);
  }

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

// === Ejecutar al cargar ===
document.addEventListener("DOMContentLoaded", () => {
  cargarMaquinas();
  mostrarSeccion('resumen');
});
