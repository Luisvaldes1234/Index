const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // reemplaza con tu anon key
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    window.location.href = 'login.html';
    return;
  }

  const userId = user.id;

  // Logout
  document.getElementById('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  // Obtener máquinas
  const { data: machines, error: machineError } = await supabase
    .from('machines')
    .select('id, name')
    .eq('owner_id', userId);

  const select = document.getElementById('machine-select');
  machines.forEach(machine => {
    const opt = document.createElement('option');
    opt.value = machine.id;
    opt.textContent = machine.name;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    cargarVentas(userId, select.value);
  });

  // Cargar ventas al iniciar
  cargarVentas(userId);
});

async function cargarVentas(userId, machineId = '') {
  let query = supabase
    .from('sales')
    .select('created_at, volume, total_price')
    .eq('machine_owner_id', userId);

  if (machineId) query = query.eq('machine_id', machineId);

  const { data: ventas, error } = await query;

  if (error) {
    console.error('Error al obtener ventas:', error);
    document.getElementById('status').textContent = 'Error cargando ventas.';
    return;
  }

  const tbody = document.getElementById('ventas-body');
  tbody.innerHTML = '';

  let totalHoy = 0, totalMes = 0, totalAnio = 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const mes = hoy.slice(0, 7);
  const anio = hoy.slice(0, 4);

  ventas.forEach(v => {
    const fecha = v.created_at.slice(0, 10);
    const precio = parseFloat(v.total_price);

    if (fecha === hoy) totalHoy += precio;
    if (fecha.startsWith(mes)) totalMes += precio;
    if (fecha.startsWith(anio)) totalAnio += precio;

    const row = `
      <tr>
        <td class="py-2 px-4 border-b">${fecha}</td>
        <td class="py-2 px-4 border-b">${v.volume} L</td>
        <td class="py-2 px-4 border-b">$${precio.toFixed(2)}</td>
      </tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
  });

  document.getElementById('total-hoy').textContent = `$${totalHoy.toFixed(2)}`;
  document.getElementById('total-mes').textContent = `$${totalMes.toFixed(2)}`;
  document.getElementById('total-anio').textContent = `$${totalAnio.toFixed(2)}`;
}
