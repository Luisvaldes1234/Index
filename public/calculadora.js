const supabase = window.supabase.createClient(
  'https://ikuouxllerfjnibjtlkl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U'
);

// === Cerrar sesión ===
async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
}

// === Cargar máquinas del usuario autenticado ===
async function cargarMaquinasParaUtilidad() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("Error al obtener usuario:", userError.message);
    return;
  }

  const { data, error } = await supabase
    .from('maquinas')
    .select('serial')
    .eq('user_id', user.id);

  if (error) {
    console.error("Error al cargar máquinas:", error.message);
    return;
  }

  const select = document.getElementById('maquinaUtilidad');
  select.innerHTML = '<option value="">Selecciona una máquina</option>';
  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.serial;
    option.textContent = m.serial;
    select.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', cargarMaquinasParaUtilidad);

// === Calcular utilidad ===
async function calcularUtilidad() {
  const precioAgua = parseFloat(document.getElementById('precioAgua').value || 0);
  const costoLuz = parseFloat(document.getElementById('costoLuz').value || 0);
  const otrosGastos = parseFloat(document.getElementById('otrosGastos').value || 0);
  const mes = document.getElementById('mesUtilidad').value;
  const serial = document.getElementById('maquinaUtilidad').value;

  if (!mes || !serial) {
    alert("Selecciona un mes y una máquina");
    return;
  }

  const desde = new Date(`${mes}-01T00:00:00`);
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + 1);

  const { data, error } = await supabase
    .from('ventas')
    .select('litros, precio_total')
    .eq('serial', serial)
    .gte('fecha', desde.toISOString())
    .lt('fecha', hasta.toISOString());

  if (error) {
    console.error("Error al consultar ventas:", error.message);
    return;
  }

  const totalLitros = data.reduce((sum, v) => sum + (v.litros || 0), 0);
  const totalIngresos = data.reduce((sum, v) => sum + (v.precio_total || 0), 0);
  const costoAgua = (totalLitros / 1000) * precioAgua;
  const gastosTotales = costoAgua + costoLuz + otrosGastos;
  const utilidadNeta = totalIngresos - gastosTotales;
  const margen = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

  mostrarResultadosUtilidad({
    totalLitros,
    totalIngresos,
    costoAgua,
    costoLuz,
    otrosGastos,
    gastosTotales,
    utilidadNeta,
    margen
  });
}

// === Mostrar resultados ===
function mostrarResultadosUtilidad(datos) {
  const {
    totalLitros,
    totalIngresos,
    costoAgua,
    costoLuz,
    otrosGastos,
    gastosTotales,
    utilidadNeta,
    margen
  } = datos;

  const div = document.getElementById('resultadoUtilidad');
  div.innerHTML = `
    <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mt-4 space-y-2">
      <p><strong>💧 Litros vendidos:</strong> ${totalLitros.toFixed(2)} L</p>
      <p><strong>💵 Ingresos totales:</strong> $${totalIngresos.toFixed(2)}</p>
      <hr>
      <p><strong>🧾 Costo de agua:</strong> $${costoAgua.toFixed(2)}</p>
      <p><strong>⚡ Costo de luz:</strong> $${costoLuz.toFixed(2)}</p>
      <p><strong>📦 Otros gastos:</strong> $${otrosGastos.toFixed(2)}</p>
      <p><strong>🧮 Gastos totales:</strong> $${gastosTotales.toFixed(2)}</p>
      <hr>
      <p class="text-green-400"><strong>💰 Utilidad neta:</strong> $${utilidadNeta.toFixed(2)}</p>
      <p class="text-blue-400"><strong>📈 Margen:</strong> ${margen.toFixed(2)}%</p>
    </div>
  `;
}
