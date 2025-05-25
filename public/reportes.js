// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;
let reporteActual = null;
let datosReporte = null;

document.addEventListener("DOMContentLoaded", inicializar);

// === INICIALIZACIÓN ===
async function inicializar() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert("No estás autenticado.");
    window.location.href = "/login.html";
    return;
  }
  user = currentUser;

  // Fechas por defecto (último mes → hoy)
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setMonth(haceUnMes.getMonth() - 1);
  document.getElementById("fechaDesde").value = haceUnMes.toISOString().slice(0,10);
  document.getElementById("fechaHasta").value = hoy.toISOString().slice(0,10);

  await cargarMaquinas();
  configurarEventListeners();
}

// === CARGA DE MÁQUINAS ===
async function cargarMaquinas() {
  const { data: maquinas = [] } = await supabase
    .from("maquinas")
    .select("serial, nombre")
    .eq("user_id", user.id);

  const select = document.getElementById("filtroMaquina");
  select.innerHTML = '<option value="">Todas las máquinas</option>';
  maquinas.forEach(m => {
    const option = document.createElement("option");
    option.value = m.serial;
    option.textContent = m.nombre || m.serial;
    select.appendChild(option);
  });
}

// === EVENT LISTENERS ===
function configurarEventListeners() {
  document.getElementById("btnAplicarFiltros")
    .addEventListener("click", () => {
      if (reporteActual) mostrarReporte(reporteActual);
    });
  document.getElementById("btnLogout")
    .addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/login.html";
    });
}

// === UTILIDADES ===
function mostrarLoading(show = true) {
  document.getElementById("loading")
    .classList.toggle("hidden", !show);
}
function volverALista() {
  document.getElementById("reportesContainer").classList.remove("hidden");
  document.getElementById("reporteDetallado").classList.add("hidden");
  reporteActual = null;
}

// === ORQUESTADOR DE REPORTES ===
async function mostrarReporte(tipo) {
  reporteActual = tipo;
  mostrarLoading(true);
  document.getElementById("reportesContainer").classList.add("hidden");
  document.getElementById("reporteDetallado").classList.remove("hidden");
  const cont = document.getElementById("contenidoReporte");
  try {
    switch(tipo) {
      case 'ventasDetallado':           await reporteVentasDetallado(cont);        break;
      case 'rendimientoMaquina':        await reporteRendimientoMaquina(cont);     break;
      case 'analisisHorarios':          await reporteAnalisisHorarios(cont);       break;
      case 'corteCaja':                 await reporteCorteCaja(cont);              break;
      case 'ticketPromedio':            await reporteTicketPromedio(cont);         break;
      case 'proyecciones':              await reporteProyecciones(cont);           break;
      case 'conectividad':              await reporteConectividad(cont);           break;
      case 'mantenimientoPredictivo':   await reporteMantenimientoPredictivo(cont);break;
      case 'demandaVolumen':            await reporteDemandaVolumen(cont);         break;
      case 'eficienciaOperativa':       await reporteEficienciaOperativa(cont);    break;
      case 'dashboardEjecutivo':        await reporteDashboardEjecutivo(cont);     break;
      default:
        cont.innerHTML = '<p class="text-red-600">Reporte no encontrado.</p>';
    }
  } catch (err) {
    console.error(err);
    cont.innerHTML = `<p class="text-red-600">Error: ${err.message}</p>`;
  } finally {
    mostrarLoading(false);
  }
}

// === FUNCIONES AUXILIARES DE DATOS ===
async function obtenerDatosBase() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value + "T23:59:59";
  const serial = document.getElementById("filtroMaquina").value;

  let qV = supabase.from("ventas").select("*")
    .gte("created_at", new Date(desde).toISOString())
    .lte("created_at", new Date(hasta).toISOString());
  if (serial) qV = qV.eq("serial", serial);
  const { data: ventas = [] } = await qV;

  let qM = supabase.from("maquinas").select("*")
    .eq("user_id", user.id);
  if (serial) qM = qM.eq("serial", serial);
  const { data: maquinas = [] } = await qM;

  return { ventas, maquinas };
}

