// agenda.js

// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

class AgendaManager {
  constructor() {
    this.events = [];
    this.currentDate = new Date();
    this.selectedDate = null;
    this.editingEventId = null;
    this.user = null;
    this.init();
  }

  async init() {
    // Autenticación: obtén usuario
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Error obteniendo sesión:', sessionError);
      return;
    }
    this.user = session?.user;
    if (!this.user) {
      // Redirige a login si no hay usuario
      window.location.href = '/login.html';
      return;
    }

    // Carga eventos desde Supabase
    await this.fetchEvents();

    // Inicializa UI
    this.setupEventListeners();
    this.renderCalendar();
    this.renderAllEvents();
    this.setTodayAsDefault();
  }

  async fetchEvents() {
    const { data, error } = await supabase
      .from('agenda')
      .select('*')
      .eq('user_id', this.user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('Error fetch eventos:', error);
      this.events = [];
    } else {
      this.events = data;
    }
  }

  setupEventListeners() {
    document.getElementById('prevMonth').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendar();
    });

    document.getElementById('btnQuickAdd').addEventListener('click', () => this.quickAddEvent());

    document.getElementById('eventForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEvent();
    });

    document.getElementById('btnCancelEvent').addEventListener('click', () => this.closeModal());
    document.getElementById('btnDeleteEvent').addEventListener('click', () => this.deleteEvent());

    document.getElementById('filterAll').addEventListener('click', () => this.filterEvents('all'));
    document.getElementById('filterAlta').addEventListener('click', () => this.filterEvents('alta'));
    document.getElementById('filterMedia').addEventListener('click', () => this.filterEvents('media'));
    document.getElementById('filterBaja').addEventListener('click', () => this.filterEvents('baja'));

    document.getElementById('quickDate').value = new Date().toISOString().split('T')[0];
  }

  setTodayAsDefault() {
    document.getElementById('quickDate').value = new Date().toISOString().split('T')[0];
  }

  renderCalendar() {
    const calendar = document.getElementById('calendar');
    const calendarTitle = document.getElementById('calendarTitle');
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    calendarTitle.textContent = this.currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
    calendar.innerHTML = '';

    // Encabezados de días
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    dias.forEach(d => {
      const div = document.createElement('div');
      div.className = 'calendar-day-header';
      div.textContent = d;
      calendar.appendChild(div);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    // Mes anterior
    for (let i = firstDay; i>0; i--) {
      calendar.appendChild(this.createDayElement(prevDays - i + 1, true, new Date(year, month-1, prevDays-i+1)));
    }
    // Mes actual
    for (let d=1; d<=daysInMonth; d++) {
      calendar.appendChild(this.createDayElement(d, false, new Date(year, month, d)));
    }
    // Mes siguiente para completar 6 filas
    const totalCells = calendar.children.length - 7;
    for (let i=1; i<=42 - totalCells; i++) {
      calendar.appendChild(this.createDayElement(i, true, new Date(year, month+1, i)));
    }
  }

  createDayElement(day, other, date) {
    const div = document.createElement('div');
    div.className = 'calendar-day' + (other ? ' other-month' : '');
    if (date.toDateString() === new Date().toDateString()) div.classList.add('today');
    if (this.selectedDate && date.toDateString() === this.selectedDate.toDateString()) div.classList.add('selected');

    const num = document.createElement('div');
    num.className = 'day-number'; num.textContent = day;
    div.appendChild(num);

    // Eventos del día
    const dateStr = date.toISOString().split('T')[0];
    const eventos = this.events.filter(e => e.date === dateStr);
    if (eventos.length) {
      div.classList.add('has-events');
      const indicator = document.createElement('div'); indicator.className='event-indicator'; div.appendChild(indicator);
      eventos.slice(0,2).forEach(ev => {
        const p = document.createElement('div'); p.className='event-preview'; p.textContent=ev.title; div.appendChild(p);
      });
      if (eventos.length>2) {
        const more = document.createElement('div'); more.className='event-preview'; more.textContent=`+${eventos.length-2} más`; div.appendChild(more);
      }
    }

    div.addEventListener('click', () => {
      document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      this.selectedDate = date;
      this.showSelectedDateEvents(date);
    });
    div.addEventListener('dblclick', () => this.openModal(date));
    return div;
  }

  showSelectedDateEvents(date) {
    const sec = document.getElementById('selectedDateEvents');
    const title = document.getElementById('selectedDateTitle');
    const list = document.getElementById('eventsList');
    const ds = date.toISOString().split('T')[0];
    const dayEv = this.events.filter(e => e.date === ds);
    title.textContent = `📋 Eventos del ${date.toLocaleDateString('es-MX',{ weekday:'long', year:'numeric', month:'long', day:'numeric'})}`;
    if (!dayEv.length) {
      list.innerHTML = `<div class="text-center py-8 text-gray-500"><p class="text-lg mb-4">📅 No hay eventos</p><button class="modern-button" onclick="agendaManager.openModal(new Date('${ds}'))">➕ Agregar</button></div>`;
    } else {
      list.innerHTML = dayEv.map(ev => this.renderEventItem(ev)).join('');
    }
    sec.classList.remove('hidden');
  }

  async quickAddEvent() {
    const date = document.getElementById('quickDate').value;
    const title = document.getElementById('quickTitle').value.trim();
    const priority = document.getElementById('quickPriority').value;
    if (!date||!title) return alert('Completa fecha y título');

    const { data, error } = await supabase.from('agenda').insert([{ user_id:this.user.id, date, time:'', title, description:'', category:'recordatorio', priority }]).select();
    if (error) return console.error(error);
    this.events.push(data[0]);
    this.renderCalendar(); this.renderAllEvents();
    document.getElementById('quickTitle').value=''; document.getElementById('quickPriority').value='baja';
  }

  openModal(date=null, event=null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const deleteBtn = document.getElementById('btnDeleteEvent');
    form.reset(); this.editingEventId = null;
    if (event) {
      this.editingEventId = event.id;
      form.querySelector('#eventDate').value=event.date;
      form.querySelector('#eventTime').value=event.time;
      form.querySelector('#eventTitle').value=event.title;
      form.querySelector('#eventDescription').value=event.description;
      form.querySelector('#eventCategory').value=event.category;
      form.querySelector('#eventPriority').value=event.priority;
      deleteBtn.classList.remove('hidden');
    } else if (date) {
      form.querySelector('#eventDate').value=date.toISOString().split('T')[0];
      deleteBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('eventModal').classList.add('hidden');
  }

  async saveEvent() {
    const form = document.getElementById('eventForm');
    const ev = {
      date: form.querySelector('#eventDate').value,
      time: form.querySelector('#eventTime').value,
      title: form.querySelector('#eventTitle').value,
      description: form.querySelector('#eventDescription').value,
      category: form.querySelector('#eventCategory').value,
      priority: form.querySelector('#eventPriority').value
    };
    if (this.editingEventId) {
      const { data, error } = await supabase.from('agenda').update(ev).eq('id', this.editingEventId).select();
      if (error) return console.error(error);
      const idx = this.events.findIndex(e=>e.id===this.editingEventId);
      this.events[idx] = data[0];
    } else {
      const { data, error } = await supabase.from('agenda').insert([{ user_id:this.user.id, ...ev }]).select();
      if (error) return console.error(error);
      this.events.push(data[0]);
    }
    this.renderCalendar(); this.renderAllEvents(); this.closeModal();
  }

  async deleteEvent() {
    if (!this.editingEventId) return;
    const { error } = await supabase.from('agenda').delete().eq('id', this.editingEventId);
    if (error) return console.error(error);
    this.events = this.events.filter(e=>e.id!==this.editingEventId);
    this.renderCalendar(); this.renderAllEvents(); this.closeModal();
  }

  renderAllEvents() {
    const list = document.getElementById('allEventsList');
    if (!list) return;
    list.innerHTML = this.events.map(ev => this.renderEventItem(ev)).join('');
  }

  filterEvents(priority) {
    const filtered = priority==='all' ? this.events : this.events.filter(e=>e.priority===priority);
    document.getElementById('allEventsList').innerHTML = filtered.map(ev => this.renderEventItem(ev)).join('');
  }

  renderEventItem(event) {
    return `<div class="event-item priority-${event.priority}">
      <div class="event-title">${event.title}</div>
      <div class="event-date">${event.date} ${event.time||''}</div>
      <div class="event-description">${event.description||'(Sin descripción)'}</div>
      <div class="event-actions">
        <button class="modern-button btn-small" onclick='agendaManager.openModal(null, ${JSON.stringify(event).replace(/'/g,'\\'')} )'>✏️ Editar</button>
      </div>
    </div>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.agendaManager = new AgendaManager();
});
