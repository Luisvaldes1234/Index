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

  // Fechas por defecto
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setMonth(haceUnMes.getMonth() - 1);
  document.getElementById("fechaDesde").value = haceUnMes.toISOString().split("T")[0];
  document.getElementById("fechaHasta").value = hoy.toISOString().split("T")[0];

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
  // Aplicar filtros
  document.getElementById("btnAplicarFiltros").addEventListener("click", () => {
    if (reporteActual) mostrarReporte(reporteActual);
  });
  // Logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
  });
}

// === UTILIDADES ===
function mostrarLoading(show = true) {
  document.getElementById("loading").classList.toggle("hidden", !show);
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
      case 'ventasDetallado':
        await reporteVentasDetallado(cont);
        break;
      case 'rendimientoMaquina':
        await reporteRendimientoMaquina(cont);
        break;
      case 'analisisHorarios':
        await reporteAnalisisHorarios(cont);
        break;
      case 'corteCaja':
        await reporteCorteCaja(cont);
        break;
      case 'ticketPromedio':
        await reporteTicketPromedio(cont);
        break;
      case 'proyecciones':
        await reporteProyecciones(cont);
        break;
      case 'conectividad':
        await reporteConectividad(cont);
        break;
      case 'mantenimientoPredictivo':
        await reporteMantenimientoPredictivo(cont);
        break;
      case 'demandaVolumen':
        await reporteDemandaVolumen(cont);
        break;
      case 'eficienciaOperativa':
        await reporteEficienciaOperativa(cont);
        break;
      case 'dashboardEjecutivo':
        await reporteDashboardEjecutivo(cont);
        break;
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

// === REPORTES ===

// Ventas Detallado
async function reporteVentasDetallado(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const ventasPorDia = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString('es-MX');
    ventasPorDia[fecha] = ventasPorDia[fecha] || { total:0, litros:0, ventas:0 };
    ventasPorDia[fecha].total += parseFloat(v.precio_total || 0);
    ventasPorDia[fecha].litros += parseFloat(v.litros || 0);
    ventasPorDia[fecha].ventas += 1;
  });
  const labels = Object.keys(ventasPorDia).sort();
  const totales = labels.map(d => ventasPorDia[d].total);
  const litros = labels.map(d => ventasPorDia[d].litros);
  const totalVentas = totales.reduce((a,b)=>a+b,0);
  const totalLitros = litros.reduce((a,b)=>a+b,0);
  const promedioVentas = totalVentas / labels.length;

  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Reporte de Ventas Detallado</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p>Total Vendido</p>
        <p class="text-2xl font-bold">$${totalVentas.toFixed(2)}</p>
      </div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p>Litros Vendidos</p>
        <p class="text-2xl font-bold">${totalLitros.toFixed(1)} L</p>
      </div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p>Días</p>
        <p class="text-2xl font-bold">${labels.length}</p>
      </div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p>Promedio Diario</p>
        <p class="text-2xl font-bold">$${promedioVentas.toFixed(2)}</p>
      </div>
    </div>
    <div class="mb-8">
      <canvas id="graficaVentasDetallado"></canvas>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full bg-white dark:bg-gray-800 rounded-lg shadow table-auto">
        <thead class="bg-gray-100 dark:bg-gray-700">
          <tr>
            <th class="px-4 py-2">Fecha</th>
            <th class="px-4 py-2 text-right">Ventas</th>
            <th class="px-4 py-2 text-right">Litros</th>
            <th class="px-4 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${labels.map(d => `
            <tr class="border-b border-gray-200 dark:border-gray-700">
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

  const ctx1 = document.getElementById('graficaVentasDetallado').getContext('2d');
  new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Ventas ($)', data: totales, borderColor: '#10b981', fill: false }]
    }
  });

  datosReporte = { ventasPorDia };
}