// === EXPORTACIÓN ===
function mostrarModalExportar() {
  document.getElementById("modalExportar")
    .classList.remove("hidden");
}
function cerrarModalExportar() {
  document.getElementById("modalExportar")
    .classList.add("hidden");
}
async function exportarReporte(formato) {
  cerrarModalExportar();
  if (!datosReporte) return alert("No hay datos para exportar");
  if (formato === 'csv') exportarCSV();
  else alert(`Exportación a ${formato.toUpperCase()} próximamente disponible`);
}
function exportarCSV() {
  let csv = "";
  const nombre = reporteActual.replace(/([A-Z])/g, " $1").trim();
  switch(reporteActual) {
    case 'ventasDetallado':
      csv = "Fecha,Ventas,Litros,Total\n";
      Object.entries(datosReporte.ventasPorDia).forEach(([f,d]) =>
        csv += `${f},${d.ventas},${d.litros},${d.total}\n`
      );
      break;
    // ...otros casos según corresponda...
    default:
      csv = `${nombre}\n` + JSON.stringify(datosReporte);
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `reporte_${reporteActual}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// === REPORTES (1) Ventas Detallado ===
async function reporteVentasDetallado(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const ventasPorDia = {};
  ventas.forEach(v => {
    const f = new Date(v.created_at).toLocaleDateString('es-MX');
    ventasPorDia[f] = ventasPorDia[f] || { total:0, litros:0, ventas:0 };
    ventasPorDia[f].total  += parseFloat(v.precio_total || 0);
    ventasPorDia[f].litros += parseFloat(v.litros      || 0);
    ventasPorDia[f].ventas ++;
  });
  const labels = Object.keys(ventasPorDia).sort();
  const totales = labels.map(d => ventasPorDia[d].total);
  const litros  = labels.map(d => ventasPorDia[d].litros);
  const sumaVentas  = totales.reduce((a,b)=>a+b,0);
  const sumaLitros  = litros .reduce((a,b)=>a+b,0);
  const promDiario  = sumaVentas / labels.length;

  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Ventas Detallado</h2>
      <button onclick="mostrarModalExportar()"
              class="bg-green-500 text-white px-4 py-2 rounded-lg">
        Exportar
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="p-4 bg-white rounded-lg shadow">
        <p>Total Vendido</p><p class="text-2xl">$${sumaVentas.toFixed(2)}</p>
      </div>
      <div class="p-4 bg-white rounded-lg shadow">
        <p>Litros Vendidos</p><p class="text-2xl">${sumaLitros.toFixed(1)} L</p>
      </div>
      <div class="p-4 bg-white rounded-lg shadow">
        <p>Días</p><p class="text-2xl">${labels.length}</p>
      </div>
      <div class="p-4 bg-white rounded-lg shadow">
        <p>Promedio Diario</p><p class="text-2xl">$${promDiario.toFixed(2)}</p>
      </div>
    </div>
    <canvas id="graficaVentasDetallado" class="mb-8"></canvas>
    <div class="overflow-x-auto">
      <table class="w-full bg-white rounded-lg shadow table-auto">
        <thead class="bg-gray-100"><tr>
          <th class="px-4 py-2">Fecha</th>
          <th class="px-4 py-2 text-right">Ventas</th>
          <th class="px-4 py-2 text-right">Litros</th>
          <th class="px-4 py-2 text-right">Total</th>
        </tr></thead>
        <tbody>
          ${labels.map(d => `
            <tr class="border-b">
              <td class="px-4 py-2">${d}</td>
              <td class="px-4 py-2 text-right">${ventasPorDia[d].ventas}</td>
              <td class="px-4 py-2 text-right">${ventasPorDia[d].litros.toFixed(1)}</td>
              <td class="px-4 py-2 text-right">$${ventasPorDia[d].total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  const ctx = document.getElementById('graficaVentasDetallado').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label:'Ventas ($)', data: totales, borderColor:'#10b981', fill:false }] }
  });
  datosReporte = { ventasPorDia };
}

