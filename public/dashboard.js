const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  const machineSelect = document.getElementById('machine-select');
  const tableBody = document.getElementById('ventas-body');
  const totalHoy = document.getElementById('total-hoy');
  const totalMes = document.getElementById('total-mes');
  const totalAnio = document.getElementById('total-anio');
  const status = document.getElementById('status');

  const { data: machines, error: machinesError } = await supabase
    .from('machines')
    .select('id, nombre')
    .eq('owner_id', user.id);

  if (machinesError) {
    status.textContent = 'Error al cargar máquinas: ' + machinesError.message;
    return;
  }

  // Llenar el selector con todas las máquinas
  machines.forEach(machine => {
    const option = document.createElement('option');
    option.value = machine.id;
    option.textContent = machine.nombre || `Máquina ${machine.id}`;
    machineSelect.appendChild(option);
  });

  // Función para cargar ventas
  async function cargarVentas(machineId = null) {
    tableBody.innerHTML = '';
    status.textContent = 'Cargando ventas...';

    let query = supabase.from('sales').select('*').order('timestamp', { ascending: false });
    if (machineId) {
      query = query.eq('machine_id', machineId);
    }

    const { data: ventas, error: ventasError } = await query;
    if (ventasError) {
      status.textContent = 'Error al cargar ventas: ' + ventasError.message;
      return;
    }

    // Inicializar totales
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();

    let litrosHoy = 0, totalHoyNum = 0;
    let litrosMes = 0, totalMesNum = 0;
    let litrosAnio = 0, totalAnioNum = 0;

    ventas.forEach(v => {
      const fecha = new Date(v.timestamp);
      const vol = v.volume || 0;
      const price = v.total_price || 0;

      if (fecha.toDateString() === hoy.toDateString()) {
        litrosHoy += vol;
        totalHoyNum += price;
      }
      if (fecha.getFullYear() === anio && fecha.getMonth() === mes) {
        litrosMes += vol;
        totalMesNum += price;
      }
      if (fecha.getFullYear() === anio) {
        litrosAnio += vol;
        totalAnioNum += price;
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="py-2 px-4 border-b">${fecha.toLocaleString()}</td>
        <td class="py-2 px-4 border-b">${vol}L</td>
        <td class="py-2 px-4 border-b">$${price}</td>
      `;
      tableBody.appendChild(row);
    });

    totalHoy.textContent = `${litrosHoy}L / $${totalHoyNum}`;
    totalMes.textContent = `${litrosMes}L / $${totalMesNum}`;
    totalAnio.textContent = `${litrosAnio}L / $${totalAnioNum}`;
    status.textContent = ventas.length ? '' : 'No hay ventas registradas.';
  }

  // Cargar ventas iniciales (todas las máquinas)
  cargarVentas();

  // Cambiar filtro al seleccionar otra máquina
  machineSelect.addEventListener('change', () => {
    const machineId = machineSelect.value;
    cargarVentas(machineId || null);
  });
});