// Rendimiento Máquina
async function reporteRendimientoMaquina(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  const ventasPorMaquina = {};
  maquinas.forEach(m => {
    ventasPorMaquina[m.serial] = { nombre: m.nombre||m.serial, total:0, litros:0, ventas:0, ultimaVenta:null };
  });
  ventas.forEach(v => {
    if (ventasPorMaquina[v.serial]) {
      ventasPorMaquina[v.serial].total += parseFloat(v.precio_total||0);
      ventasPorMaquina[v.serial].litros += parseFloat(v.litros||0);
      ventasPorMaquina[v.serial].ventas +=1;
      ventasPorMaquina[v.serial].ultimaVenta = v.created_at;
    }
  });
  const ordenadas = Object.entries(ventasPorMaquina).sort((a,b)=>b[1].total-a[1].total);

  contenedor.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Rendimiento por Máquina</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="mb-8">
      <canvas id="graficaRendimiento"></canvas>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${ordenadas.map(([serial,data],i)=>{
        const dias = data.ultimaVenta?Math.floor((new Date()-new Date(data.ultimaVenta))/(1000*60*60*24)):999;
        const color = dias>7?'text-red-600':'text-green-600';
        return `
          <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 ${i===0?'border-yellow-500':i===1?'border-gray-400':i===2?'border-orange-600':'border-blue-500'}">
            <h3 class="font-bold mb-2">${i+1}. ${data.nombre}</h3>
            <p>Total: $${data.total.toFixed(2)}</p>
            <p>Ventas: ${data.ventas}</p>
            <p>Litros: ${data.litros.toFixed(1)} L</p>
            <p class="${color}">Última venta: hace ${dias} días</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
  const ctx2 = document.getElementById('graficaRendimiento').getContext('2d');
  new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ordenadas.slice(0,10).map(([_,d])=>d.nombre),
      datasets: [{ label:'Ventas Totales', data: ordenadas.slice(0,10).map(([_,d])=>d.total) }]
    }
  });
  datosReporte = { ventasPorMaquina, ordenadas };
}

// Análisis Horarios
async function reporteAnalisisHorarios(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const ventasPorHora = Array(24).fill(null).map(()=>({total:0,ventas:0}));
  const ventasDiaSemana = Array(7).fill(null).map(()=>({total:0,ventas:0}));
  ventas.forEach(v=>{
    const f=new Date(v.created_at);
    ventasPorHora[f.getHours()].total+=parseFloat(v.precio_total||0);
    ventasPorHora[f.getHours()].ventas++;
    ventasDiaSemana[f.getDay()].total+=parseFloat(v.precio_total||0);
    ventasDiaSemana[f.getDay()].ventas++;
  });
  const picoHoras = ventasPorHora.map((d,h)=>({h,d: d.total}))
    .sort((a,b)=>b.d-a.d).slice(0,3);
  const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  contenedor.innerHTML = `
    <div class="flex justify-between mb-6">
      <h2 class="text-2xl font-bold">Análisis de Horarios</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      ${picoHoras.map((p,i)=>`<div class="p-4 rounded-lg text-white ${i===0?'bg-yellow-500':'bg-blue-500'}">
        <p class="text-3xl font-bold">${p.h}:00</p>
        <p>${p.d.toFixed(2)} en ${ventasPorHora[p.h].ventas} ventas</p>
      </div>`).join('')}
    </div>
    <div class="grid lg:grid-cols-2 gap-8 mb-8">
      <div><canvas id="graficaHoras"></canvas></div>
      <div><canvas id="graficaDias"></canvas></div>
    </div>
    <div class="p-6 bg-blue-50 dark:bg-blue-900 rounded-lg">
      <h3 class="font-bold mb-2">Recomendaciones</h3>
      <ul class="list-disc list-inside">
        <li>Promocionar en horas de baja demanda.</li>
        <li>J**ueves** es el día con más ventas.</li>
      </ul>
    </div>
  `;
  const ctxH = document.getElementById('graficaHoras').getContext('2d');
  new Chart(ctxH,{type:'line',data:{labels:ventasPorHora.map((_,i)=>`${i}:00`),datasets:[{label:'Ventas',data:ventasPorHora.map(d=>d.total)}]}});
  const ctxD = document.getElementById('graficaDias').getContext('2d');
  new Chart(ctxD,{type:'bar',data:{labels:dias,datasets:[{label:'Ventas',data:ventasDiaSemana.map(d=>d.total)}]}});
  datosReporte={ventasPorHora,ventasDiaSemana};
}

// Corte Caja
async function reporteCorteCaja(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase();
  const cortes = maquinas.map(m=>{
    const desde = new Date(m.ultimo_corte||'2000-01-01');
    const vts = ventas.filter(v=>v.serial===m.serial && new Date(v.created_at)>=desde);
    const total=vts.reduce((a,b)=>a+parseFloat(b.precio_total||0),0);
    const dias=Math.floor((new Date()-desde)/(1000*60*60*24));
    return {nombre:m.nombre||m.serial,total,ventas:vts.length,ultimo:desde,dias,alerta: total>=2000?'danger':total>=1000?'warning':'ok'};
  }).sort((a,b)=>b.total-a.total);
  contenedor.innerHTML=`
    <div class="flex justify-between mb-6">
      <h2 class="font-bold text-2xl">Estado de Cortes de Caja</h2>
      <button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button>
    </div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-red-50 dark:bg-red-900 rounded-lg"><p>Urgente</p><p class="text-red-600 text-3xl font-bold">${cortes.filter(c=>c.alerta==='danger').length}</p></div>
      <div class="p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg"><p>Próximo</p><p class="text-yellow-600 text-3xl font-bold">${cortes.filter(c=>c.alerta==='warning').length}</p></div>
      <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"><p>Total Acum.</p><p class="text-3xl font-bold">${cortes.reduce((a,c)=>a+c.total,0).toFixed(2)}</p></div>
    </div>
    <div class="space-y-4">
      ${cortes.map(c=>`<div class="p-4 rounded-lg bg-${c.alerta==='danger'?'red':c.alerta==='warning'?'yellow':'green'}-100 dark:bg-${c.alerta==='danger'?'red':c.alerta==='warning'?'yellow':'green'}-900 flex justify-between"><div><h3 class="font-bold">${c.nombre}</h3><p>Último corte: ${c.ultimo.toLocaleDateString('es-MX')} (${c.dias} días)</p><p>${c.ventas} ventas</p></div><div><p class="font-bold text-2xl ${c.alerta==='danger'?'text-red-600':c.alerta==='warning'?'text-yellow-600':'text-green-600'}">${c.total.toFixed(2)}</p></div></div>`).join('')}
    </div>
  `;
  datosReporte={cortes};
}

// Ticket Promedio
async function reporteTicketPromedio(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const tp = {};
  ventas.forEach(v=>{
    const f=new Date(v.created_at).toLocaleDateString('es-MX');
    tp[f]=tp[f]||{total:0,ventas:0};
    tp[f].total+=parseFloat(v.precio_total||0);
    tp[f].ventas++;
  });
  const fechas=Object.keys(tp).sort();
  const tickets=fechas.map(f=>tp[f].total/tp[f].ventas);
  const max=Math.max(...tickets), min=Math.min(...tickets);
  const glob=ventas.reduce((a,b)=>a+parseFloat(b.precio_total||0),0)/ventas.length;
  contenedor.innerHTML=`
    <div class="flex justify-between mb-6"><h2 class="text-2xl font-bold">Ticket Promedio</h2><button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button></div>
    <div class="grid md:grid-cols-4 gap-4 mb-8">${[['Promedio',glob],['Máximo',max],['Mínimo',min],['Variación',((max-min)/min*100)]].map(([lbl, val])=>`<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><p>${lbl}</p><p class="text-2xl font-bold">${typeof val==='number'?val.toFixed(lbl==='Variación'?1:2)+'':val}</p></div>`).join('')}</div>
    <canvas id="graficaTicket"></canvas>
  `;
  const ctx3=document.getElementById('graficaTicket').getContext('2d');
  new Chart(ctx3,{type:'line',data:{labels:fechas,datasets:[{label:'Ticket',data:tickets},{label:'Global',data:Array(fechas.length).fill(glob),borderDash:[5,5]}]}});
  datosReporte={tp,estad:{glob,max,min}};
}

// Ingresos y Proyecciones
async function reporteProyecciones(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const vp = {}; ventas.forEach(v=>{const m=new Date(v.created_at), key=`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`; vp[key]=(vp[key]||0)+parseFloat(v.precio_total||0);});
  const meses=Object.keys(vp).sort(), vals=meses.map(m=>vp[m]);
  const crecimiento=vals.length>1?(vals[vals.length-1]-vals[0])/vals.length:0; const proj=[];for(let i=1;i<=3;i++)proj.push(vals[vals.length-1]+crecimiento*i);
  contenedor.innerHTML=`
    <div class="flex justify-between mb-6"><h2 class="text-2xl font-bold">Ingresos y Proyecciones</h2><button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button></div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">${[['Promedio',vals.reduce((a,b)=>a+b,0)/vals.length],['Último',vals[vals.length-1]],['Proyección',proj[0]]].map(([lbl,v])=>`<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><p>${lbl}</p><p class="text-2xl font-bold">${v.toFixed(2)}</p></div>`).join('')}</div>
    <canvas id="graficaProyeccion"></canvas>
  `;
  const ctx4=document.getElementById('graficaProyeccion').getContext('2d');
  new Chart(ctx4,{type:'line',data:{labels:[...meses,'+1','+2','+3'],datasets:[{label:'Histórico',data:[...vals,null,null,null]},{label:'Proyección',data:[...Array(vals.length-1).fill(null),vals[vals.length-1],...proj],borderDash:[5,5]}]}});
  datosReporte={vp,proj};
}

// Conectividad
async function reporteConectividad(contenedor) {
  const { ventas, maquinas } = await obtenerDatosBase(); // ventas no usada pero mantenida
  const ahora = new Date();
  const estadoConexion = maquinas.map(m => {
    const ultima = new Date(m.last_seen);
    const minDesc = (ahora - ultima)/60000;
    return { nombre:m.nombre||m.serial, ultimaConexion:ultima, minutos: minDesc, dias:Math.floor(minDesc/1440), estado: minDesc<10?'online':minDesc<60?'warning':'offline' };
  });
  contenedor.innerHTML = `
    <div class="space-y-4">
      ${estadoConexion.map(e=>`
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg flex justify-between">
          <div>
            <h3 class="font-bold">${e.nombre}</h3>
            <p>Última conexión: ${e.ultimaConexion.toLocaleString('es-MX')}</p>
            ${e.estado!=='online'?`<p>Hace ${e.minutos<1440?Math.floor(e.minutos)+' min':e.dias+' días'}</p>`:''}
          </div>
          <div><span class="font-bold">${e.estado==='online'?'En línea':e.estado==='warning'?'Advertencia':'Sin conexión'}</span></div>
        </div>
      `).join('')}
    </div>
  `;
  datosReporte={estadoConexion};
}

// Mantenimiento Predictivo
async function reporteMantenimientoPredictivo(contenedor) {
  const LIT=10000;
  const { ventas, maquinas } = await obtenerDatosBase();
  const info = maquinas.map(m=>{
    const vts=ventas.filter(v=>v.serial===m.serial);
    const vend=vts.reduce((a,b)=>a+parseFloat(b.litros||0),0);
    const uso=(vend%LIT)/LIT*100;
    const falt=LIT-(vend%LIT);
    const recientes=vts.filter(v=> (new Date()-new Date(v.created_at))/(1000*60*60*24)<=30 );
    const promDia=recientes.reduce((a,b)=>a+parseFloat(b.litros||0),0)/30;
    const dias= promDia?Math.ceil(falt/promDia):999;
    return { nombre:m.nombre||m.serial, vend, uso, falt, dias, estado:uso>90?'urgente':uso>70?'proximo':'ok' };
  }).sort((a,b)=>b.uso-a.uso);
  contenedor.innerHTML=`
    <div class="flex justify-between mb-6"><h2 class="text-2xl font-bold">Mantenimiento Predictivo</h2><button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button></div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-red-50 dark:bg-red-900 rounded-lg"><p>Urgente</p><p class="text-red-600 text-3xl font-bold">${info.filter(i=>i.estado==='urgente').length}</p></div>
      <div class="p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg"><p>Próximo</p><p class="text-yellow-600 text-3xl font-bold">${info.filter(i=>i.estado==='proximo').length}</p></div>
      <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"><p>Intervalo</p><p class="text-3xl font-bold">${LIT.toLocaleString()} L</p></div>
    </div>
    <div class="space-y-4">
      ${info.map(i=>`
        <div class="p-4 bg-white dark:bg-gray-800 rounded-lg">
          <div class="flex justify-between"><h3 class="font-bold">${i.nombre}</h3><span class="${i.estado==='urgente'?'text-red-600':i.estado==='proximo'?'text-yellow-600':'text-green-600'}">${i.dias<999?i.dias+' días':'Sin datos'}</span></div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mt-2"><div class="${i.estado==='urgente'?'bg-red-500':i.estado==='proximo'?'bg-yellow-500':'bg-green-500'} h-4 rounded-full" style="width:${i.uso}%"></div></div>
        </div>
      `).join('')}
    </div>
  `;
  datosReporte={mantenimientoPredictivo:info};
}

// Demanda Volumen
async function reporteDemandaVolumen(contenedor) {
  const { ventas } = await obtenerDatosBase();
  const tipos={"20L":0,"10L":0,"5L":0,"Galón":0,"Otros":0};
  const ingresos={"20L":0,"10L":0,"5L":0,"Galón":0,"Otros":0};
  ventas.forEach(v=>{const l=parseFloat(v.litros);const p=parseFloat(v.precio_total||0);
    if(l===20){tipos['20L']++;ingresos['20L']+=p;}else if(l===10){tipos['10L']++;ingresos['10L']+=p;}else if(l===5){tipos['5L']++;ingresos['5L']+=p;}else if(l===3.785){tipos['Galón']++;ingresos['Galón']+=p;}else{tipos['Otros']++;ingresos['Otros']+=p;}
  });
  const total=Object.values(tipos).reduce((a,b)=>a+b,0);
  const mayor=Object.entries(tipos).reduce((a,b)=>b[1]>a[1]?b:a)[0];
  contenedor.innerHTML=`
    <div class="flex justify-between mb-6"><h2 class="text-2xl font-bold">Demanda por Volumen</h2><button onclick="mostrarModalExportar()" class="bg-green-500 text-white px-4 py-2 rounded-lg">Exportar</button></div>
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><p>Más Popular</p><p class="text-2xl font-bold">${mayor}</p></div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><p>Total Ventas</p><p class="text-2xl font-bold">${total}</p></div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><p>Diversidad</p><p class="text-2xl font-bold">${Object.values(tipos).filter(v=>v>0).length} tipos</p></div>
    </div>
    <div class="grid lg:grid-cols-2 gap-8 mb-8">...`