// === REPORTES (2) Rendimiento Máquina ===
async function reporteRendimientoMaquina(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  const datos = {};
  maquinas.forEach(m => datos[m.serial] = { nombre: m.nombre||m.serial, total:0, ventas:0, litros:0, ultima:null });
  ventas.forEach(v => {
    if (datos[v.serial]) {
      datos[v.serial].total  += parseFloat(v.precio_total||0);
      datos[v.serial].litros += parseFloat(v.litros      ||0);
      datos[v.serial].ventas ++;
      datos[v.serial].ultima  = v.created_at;
    }
  });
  const orden = Object.entries(datos).sort((a,b)=>b[1].total - a[1].total);

  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Rendimiento Máquina</h2>
      <button onclick="mostrarModalExportar()"
              class="bg-green-500 text-white px-4 py-2 rounded-lg">
        Exportar
      </button>
    </div>
    <canvas id="graficaRendimiento" class="mb-8"></canvas>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${orden.map(([serial,d],i=>{ const dias = d.ultima ? Math.floor((new Date()-new Date(d.ultima))/(1000*60*60*24)) : '—'; return `
        <div class="p-4 bg-white rounded-lg shadow border-l-4 ${
          i===0?'border-yellow-500': i===1?'border-gray-400': i===2?'border-orange-600':'border-blue-500'
        }">
          <h3 class="font-bold mb-2">${i+1}. ${d.nombre}</h3>
          <p>Total: $${d.total.toFixed(2)}</p>
          <p>Ventas: ${d.ventas}</p>
          <p>Litros: ${d.litros.toFixed(1)} L</p>
          <p>Última venta: ${dias==='—'? '—': dias+' días'}</p>
        </div>
      `; })).join('')}
    </div>
  `;
  const ctx2 = document.getElementById('graficaRendimiento').getContext('2d');
  new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: orden.map(([s,d])=>d.nombre),
      datasets: [{ label:'Total ($)', data: orden.map(([s,d])=>d.total) }]
    }
  });
  datosReporte = { datos };
}

// === REPORTES (3) Análisis de Horarios ===
async function reporteAnalisisHorarios(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const porHora = Array(24).fill(0).map(_=>({ total:0, ventas:0 }));
  const porDia  = Array(7 ).fill(0).map(_=>({ total:0, ventas:0 }));
  ventas.forEach(v=>{
    const f = new Date(v.created_at); const h=f.getHours(), d=f.getDay();
    porHora[h].total  += parseFloat(v.precio_total||0);
    porHora[h].ventas ++;
    porDia[d].total   += parseFloat(v.precio_total||0);
    porDia[d].ventas ++;
  });
  const topHoras = porHora.map((x,i)=>({ h:i, total:x.total }))
    .sort((a,b)=>b.total - a.total).slice(0,3);
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Análisis de Horarios</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      ${topHoras.map((p,i)=>`
        <div class="p-4 text-white rounded-lg ${
          i===0?'bg-yellow-500':'bg-blue-500'
        }">
          <p class="text-3xl font-bold">${p.h}:00</p>
          <p>$${p.total.toFixed(2)} en ${porHora[p.h].ventas} ventas</p>
        </div>
      `).join('')}
    </div>
    <div class="grid lg:grid-cols-2 gap-8 mb-8">
      <canvas id="graficaHoras"></canvas>
      <canvas id="graficaDias"></canvas>
    </div>
  `;
  const ctxH = document.getElementById('graficaHoras').getContext('2d');
  new Chart(ctxH, {
    type: 'line',
    data: {
      labels: porHora.map((_,i)=>`${i}:00`),
      datasets: [{label:'Ventas', data: porHora.map(x=>x.total)}]
    }
  });
  const ctxD = document.getElementById('graficaDias').getContext('2d');
  new Chart(ctxD, {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [{label:'Ventas', data: porDia.map(x=>x.total)}]
    }
  });
  datosReporte = { porHora, porDia };
}

