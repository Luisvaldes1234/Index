// agenda.js

// === CONEXIÓN A SUPABASE ===
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);



// Variables globales
let currentDate = new Date();
let selectedDate = null;
let editingEventId = null;
let allEvents = [];
let currentFilter = 'all';

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    await loadAllEvents();
    renderCalendar();
    setupEventListeners();
    setDefaultDate();
});

// Verificar autenticación
async function checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        console.log('Usuario no autenticado, redirigiendo...');
        window.location.href = '/login.html';
        return;
    }
    
    console.log('Usuario autenticado:', user.email);
}

// Configurar event listeners
function setupEventListeners() {
    // Botones de navegación del calendario
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Formulario rápido
    document.getElementById('btnQuickAdd').addEventListener('click', handleQuickAdd);
    
    // Modal de eventos
    document.getElementById('btnCancelEvent').addEventListener('click', closeEventModal);
    document.getElementById('eventForm').addEventListener('submit', handleEventSubmit);
    document.getElementById('btnDeleteEvent').addEventListener('click', handleDeleteEvent);
    
    // Filtros
    document.getElementById('filterAll').addEventListener('click', () => setFilter('all'));
    document.getElementById('filterAlta').addEventListener('click', () => setFilter('alta'));
    document.getElementById('filterMedia').addEventListener('click', () => setFilter('media'));
    document.getElementById('filterBaja').addEventListener('click', () => setFilter('baja'));
    
    // Logout
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    
    // Click fuera del modal para cerrar
    document.getElementById('eventModal').addEventListener('click', (e) => {
        if (e.target.id === 'eventModal') {
            closeEventModal();
        }
    });
}

// Establecer fecha por defecto
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('quickDate').value = today;
}

// Cargar todos los eventos
async function loadAllEvents() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('agenda')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        allEvents = data || [];
        renderAllEvents();
        
    } catch (error) {
        console.error('Error cargando eventos:', error);
        showNotification('Error al cargar eventos', 'error');
    }
}

// Renderizar calendario
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const calendarTitle = document.getElementById('calendarTitle');
    
    // Configurar título
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    calendarTitle.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    // Limpiar calendario
    calendar.innerHTML = '';
    
    // Headers de días
    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });
    
    // Calcular días
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Días del mes anterior
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 0);
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
        const dayElement = createDayElement(prevMonth.getDate() - i, true);
        calendar.appendChild(dayElement);
    }
    
    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = createDayElement(day, false);
        calendar.appendChild(dayElement);
    }
    
    // Días del mes siguiente
    const remainingCells = 42 - (firstDayWeekday + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createDayElement(day, true);
        calendar.appendChild(dayElement);
    }
}

// Crear elemento de día
function createDayElement(day, isOtherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayElement.classList.add('other-month');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);
    
    // Verificar si es hoy
    const today = new Date();
    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    if (!isOtherMonth && 
        cellDate.getDate() === today.getDate() &&
        cellDate.getMonth() === today.getMonth() &&
        cellDate.getFullYear() === today.getFullYear()) {
        dayElement.classList.add('today');
    }
    
    // Verificar eventos del día
    if (!isOtherMonth) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = allEvents.filter(event => event.date === dateStr);
        
        if (dayEvents.length > 0) {
            dayElement.classList.add('has-events');
            
            // Mostrar preview de eventos
            dayEvents.slice(0, 2).forEach(event => {
                const eventPreview = document.createElement('div');
                eventPreview.className = 'event-preview';
                eventPreview.textContent = event.title;
                dayElement.appendChild(eventPreview);
            });
            
            if (dayEvents.length > 2) {
                const moreEvents = document.createElement('div');
                moreEvents.className = 'event-preview';
                moreEvents.textContent = `+${dayEvents.length - 2} más`;
                dayElement.appendChild(moreEvents);
            }
        }
        
        // Click handler
        dayElement.addEventListener('click', () => {
            selectDate(dateStr);
        });
        
        // Doble click para crear evento
        dayElement.addEventListener('dblclick', () => {
            openEventModal(dateStr);
        });
    }
    
    return dayElement;
}

