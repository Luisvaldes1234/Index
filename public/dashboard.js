const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.getElementById('logout');
  const machineSelect = document.getElementById('machine-select');
  const ventasBody = document.getElementById('ventas-body');
  const totalHoy = document.getElementById('total-hoy');
  const totalMes = document.getElementById('total-mes');
  const totalAnio = document.getElementById('total-anio');

  // Autenticación
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Obtener máquinas del usuario
  const { data: machines, error: machineError } = await supabase
    .from('machines')
    .select('*')
    .eq('owner_id', user.id);

  if (machineError || !machines || machines.length === 0) {
    machineSelect.innerHTML += '<option value="">No hay máquinas</option>';
    return;
  }

  // Cargar select de máquinas
  machines.forEach((machine) => {
    const option = document.createElement('option');
    option.value = machine.id;
    option.textContent = machine.name;
    machineSelect.appendChild(option);
  });

  machineSelect.addEventListener('change', () => {
    loadSales(machineSelect.value);
  });

  // Cargar ventas
  async function loadSales(machineId) {
    const machineIds = machines.map(m => m.id);

    let query = supabase
      .from('sales')
      .select('*')
      .in('machine_id', machineIds);

    if (machineId) {
      query = query.eq('machine_id', machineId);
    }

    const { data: sales, error: salesError } = await query;

    if (salesError) {
      ventasBody.innerHTML = '<tr><td colspan="3" class="py-2 px-4 text-center text-red-500">Error al cargar ventas.</td></tr>';
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentYear = new Date().toISOString().slice(0, 4);

    let hoyTotal = 0, mesTotal = 0, anioTotal = 0;
    ventasBody.innerHTML = '';

    sales.forEach((sale) => {
      const date = new Date(sale.created_at);
      const iso = date.toISOString();
      const total = Number(sale.total_price);

      const row = `
        <tr>
          <td class="py-2 px-4 border-b">${iso.slice(0, 10)}</td>
          <td class="py-2 px-4 border-b">${sale.volume} L</td>
          <td class="py-2 px-4 border-b">$${total.toFixed(2)}</td>
        </tr>
      `;
      ventasBody.innerHTML += row;

      if (iso.startsWith(today)) hoyTotal += total;
      if (iso.startsWith(currentMonth)) mesTotal += total;
      if (iso.startsWith(currentYear)) anioTotal += total;
    });

    totalHoy.textContent = `$${hoyTotal.toFixed(2)}`;
    totalMes.textContent = `$${mesTotal.toFixed(2)}`;
    totalAnio.textContent = `$${anioTotal.toFixed(2)}`;
  }

  // Carga inicial
  await loadSales();

  // Cerrar sesión
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'https://aqualink.netlify.app/';
  });
});