// === REPORTES (4) Corte de Caja ===
async function reporteCorteCaja(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  const cortes = maquinas.map(m=>{
    const desde = new Date(m.ultimo_corte||0);
    const vts = ventas.filter(v => v.serial===m.serial && new Date(v.created_at)>=desde);
    const total = vts.reduce((a,b)=>a+parseFloat(b.precio_total||0),0);
    const dias  = Math.floor((new Date()-desde)/(1000*60*60*24));
    return { nombre:m.nombre||m.serial, total, ventas:vts.length, ultimo:desde, dias,
      alerta: total>=2000?'danger': total>=1000?'warning':'ok' };
  }).sort((a,b)=>b.total-a.total);

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Estado de Cortes de Caja</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-red-50 rounded-lg"><p>Urgente</p><p class="text-red-600 text-3xl font-bold">${cortes.filter(c=>c.alerta==='danger').length}</p></div>
      <div class="p-4 bg-yellow-50 rounded-lg"><p>Próximo</p><p class="text-yellow-600 text-3xl font-bold">${cortes.filter(c=>c.alerta==='warning').length}</p></div>
      <div class="p-4 bg-gray-50 rounded-lg"><p>Total Acum.</p><p class="text-3xl font-bold">${cortes.reduce((a,c)=>a+c.total,0).toFixed(2)}</p></div>
    </div>
    <div class="space-y-4">
      ${cortes.map(c=>`
        <div class="p-4 rounded-lg bg-${c.alerta==='danger'?'red':c.alerta==='warning'?'yellow':'green'}-50 flex justify-between">
          <div>
            <h3 class="font-bold">${c.nombre}</h3>
            <p>Último corte: ${c.ultimo.toLocaleDateString('es-MX')} (${c.dias} días)</p>
            <p>${c.ventas} ventas</p>
          </div>
          <p class="text-2xl font-bold ${
            c.alerta==='danger'?'text-red-600':
            c.alerta==='warning'?'text-yellow-600':'text-green-600'
          }">$${c.total.toFixed(2)}</p>
        </div>
      `).join('')}
    </div>
  `;
  datosReporte = { cortes };
}

// === REPORTES (5) Ticket Promedio ===
async function reporteTicketPromedio(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const tp = {};
  ventas.forEach(v=>{
    const f = new Date(v.created_at).toLocaleDateString('es-MX');
    tp[f] = tp[f]||{total:0, ventas:0};
    tp[f].total  += parseFloat(v.precio_total||0);
    tp[f].ventas ++;
  });
  const fechas  = Object.keys(tp).sort();
  const valores = fechas.map(f=> tp[f].total / tp[f].ventas );
  const max     = Math.max(...valores);
  const min     = Math.min(...valores);
  const glob    = ventas.reduce((a,b)=>a+parseFloat(b.precio_total||0),0) / ventas.length;

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Ticket Promedio</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-4 gap-4 mb-8">
      <div class="p-4 bg-white rounded-lg shadow"><p>Promedio</p><p class="text-2xl">$${glob.toFixed(2)}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Máximo</p><p class="text-2xl">$${max.toFixed(2)}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Mínimo</p><p class="text-2xl">$${min.toFixed(2)}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Variación</p><p class="text-2xl">${((max-min)/min*100).toFixed(1)}%</p></div>
    </div>
    <canvas id="graficaTicket" class="mb-8"></canvas>
  `;
  const ctx5 = document.getElementById('graficaTicket').getContext('2d');
  new Chart(ctx5, {
    type: 'line',
    data: {
      labels: fechas,
      datasets: [
        { label: 'Ticket Diario', data: valores.fill, borderColor: '#10b981', fill: false },
        { label: 'Promedio Global', data: Array(fechas.length).fill(glob), borderDash: [5,5], fill: false }
      ]
    }
  });
  datosReporte = { tp, estad:{ glob, max, min } };
}

