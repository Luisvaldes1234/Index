const supabaseUrl = 'https://ikouxllerfjnibjtlklk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Navegación entre pestañas
function mostrarSeccion(id) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// Cargar resumen de ventas
async function cargarResumen() {
  const filtroPeriodo = document.getElementById('filtroPeriodo').value;
  const filtroMaquina = document.getElementById('filtroMaquina').value;

  const fecha = new Date();
  let desde, hasta = new Date();

  if (filtroPeriodo === 'dia') {
    desde = new Date(fecha.setHours(0, 0, 0, 0));
    hasta = new Date(fecha.setHours(23, 59, 59, 999));
  } else if (filtroPeriodo === 'semana') {
    const firstDay = fecha.getDate() - fecha.getDay();
    desde = new Date(fecha.setDate(firstDay));
    hasta = new Date(fecha.setDate(firstDay + 7));
  } else if (filtroPeriodo === 'mes') {
    desde = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    hasta = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
  } else {
    desde = new Date(fecha.getFullYear(), 0, 1);
    hasta = new Date(fecha.getFullYear() + 1, 0, 1);
  }

  let query = supabase
    .from('ventas')
    .select('*')
    .gte('fecha', desde.toISOString())
    .lt('fecha', hasta.toISOString());

  if (filtroMaquina) {
    query = query.eq('maquina_id', filtroMaquina);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error al cargar ventas:', error);
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

// Guardar configuración (simulado por ahora)
function guardarConfiguracion() {
  const form = document.getElementById('formConfig');
  const litros = form.btn1_litros.value;
  const precio = form.btn1_precio.value;

  console.log("Enviar configuración:", {
    boton1: { litros, precio }
  });

  alert("Configuración guardada (simulada)");
}