// Seleccionar fecha
function selectDate(dateStr) {
    // Remover selección anterior
    document.querySelectorAll('.calendar-day.selected').forEach(day => {
        day.classList.remove('selected');
    });
    
    // Seleccionar nueva fecha
    event.target.closest('.calendar-day').classList.add('selected');
    selectedDate = dateStr;
    
    // Mostrar eventos del día
    showSelectedDateEvents(dateStr);
}

// Mostrar eventos de la fecha seleccionada
function showSelectedDateEvents(dateStr) {
    const container = document.getElementById('selectedDateEvents');
    const title = document.getElementById('selectedDateTitle');
    const eventsList = document.getElementById('eventsList');
    
    const dayEvents = allEvents.filter(event => event.date === dateStr);
    
    if (dayEvents.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    title.textContent = `📋 Eventos del ${formattedDate}`;
    
    eventsList.innerHTML = '';
    dayEvents.forEach(event => {
        const eventElement = createEventElement(event);
        eventsList.appendChild(eventElement);
    });
    
    container.classList.remove('hidden');
}

// Crear elemento de evento
function createEventElement(event) {
    const eventElement = document.createElement('div');
    eventElement.className = `event-item priority-${event.priority}`;
    
    const priorityEmoji = {
        'alta': '🔴',
        'media': '🟡',
        'baja': '🟢'
    };
    
    const categoryEmoji = {
        'mantenimiento': '🔧',
        'visita': '🚶',
        'reunion': '👥',
        'recordatorio': '⏰',
        'otro': '📌'
    };
    
    const timeStr = event.time ? ` - ${event.time}` : '';
    
    eventElement.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <h4 class="font-bold text-lg mb-1">
                    ${priorityEmoji[event.priority]} ${event.title}
                </h4>
                <p class="text-gray-600 mb-2">
                    ${categoryEmoji[event.category]} ${event.category.charAt(0).toUpperCase() + event.category.slice(1)}${timeStr}
                </p>
                ${event.description ? `<p class="text-gray-700">${event.description}</p>` : ''}
            </div>
            <div class="flex gap-2 ml-4">
                <button onclick="editEvent('${event.id}')" class="text-blue-600 hover:text-blue-800">
                    ✏️
                </button>
                <button onclick="deleteEventConfirm('${event.id}')" class="text-red-600 hover:text-red-800">
                    🗑️
                </button>
            </div>
        </div>
    `;
    
    return eventElement;
}

// Agregar evento rápido
async function handleQuickAdd() {
    const date = document.getElementById('quickDate').value;
    const title = document.getElementById('quickTitle').value;
    const priority = document.getElementById('quickPriority').value;
    
    if (!date || !title) {
        showNotification('Por favor completa fecha y título', 'error');
        return;
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('agenda')
            .insert([{
                user_id: user.id,
                date: date,
                title: title,
                priority: priority,
                category: 'otro'
            }])
            .select();
        
        if (error) throw error;
        
        // Limpiar formulario
        document.getElementById('quickTitle').value = '';
        document.getElementById('quickPriority').value = 'baja';
        
        // Recargar eventos
        await loadAllEvents();
        renderCalendar();
        
        showNotification('Evento agregado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error agregando evento:', error);
        showNotification('Error al agregar evento', 'error');
    }
}

// Abrir modal de evento
function openEventModal(date = null, eventData = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const deleteBtn = document.getElementById('btnDeleteEvent');
    
    // Resetear formulario
    form.reset();
    editingEventId = null;
    
    if (eventData) {
        // Modo edición
        document.getElementById('eventDate').value = eventData.date;
        document.getElementById('eventTime').value = eventData.time || '';
        document.getElementById('eventTitle').value = eventData.title;
        document.getElementById('eventDescription').value = eventData.description || '';
        document.getElementById('eventCategory').value = eventData.category;
        document.getElementById('eventPriority').value = eventData.priority;
        
        editingEventId = eventData.id;
        deleteBtn.classList.remove('hidden');
    } else {
        // Modo creación
        if (date) {
            document.getElementById('eventDate').value = date;
        }
        deleteBtn.classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
}

// Cerrar modal
function closeEventModal() {
    document.getElementById('eventModal').classList.add('hidden');
    editingEventId = null;
}

// Manejar envío del formulario
async function handleEventSubmit(e) {
    e.preventDefault();
    
    const formData = {
        date: document.getElementById('eventDate').value,
        time: document.getElementById('eventTime').value || null,
        title: document.getElementById('eventTitle').value,
        description: document.getElementById('eventDescription').value || null,
        category: document.getElementById('eventCategory').value,
        priority: document.getElementById('eventPriority').value
    };
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (editingEventId) {
            // Actualizar evento existente
            const { error } = await supabase
                .from('agenda')
                .update(formData)
                .eq('id', editingEventId)
                .eq('user_id', user.id);
            
            if (error) throw error;
            showNotification('Evento actualizado exitosamente', 'success');
        } else {
            // Crear nuevo evento
            const { error } = await supabase
                .from('agenda')
                .insert([{
                    ...formData,
                    user_id: user.id
                }]);
            
            if (error) throw error;
            showNotification('Evento creado exitosamente', 'success');
        }
        
        closeEventModal();
        await loadAllEvents();
        renderCalendar();
        
    } catch (error) {
        console.error('Error guardando evento:', error);
        showNotification('Error al guardar evento', 'error');
    }
}

// Editar evento
function editEvent(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (event) {
        openEventModal(null, event);
    }
}

// Eliminar evento
async function handleDeleteEvent() {
    if (!editingEventId) return;
    
    if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) {
        return;
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
            .from('agenda')
            .delete()
            .eq('id', editingEventId)
            .eq('user_id', user.id);
        
        if (error) throw error;
        
        closeEventModal();
        await loadAllEvents();
        renderCalendar();
        
        showNotification('Evento eliminado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error eliminando evento:', error);
        showNotification('Error al eliminar evento', 'error');
    }
}

// Confirmar eliminación desde la lista
function deleteEventConfirm(eventId) {
    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
        deleteEventById(eventId);
    }
}

// Eliminar evento por ID
async function deleteEventById(eventId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
            .from('agenda')
            .delete()
            .eq('id', eventId)
            .eq('user_id', user.id);
        
        if (error) throw error;
        
        await loadAllEvents();
        renderCalendar();
        
        showNotification('Evento eliminado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error eliminando evento:', error);
        showNotification('Error al eliminar evento', 'error');
    }
}

// Establecer filtro
function setFilter(filter) {
    currentFilter = filter;
    
    // Actualizar botones
    document.querySelectorAll('[id^="filter"]').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`).classList.add('active');
    
    renderAllEvents();
}

// Renderizar todos los eventos
function renderAllEvents() {
    const container = document.getElementById('allEventsList');
    
    let filteredEvents = allEvents;
    if (currentFilter !== 'all') {
        filteredEvents = allEvents.filter(event => event.priority === currentFilter);
    }
    
    if (filteredEvents.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No hay eventos para mostrar</p>';
        return;
    }
    
    container.innerHTML = '';
    filteredEvents.forEach(event => {
        const eventElement = createEventElement(event);
        container.appendChild(eventElement);
    });
}

// Logout
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
}

// Mostrar notificación
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 transition-all duration-300 transform translate-x-full`;
    
    // Colores según el tipo
    const colors = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'info': 'bg-blue-500',
        'warning': 'bg-yellow-500'
    };
    
    notification.classList.add(colors[type] || colors.info);
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animación de entrada
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Funciones globales para usar en onclick
window.editEvent = editEvent;
window.deleteEventConfirm = deleteEventConfirm;