// === REPORTES (6) Proyecciones ===
async function reporteProyecciones(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const mp = {};
  ventas.forEach(v=>{
    const d = new Date(v.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    mp[key] = (mp[key]||0) + parseFloat(v.precio_total||0);
  });
  const meses  = Object.keys(mp).sort();
  const vals   = meses.map(m=>mp[m]);
  const creci  = vals.length>1 ? (vals[vals.length-1]-vals[0]) / vals.length : 0;
  const proj   = [1,2,3].map(i=> vals[vals.length-1] + creci*i);

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Ingresos y Proyecciones</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-white rounded-lg shadow"><p>Promedio Mensual</p><p class="text-2xl">$${(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Último Mes</p><p class="text-2xl">$${vals[vals.length-1].toFixed(2)}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Proyección +1</p><p class="text-2xl">$${proj[0].toFixed(2)}</p></div>
    </div>
    <canvas id="graficaProyeccion"></canvas>
  `;
  const ctx6 = document.getElementById('graficaProyeccion').getContext('2d');
  new Chart(ctx6, {
    type: 'line',
    data: {
      labels: [...meses, '+1', '+2', '+3'],
      datasets: [
        { label:'Histórico', data: [...vals, null,null,null], fill:false },
        { label:'Proyección', data: [ ...Array(vals.length-1).fill(null), vals[vals.length-1], ...proj ], borderDash:[5,5], fill:false }
      ]
    }
  });
  datosReporte = { mp, proj };
}

// === REPORTES (7) Conectividad ===
async function reporteConectividad(contenedor) {
  const { maquinas } = await obtenerDatosBase();
  const ahora = new Date();
  const estado = maquinas.map(m=>{
    const ult = new Date(m.last_seen);
    const mins= (ahora - ult)/60000;
    return {
      nombre: m.nombre||m.serial,
      ultima: ult,
      mins,
      dias: Math.floor(mins/1440),
      estado: mins<10?'online':mins<60?'warning':'offline'
    };
  });

  contenedor.innerHTML = `
    <div class="space-y-4">
      ${estado.map(e=>`
        <div class="p-4 bg-white rounded-lg shadow flex justify-between">
          <div>
            <h3 class="font-bold">${e.nombre}</h3>
            <p>Última conexión: ${e.ultima.toLocaleString('es-MX')}</p>
            ${e.estado!=='online'?`<p>Hace ${e.mins<1440?Math.floor(e.mins)+' min':e.dias+' días'}</p>`:''}
          </div>
          <span class="font-bold">${
            e.estado==='online'?'En línea':
            e.estado==='warning'?'Advertencia':'Sin conexión'
          }</span>
        </div>
      `).join('')}
    </div>
  `;
  datosReporte = { estado };
}

// === REPORTES (8) Mantenimiento Predictivo ===
async function reporteMantenimientoPredictivo(contenedor) {
  const LIT = 10000;
  const { ventas, maquinas } = await obtenerDatosBase();
  const info = maquinas.map(m=>{
    const vts = ventas.filter(v=>v.serial===m.serial);
    const vend= vts.reduce((a,b)=>a+parseFloat(b.litros||0),0);
    const uso = (vend % LIT)/LIT*100;
    const falt= LIT - (vend % LIT);
    const rec = vts.filter(v=> (new Date()-new Date(v.created_at))/(1000*60*60*24) <=30 );
    const prom= rec.reduce((a,b)=>a+parseFloat(b.litros||0),0)/30;
    const dias= prom? Math.ceil(falt/prom): 999;
    return { nombre:m.nombre||m.serial, vend, uso, falt, dias, estado: uso>90?'urgente': uso>70?'proximo':'ok' };
  }).sort((a,b)=>b.uso - a.uso);

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Mantenimiento Predictivo</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-red-50 rounded-lg"><p>Urgente</p><p class="text-red-600 text-3xl">${info.filter(i=>i.estado==='urgente').length}</p></div>
      <div class="p-4 bg-yellow-50 rounded-lg"><p>Próximo</p><p class="text-yellow-600 text-3xl">${info.filter(i=>i.estado==='proximo').length}</p></div>
      <div class="p-4 bg-gray-50 rounded-lg"><p>Intervalo</p><p class="text-3xl">${LIT.toLocaleString()} L</p></div>
    </div>
    <div class="space-y-4">
      ${info.map(i=>`
        <div class="p-4 bg-white rounded-lg shadow">
          <div class="flex justify-between">
            <h3 class="font-bold">${i.nombre}</h3>
            <span class="${i.estado==='urgente'?'text-red-600':i.estado==='proximo'?'text-yellow-600':'text-green-600'}">
              ${i.dias<999? i.dias+' días': 'Sin datos'}
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-4 mt-2">
            <div class="${i.estado==='urgente'?'bg-red-500':i.estado==='proximo'?'bg-yellow-500':'bg-green-500'} h-4 rounded-full" style="width:${i.uso}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  datosReporte = { info };
}

// === REPORTES (9) Demanda por Volumen ===
async function reporteDemandaVolumen(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const tipos  = { "20L":0, "10L":0, "5L":0, "Galón":0, "Otros":0 };
  const ingresos = { ...tipos };
  ventas.forEach(v=>{
    const l = parseFloat(v.litros), p=parseFloat(v.precio_total||0);
    if (l===20) { tipos["20L"]++; ingresos["20L"]+=p; }
    else if (l===10) { tipos["10L"]++; ingresos["10L"]+=p; }
    else if (l===5) { tipos["5L"]++; ingresos["5L"]+=p; }
    else if (l===3.785) { tipos["Galón"]++; ingresos["Galón"]+=p; }
    else { tipos["Otros"]++; ingresos["Otros"]+=p; }
  });
  const total = Object.values(tipos).reduce((a,b)=>a+b,0);
  const mayor = Object.entries(tipos).reduce((a,b)=>b[1]>a[1]?b:a)[0];

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Demanda por Volumen</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-white rounded-lg shadow"><p>Más Popular</p><p class="text-2xl">${mayor}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Total Ventas</p><p class="text-2xl">${total}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Diversidad</p><p class="text-2xl">${Object.values(tipos).filter(n=>n>0).length} tipos</p></div>
    </div>
    <div class="grid lg:grid-cols-2 gap-8 mb-8">
      <canvas id="graficaVolumenCantidad"></canvas>
      <canvas id="graficaVolumenIngresos"></canvas>
    </div>
  `;
  const ctxC = document.getElementById('graficaVolumenCantidad').getContext('2d');
  new Chart(ctxC,{ type:'doughnut', data:{ labels:Object.keys(tipos), datasets:[{ data:Object.values(tipos) }] } });
  const ctxI = document.getElementById('graficaVolumenIngresos').getContext('2d');
  new Chart(ctxI,{ type:'doughnut', data:{ labels:Object.keys(ingresos), datasets:[{ data:Object.values(ingresos) }] } });
  datosReporte = { tipos, ingresos };
}

// === REPORTES (10) Eficiencia Operativa ===
async function reporteEficienciaOperativa(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  const diasAnalisis=30, horasDia=24, horasTot=diasAnalisis*horasDia;
  const info = maquinas.map(m=>{
    const vts = ventas.filter(v=>v.serial===m.serial);
    const tiempos = vts.slice(1).map((v,i)=> (new Date(v.created_at)-new Date(vts[i].created_at))/3600000 );
    const promTiempo = tiempos.length? tiempos.reduce((a,b)=>a+b,0)/tiempos.length:0;
    const ventasPorDia = vts.length/diasAnalisis;
    const ingresosPorDia = vts.reduce((a,b)=>a+parseFloat(b.precio_total||0),0)/diasAnalisis;
    const utilizacion = Math.min((vts.length/(horasTot/8))*100,100);
    return {
      nombre:m.nombre||m.serial,
      ventasPorDia,
      ingresosPorDia,
      promTiempo,
      utilizacion,
      eficiencia: ingresosPorDia>100?'alta': ingresosPorDia>50?'media':'baja'
    };
  }).sort((a,b)=>b.ingresosPorDia-a.ingresosPorDia);

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Eficiencia Operativa</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-4 gap-4 mb-8">
      <div class="p-4 bg-green-50 rounded-lg"><p>Alta</p><p class="text-green-600 text-3xl">${info.filter(x=>x.eficiencia==='alta').length}</p></div>
      <div class="p-4 bg-yellow-50 rounded-lg"><p>Media</p><p class="text-yellow-600 text-3xl">${info.filter(x=>x.eficiencia==='media').length}</p></div>
      <div class="p-4 bg-red-50 rounded-lg"><p>Baja</p><p class="text-red-600 text-3xl">${info.filter(x=>x.eficiencia==='baja').length}</p></div>
      <div class="p-4 bg-white rounded-lg shadow"><p>Utilización Prom.</p><p class="text-2xl">${(info.reduce((a,b)=>a+b.utilizacion,0)/info.length).toFixed(1)}%</p></div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full bg-white rounded-lg shadow table-auto">
        <thead class="bg-gray-100"><tr>
          <th class="px-4 py-2">Máquina</th>
          <th class="px-4 py-2">Ventas/Día</th>
          <th class="px-4 py-2">$/Día</th>
          <th class="px-4 py-2">Tiempo Entre Ventas</th>
          <th class="px-4 py-2">Utiliz.</th>
          <th class="px-4 py-2">Estado</th>
        </tr></thead>
        <tbody>
          ${info.map(i=>`
            <tr class="border-b">
              <td class="px-4 py-2 font-bold">${i.nombre}</td>
              <td class="px-4 py-2">${i.ventasPorDia.toFixed(1)}</td>
              <td class="px-4 py-2">${i.ingresosPorDia.toFixed(2)}</td>
              <td class="px-4 py-2">${i.promTiempo.toFixed(1)}h</td>
              <td class="px-4 py-2">${i.utilizacion.toFixed(1)}%</td>
              <td class="px-4 py-2">
                <span class="px-2 py-1 rounded ${
                  i.eficiencia==='alta'?'bg-green-200 text-green-800':
                  i.eficiencia==='media'?'bg-yellow-200 text-yellow-800':
                  'bg-red-200 text-red-800'
                }">${i.eficiencia.toUpperCase()}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  datosReporte = { info };
}

// === REPORTES (11) Dashboard Ejecutivo ===
async function reporteDashboardEjecutivo(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  const hoy = new Date(), m30 = new Date(hoy), m60 = new Date(hoy);
  m30.setDate(hoy.getDate() - 30);
  m60.setDate(hoy.getDate() - 60);

  const v30 = ventas.filter(v=>new Date(v.created_at)>=m30);
  const v30a60 = ventas.filter(v=>new Date(v.created_at)>=m60 && new Date(v.created_at)<m30);
  const ing30 = v30.reduce((a,b)=>a+parseFloat(b.precio_total||0),0);
  const ing3060 = v30a60.reduce((a,b)=>a+parseFloat(b.precio_total||0),0);
  const creci = ing3060? (ing30-ing3060)/ing3060*100 : 0;
  const act = maquinas.filter(m=> (new Date()-new Date(m.last_seen))/60000 < 1440 ).length;
  const ticket = v30.length? ing30/v30.length : 0;

  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Dashboard Ejecutivo</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="p-6 bg-blue-500 text-white rounded-lg">
        <p>Ingresos 30d</p><p class="text-3xl">$${ing30.toFixed(2)}</p>
        <p>${creci>=0?'↑':'↓'} ${Math.abs(creci).toFixed(1)}%</p>
      </div>
      <div class="p-6 bg-green-500 text-white rounded-lg">
        <p>Ventas Totales</p><p class="text-3xl">${v30.length}</p>
        <p>${(v30.length/30).toFixed(1)} vent/día</p>
      </div>
      <div class="p-6 bg-purple-500 text-white rounded-lg">
        <p>Ticket Prom.</p><p class="text-3xl">$${ticket.toFixed(2)}</p>
      </div>
      <div class="p-6 bg-orange-500 text-white rounded-lg">
        <p>Máquinas Activas</p><p class="text-3xl">${act}/${maquinas.length}</p>
        <p>${((act/maquinas.length)*100).toFixed(0)}%</p>
      </div>
    </div>
    <div class="grid lg:grid-cols-2 gap-8">
      <canvas id="graficaExecIngresos"></canvas>
      <canvas id="graficaExecTop5"></canvas>
    </div>
  `;
  // Tendencia 7 días
  const ult7 = [], ing7 = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(hoy.getDate()-i);
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    const vts = v30.filter(v=> new Date(v.created_at)>=start && new Date(v.created_at)<=end);
    ult7.push(d.toLocaleDateString('es-MX',{weekday:'short',day:'numeric'}));
    ing7.push(vts.reduce((a,b)=>a+parseFloat(b.precio_total||0),0));
  }
  const ctx7 = document.getElementById('graficaExecIngresos').getContext('2d');
  new Chart(ctx7,{ type:'line', data:{ labels:ult7, datasets:[{label:'Ingresos',data:ing7,fill:true}] } });
  // Top 5 máquinas
  const agg = {};
  v30.forEach(v=> agg[v.serial]=(agg[v.serial]||0)+parseFloat(v.precio_total||0));
  const top5 = Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const ctx8 = document.getElementById('graficaExecTop5').getContext('2d');
  new Chart(ctx8,{
    type:'bar',
    data:{
      labels: top5.map(([s])=> maquinas.find(m=>m.serial===s)?.nombre||s),
      datasets: [{label:'Ingresos', data: top5.map(([_,v])=>v)}]
    }
  });
  datosReporte = { kpis:{ing30,creci,vTotal:v30.length,ticket,act}, tendencia:{ult7,ing7}, top5 };
}
