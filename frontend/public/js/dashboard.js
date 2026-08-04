let currentUser = null;
let allEvents = [];
let myRegistrationIds = new Set();
let currentViewMode = 'card'; // 'card' or 'list'
let currentActiveSection = null;

function setViewMode(mode) {
    currentViewMode = mode;

    // Update Toggle UI
    const listBtn = document.getElementById('view-list-btn');
    const cardBtn = document.getElementById('view-card-btn');

    if (listBtn && cardBtn) {
        if (mode === 'list') {
            listBtn.style.background = 'var(--primary)';
            listBtn.style.color = 'white';
            cardBtn.style.background = 'transparent';
            cardBtn.style.color = 'var(--text-muted)';
        } else {
            cardBtn.style.background = 'var(--primary)';
            cardBtn.style.color = 'white';
            listBtn.style.background = 'transparent';
            listBtn.style.color = 'var(--text-muted)';
        }
    }

    // Refresh current view
    if (currentActiveSection === 'browse') renderEvents();
    if (currentActiveSection === 'my-regs') loadMyRegistrations();
    if (currentActiveSection === 'manage') renderManageTable();
}

function syncUserUI() {
    if (!currentUser) return;

    // 1. Robust Role & Name Detection
    const userRole = (currentUser.role || 'student').toLowerCase();
    const isAdmin = userRole === 'admin';
    const fullName = currentUser.fullname || currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : (isAdmin ? 'Admin' : 'Student'));

    // Debug log for troubleshooting (visible in developer console)
    console.log('Syncing UI for:', { name: fullName, role: userRole, isAdmin });

    // Better Image Path Handling
    let profilePic = currentUser.profile_pic;
    if (!profilePic || profilePic === 'null' || profilePic === 'undefined') {
        profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`;
    } else if (typeof profilePic === 'string' && !profilePic.startsWith('http')) {
        profilePic = profilePic.startsWith('/') ? profilePic : '/' + profilePic;
    }

    // Debug log for profile picture URL
    console.log('Profile picture URL:', profilePic);


    // 2. Navigation & Actions Visibility
    const browseBtn = document.getElementById('browse-nav-btn');
    const eventsParent = document.getElementById('events-parent-btn');
    const eventsSubmenu = document.getElementById('events-submenu');
    const adminRegs = document.getElementById('admin-regs-btn');
    const adminUsers = document.getElementById('admin-users-btn');
    const adminActions = document.getElementById('admin-actions');
    const studentRegs = document.getElementById('student-regs-btn');

    if (isAdmin) {
        // Admin: hide flat Browse, show nested Events parent
        if (browseBtn) browseBtn.style.display = 'none';
        if (eventsParent) eventsParent.style.display = 'block';
        if (eventsSubmenu) eventsSubmenu.style.display = 'block';
        if (adminRegs) adminRegs.style.display = 'block';
        if (adminUsers) adminUsers.style.display = 'block';
        const adminRevenue = document.getElementById('admin-revenue-btn');
        const adminVerify = document.getElementById('admin-verify-btn');
        if (adminRevenue) adminRevenue.style.display = 'block';
        if (adminVerify) adminVerify.style.display = 'block';
        if (adminActions) adminActions.style.display = 'block';
        if (studentRegs) studentRegs.style.display = 'none';

        const dropRole = document.getElementById('dropdown-user-role');
        if (dropRole) dropRole.textContent = 'Administrator';
    } else {
        // Student: show flat Browse, hide nested Events parent
        if (browseBtn) browseBtn.style.display = 'block';
        if (eventsParent) eventsParent.style.display = 'none';
        if (eventsSubmenu) eventsSubmenu.style.display = 'none';
        if (adminRegs) adminRegs.style.display = 'none';
        if (adminUsers) adminUsers.style.display = 'none';
        const adminRevenue = document.getElementById('admin-revenue-btn');
        const adminVerify = document.getElementById('admin-verify-btn');
        if (adminRevenue) adminRevenue.style.display = 'none';
        if (adminVerify) adminVerify.style.display = 'none';
        if (adminActions) adminActions.style.display = 'none';
        if (studentRegs) studentRegs.style.display = 'block';

        const dropRole = document.getElementById('dropdown-user-role');
        if (dropRole) dropRole.textContent = 'Student';
    }

    // 3. Header & Welcome Section
    const headerName = document.getElementById('header-user-name');
    if (headerName) headerName.textContent = fullName;
    const headerImg = document.getElementById('header-user-img');
    if (headerImg) headerImg.src = profilePic;

    const dropName = document.getElementById('dropdown-user-name');
    if (dropName) dropName.textContent = fullName;

    const dropFaculty = document.getElementById('dropdown-user-faculty');
    if (dropFaculty) {
        dropFaculty.textContent = currentUser.faculty || '';
        dropFaculty.style.display = isAdmin ? 'none' : 'block';
    }

    const welcome = document.getElementById('welcome-name');
    if (welcome) welcome.textContent = fullName;

    // 4. Settings Form
    const nameInput = document.getElementById('settings-fullname');
    if (nameInput) nameInput.value = fullName;

    const emailInput = document.getElementById('settings-email');
    if (emailInput) {
        emailInput.value = currentUser.email || '';
        emailInput.disabled = true;
    }

    const facultyGroup = document.getElementById('settings-faculty-group');
    if (facultyGroup) {
        facultyGroup.style.display = isAdmin ? 'none' : 'block';
    }

    const facultySelect = document.getElementById('settings-faculty');
    if (facultySelect) facultySelect.value = currentUser.faculty || 'BCA';

    const settingsPreview = document.getElementById('settings-profile-preview');
    if (settingsPreview) {
        settingsPreview.src = profilePic;
        settingsPreview.alt = fullName;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = checkAuth();
    if (!currentUser) return;

    // Phase 1: Immediate UI update using cached localStorage data (fixes flickers)
    syncUserUI();
    setupStarRatingInput();

    // Load registrations first to know which events to disable buttons for
    await loadMyRegistrations();

    // Load initial section and data IMMEDIATELY (don't wait for server)
    showSection('home');
    loadEvents();

    // Phase 2: Background refresh from server (non-blocking for UI)
    try {
        const freshUser = await apiFetch('/api/auth/me');
        if (freshUser) {
            currentUser = freshUser;
            localStorage.setItem('user', JSON.stringify(freshUser));
            syncUserUI(); // Re-sync with fresh server data
        }

        // Handle Payment Success Redirect
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            const regId = urlParams.get('regId');
            showToast('Payment Successful!', 'success');

            // Reload registrations to get latest state
            await loadMyRegistrations();

            // Re-fetch to find the specific registration
            const regs = await apiFetch('/api/registrations/my-registrations');
            const targetReg = regs.find(r => r.reg_id == regId);

            if (targetReg) {
                setTimeout(() => {
                    showTicket(
                        targetReg.reg_id,
                        targetReg.title,
                        targetReg.ticket_type,
                        targetReg.event_date,
                        targetReg.event_time,
                        targetReg.location
                    );
                }, 800);
            }
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {
        console.error('Failed to refresh user data:', err);
    }

    // Scroll Top Button Logic
    window.addEventListener('scroll', () => {
        const scrollBtn = document.getElementById('scroll-top');
        if (scrollBtn) {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        }
    });

    // Auto-retrieve student name by Ticket ID
    const verifyTicketIdInput = document.getElementById('verify-ticket-id');
    if (verifyTicketIdInput) {
        let debounceTimer;
        verifyTicketIdInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const ticketId = verifyTicketIdInput.value.trim();
            const studentNameInput = document.getElementById('verify-student-name');
            const errorDiv = document.getElementById('verify-ticket-id-error');
            const resultDiv = document.getElementById('verification-result');

            if (resultDiv) resultDiv.style.display = 'none';

            if (!ticketId) {
                if (studentNameInput) studentNameInput.value = '';
                if (errorDiv) errorDiv.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const response = await apiFetch(`/api/verification/ticket/${ticketId}`);
                    if (response.success && response.ticket) {
                        if (studentNameInput) studentNameInput.value = response.ticket.student_name;
                        if (errorDiv) errorDiv.style.display = 'none';
                    } else {
                        if (studentNameInput) studentNameInput.value = '';
                        if (errorDiv) {
                            errorDiv.textContent = 'Invalid Ticket ID';
                            errorDiv.style.display = 'block';
                        }
                    }
                } catch (err) {
                    if (studentNameInput) studentNameInput.value = '';
                    if (errorDiv) {
                        errorDiv.textContent = 'Invalid Ticket ID';
                        errorDiv.style.display = 'block';
                    }
                }
            }, 300);
        });
    }
});

async function loadEvents(force = false) {
    // If we have data, show it immediately
    if (allEvents.length > 0 && !force) {
        if (currentActiveSection === 'browse') {
            renderEvents();
        } else if (currentActiveSection === 'manage' && (currentUser.role || '').toLowerCase() === 'admin') {
            renderManageTable();
        }
    }

    try {
        const freshEvents = await apiFetch('/api/events');

        // Flicker Prevention: Only re-render if data has actually changed
        if (!force && allEvents.length > 0 && JSON.stringify(freshEvents) === JSON.stringify(allEvents)) {
            return;
        }

        allEvents = freshEvents;

        // Only render the section that is currently active to avoid overlaps
        if (currentActiveSection === 'browse') {
            renderEvents();
        } else if (currentActiveSection === 'manage' && (currentUser.role || '').toLowerCase() === 'admin') {
            renderManageTable();
        }
    } catch (err) {
        console.error('Events load error:', err);
    }
}

let currentCategoryFilter = 'all';

function filterEvents(category, btn) {
    currentCategoryFilter = category;

    // Update active button UI
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-outline');
    });
    btn.classList.remove('btn-outline');
    btn.classList.add('btn-primary', 'active');

    renderEvents();
}

function renderEvents() {
    console.log('Rendering events in mode:', currentViewMode);
    const container = document.getElementById('event-cards-container');
    if (!container) return;

    let filtered = allEvents;
    if (currentCategoryFilter !== 'all') {
        filtered = allEvents.filter(e => (e.category || 'free') === currentCategoryFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;" class="glass">No ${currentCategoryFilter} events found.</div>`;
        return;
    }


    const newHTML = filtered.map(event => {
        const isRegistered = myRegistrationIds.has(event.id);
        const isPaid = (event.category || '').toLowerCase() === 'paid';
        const isEnded = event.status === 'ended' || (event.registration_deadline && new Date(event.registration_deadline) < new Date());
        const minPrice = isPaid ? Math.min(event.price_regular || 0, event.price_student || 0) : 0;
        const avgRating = event.average_rating ? parseFloat(event.average_rating).toFixed(1) : null;
        const reviewCount = event.review_count || 0;
        const ratingHTML = avgRating 
            ? `<span style="color: #f59e0b; font-weight: bold; margin-left: 0.5rem;">★ ${avgRating} (${reviewCount})</span>`
            : '';

        return `
        <div class="glass" onclick="viewEventDetails('${event.id}')" style="cursor: pointer; padding: 0; overflow: hidden; display: flex; flex-direction: column; transition: 0.3s; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; height: 100%; min-height: 320px; ${isEnded ? 'filter: grayscale(1); opacity: 0.7;' : ''}">
            <!-- Landscape Banner Image -->
            <div style="width: 100%; height: 120px; overflow: hidden; position: relative; background: #000;">
                <img src="${event.image_url || 'https://images.unsplash.com/photo-1540575861501-7ad05823c9f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'}" 
                    style="width: 100%; height: 100%; object-fit: cover;">
                <!-- Date Badge Top-Left -->
                <div class="badge" style="position: absolute; top: 0.5rem; left: 0.5rem; background: var(--primary); color: white; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.6rem;">
                    ${formatDate(event.event_date)}
                </div>
            </div>

            <div style="padding: 0.8rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem;">
                <h3 style="margin: 0; font-size: 0.95rem; line-height: 1.2; color: #fff; font-weight: 700; height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; background: none; -webkit-text-fill-color: #fff;">${event.title}</h3>
                
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem; margin-top: 0.2rem;">
                    <span>👥 ${event.registered_count || 0}/${event.capacity}${ratingHTML}</span>
                    <span style="font-weight: 800; color: ${isPaid ? '#f59e0b' : '#10b981'};">
                        ${isPaid ? `Rs. ${minPrice}` : 'FREE'}
                    </span>
                </div>
                
                <div style="margin-top: auto; padding-top: 0.4rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                        <button class="btn btn-outline" style="padding: 6px; font-size: 0.65rem; border-radius: 5px; font-weight: 700; border-color: rgba(255,255,255,0.1);" onclick="event.stopPropagation(); viewEventDetails('${event.id}')">View Details</button>
                        ${isRegistered
                ? `<button disabled class="btn" style="padding: 6px; font-size: 0.65rem; border-radius: 5px; font-weight: 700; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); width: 100%;">Already Registered</button>`
                : isEnded
                    ? `<button disabled class="btn" style="padding: 6px; font-size: 0.65rem; border-radius: 5px; font-weight: 700; opacity: 0.5; width: 100%;">Registration Closed</button>`
                    : `<button class="btn btn-primary" style="padding: 6px; font-size: 0.65rem; border-radius: 5px; font-weight: 700; width: 100%;" onclick="event.stopPropagation(); ${isPaid ? `viewEventDetails('${event.id}')` : `registerForEvent('${event.id}')`}">Register Now</button>`
            }
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    if (container.innerHTML.trim() !== newHTML.trim()) {
        container.innerHTML = newHTML;
    }
}


function renderManageTable() {
    const container = document.getElementById('manage-section');
    if (!container) return;


    const newHTML = allEvents.map(event => {
        const isEnded = event.status === 'ended' || (event.registration_deadline && new Date(event.registration_deadline) < new Date());
        const eventId = event.id || event._id;

        return `
        <div class="glass" onclick="viewEventDetails('${eventId}')" style="cursor: pointer; padding: 0; overflow: hidden; display: flex; flex-direction: column; transition: 0.3s; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; height: 100%; min-height: 320px;">
            <!-- Landscape Banner Image -->
            <div style="width: 100%; height: 120px; overflow: hidden; position: relative; background: #000;">
                <img src="${event.image_url || 'https://images.unsplash.com/photo-1540575861501-7ad05823c9f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'}" 
                    style="width: 100%; height: 100%; object-fit: cover;">
                <!-- Date Badge Top-Left -->
                <div class="badge" style="position: absolute; top: 0.5rem; left: 0.5rem; background: var(--primary); color: white; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.6rem;">
                    ${formatDate(event.event_date)}
                </div>
            </div>

            <div style="padding: 0.8rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem;">
                <h3 style="margin: 0; font-size: 0.95rem; line-height: 1.2; color: #fff; font-weight: 700; height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; background: none; -webkit-text-fill-color: #fff;">${event.title}</h3>
                
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem; margin-top: 0.2rem;">
                    <span>👥 ${event.registered_count || 0}/${event.capacity}</span>
                    <span style="font-weight: 800; color: #10b981;">
                        ${(event.category || 'FREE').toUpperCase()}
                    </span>
                </div>
                
                <div style="margin-top: auto; padding-top: 0.4rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                            <button class="btn btn-outline" style="padding: 5px; font-size: 0.65rem; border-radius: 5px; font-weight: 700;" onclick="event.stopPropagation(); editEvent('${eventId}')">Edit</button>
                            <button class="btn btn-outline" style="padding: 5px; font-size: 0.65rem; border-radius: 5px; font-weight: 700;" onclick="event.stopPropagation(); viewAttendees('${eventId}')">Roster</button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                            <button class="btn btn-outline" style="padding: 5px; font-size: 0.65rem; border-radius: 5px; font-weight: 700; color: #f59e0b; border-color: rgba(245, 158, 11, 0.2);" onclick="event.stopPropagation(); endEvent('${eventId}')">End</button>
                            <button class="btn btn-outline" style="padding: 5px; font-size: 0.65rem; border-radius: 5px; font-weight: 700; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" onclick="event.stopPropagation(); deleteEvent('${eventId}')">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    if (container.innerHTML.trim() !== newHTML.trim()) {
        container.innerHTML = newHTML;
    }
}

function viewEventDetails(id) {
    const event = allEvents.find(e => e.id == id); // Use == for flexible matching
    if (!event) return;

    currentDetailEventId = id;
    currentSelectedRatingInput = 0;
    // Reset star highlights
    document.querySelectorAll('#rating-stars-input .star-btn').forEach(s => s.style.color = '#475569');
    const commentInput = document.getElementById('review-comment-input');
    if (commentInput) commentInput.value = '';
    loadEventReviews(id);

    document.getElementById('detail-image').style.backgroundImage = `url('${event.image_url || 'https://images.unsplash.com/photo-1540575861501-7ad05823c9f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'}')`;
    document.getElementById('detail-badge').textContent = new Date(event.event_date).toLocaleDateString();
    document.getElementById('detail-title').textContent = event.title;
    document.getElementById('detail-location').innerHTML = `📍 <b>Location:</b> ${event.location}`;
    document.getElementById('detail-time').innerHTML = `🕒 <b>Time:</b> ${event.event_time}`;
    document.getElementById('detail-capacity').innerHTML = `👥 <b>Participants:</b> ${event.registered_count || 0}/${event.capacity}`;
    document.getElementById('detail-deadline').innerHTML = `⌛ <b>Registration Deadline:</b> ${event.registration_deadline ? new Date(event.registration_deadline).toLocaleDateString() : 'None'}`;
    document.getElementById('detail-desc').textContent = event.description;

    const actionContainer = document.getElementById('detail-actions');
    let actionHTML = '';

    const isEnded = event.status === 'ended' || (event.registration_deadline && new Date(event.registration_deadline) < new Date());
    const isPaid = event.category === 'paid';

    if ((currentUser.role || '').toLowerCase() === 'student') {
        if (isEnded) {
            actionHTML = `<button disabled class="btn btn-outline" style="width: 100%; margin-bottom: 1rem; opacity: 0.6; cursor: not-allowed; border-color: #64748b; color: #94a3b8;">Registration Closed</button>`;
        } else if (myRegistrationIds.has(event.id)) {
            actionHTML = `<button disabled class="btn btn-success" style="width: 100%; margin-bottom: 1rem; background: #10b981; color: white; border: none; cursor: default; padding: 1rem;">✅ You are Registered</button>
                          <p style="text-align: center; font-size: 0.8rem; color: #10b981; margin-bottom: 1rem;">Check "My Registrations" to view your ticket.</p>`;
        } else if (isPaid) {
            actionHTML = `
                <div class="glass" style="padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--primary);">
                    <h4 style="margin-bottom: 1rem; color: var(--primary);">Select Ticket Type</h4>
                    <div class="form-group">
                        <select id="ticket-type-select" class="form-control" style="background: rgba(0,0,0,0.3); color: white; border: 1px solid var(--glass-border); padding: 0.8rem; border-radius: 8px; width: 100%;" onchange="updatePriceDisplay(${event.price_regular}, ${event.price_student})">
                            <option value="regular">Regular (Rs. ${event.price_regular})</option>
                            <option value="student">Student (Rs. ${event.price_student})</option>
                        </select>
                    </div>
                    <p style="font-size: 1.1rem; font-weight: 700; margin: 1rem 0;">Total: <span id="total-price-display" style="color: var(--primary);">Rs. ${event.price_regular}</span></p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
                        <button onclick="initiatePayment('${event.id}', 'khalti')" class="btn" style="background: #5c2d91; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem;">
                            Pay with Khalti
                        </button>
                        <button onclick="initiatePayment('${event.id}', 'esewa')" class="btn" style="background: #60bb46; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem;">
                            Pay with eSewa
                        </button>
                    </div>
                </div>
            `;
        } else {
            actionHTML = `<button onclick="registerForEvent('${event.id}')" class="btn btn-primary" style="width: 100%; margin-bottom: 1rem;">Register for Free</button>`;
        }
    } else {
        actionHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <button onclick="closeDetailsModal(); editEvent('${event.id}')" class="btn btn-primary" style="width: 100%;">Edit Event</button>
                <button onclick="closeDetailsModal(); viewAttendees('${event.id}')" class="btn btn-outline" style="width: 100%;">View Roster</button>
                <button onclick="closeDetailsModal(); deleteEvent('${event.id}')" class="btn btn-outline" style="width: 100%; color: var(--danger); border-color: var(--danger); grid-column: span 2;">Delete Event</button>
            </div>
        `;
    }

    actionHTML += `<button onclick="closeDetailsModal()" class="btn btn-outline" style="width: 100%; margin-top: 1rem; border-color: rgba(255,255,255,0.2);">Close Details</button>`;
    actionContainer.innerHTML = actionHTML;

    document.getElementById('details-modal').style.display = 'flex';
}

function updatePriceDisplay(reg, stu) {
    const type = document.getElementById('ticket-type-select').value;
    const price = type === 'student' ? stu : reg;
    document.getElementById('total-price-display').textContent = `Rs. ${price}`;
}

function toggleEventsSubmenu() {
    const submenu = document.getElementById('events-submenu');
    if (submenu) {
        submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';
    }
}


function closeDetailsModal() {
    document.getElementById('details-modal').style.display = 'none';
}

async function registerForEvent(eventId) {
    if (currentUser && (currentUser.role || '').toLowerCase() === 'admin') {
        showAdminRestrictModal();
        return;
    }
    try {
        const response = await apiFetch('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({ event_id: eventId })
        });
        showToast(response.message);
        if (document.getElementById('my-regs-section').style.display !== 'none') {
            loadMyRegistrations();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function initiatePayment(eventId, gateway) {
    if (currentUser && (currentUser.role || '').toLowerCase() === 'admin') {
        showAdminRestrictModal();
        return;
    }
    try {
        const ticket_type = document.getElementById('ticket-type-select').value;
        const event = allEvents.find(e => e.id == eventId); // Use == for flexible matching
        if (!event) throw new Error('Event data not found. Please refresh and try again.');

        const amount = ticket_type === 'student' ? event.price_student : event.price_regular;

        showToast(`Initiating ${gateway} payment...`, 'info');

        if (gateway === 'khalti') {
            const response = await apiFetch('/api/payments/khalti/initiate', {
                method: 'POST',
                body: JSON.stringify({ event_id: eventId, ticket_type, amount })
            });
            // Redirect to Khalti
            window.location.href = response.payment_url;
        } else if (gateway === 'esewa') {
            const response = await apiFetch('/api/payments/esewa/initiate', {
                method: 'POST',
                body: JSON.stringify({ event_id: eventId, ticket_type, amount })
            });

            // eSewa V2 requires submitting a form via POST
            const form = document.createElement('form');
            form.setAttribute('method', 'POST');
            form.setAttribute('action', response.payment_url);

            for (const key in response.formData) {
                const hiddenField = document.createElement('input');
                hiddenField.setAttribute('type', 'hidden');
                hiddenField.setAttribute('name', key);
                hiddenField.setAttribute('value', response.formData[key]);
                form.appendChild(hiddenField);
            }

            document.body.appendChild(form);
            form.submit();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}



async function cancelRegistration(regId) {
    if (window.event) {
        window.event.stopPropagation();
    }
    window.currentRegIdToCancel = regId;
    const cancelModal = document.getElementById('cancel-reg-modal');
    if (cancelModal) {
        cancelModal.style.display = 'flex';
        cancelModal.style.opacity = '1';
    }
}

function closeCancelRegModal() {
    const cancelModal = document.getElementById('cancel-reg-modal');
    if (cancelModal) {
        cancelModal.style.opacity = '0';
        setTimeout(() => {
            cancelModal.style.display = 'none';
            cancelModal.style.opacity = '1';
        }, 200);
    }
}

async function confirmCancelRegistration() {
    const regId = window.currentRegIdToCancel;
    if (!regId) return;
    closeCancelRegModal();
    try {
        await apiFetch(`/api/registrations/${regId}`, { method: 'DELETE' });
        showToast('Registration cancelled');
        loadMyRegistrations();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// Section Switching
function showSection(section) {
    if (section === currentActiveSection && section !== 'settings') return;

    const sections = ['home-section', 'browse-section', 'manage-section', 'my-regs-section', 'all-regs-section', 'users-section', 'settings-section', 'revenue-section', 'verify-section'];
    const tabs = document.querySelectorAll('.nav-item');

    // Fade out current section effectively
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('animate-fade', 'section-show', 'section-show-grid');
        }
    });
    tabs.forEach(t => t.classList.remove('active'));

    // Toggle view-mode-toggle visibility
    const viewToggle = document.getElementById('view-mode-toggle');
    if (viewToggle) {
        const isAdmin = currentUser && (currentUser.role || '').toLowerCase() === 'admin';
        if (isAdmin) {
            viewToggle.style.display = 'none';
        } else {
            // Student Browse Events has no list/card toggle (only card view)
            // Show only in My Registrations section for Student
            viewToggle.style.display = (section === 'my-regs') ? 'flex' : 'none';
        }
    }

    // Toggle Back Button visibility
    const backBtn = document.getElementById('back-to-home');
    if (backBtn) {
        backBtn.style.display = section === 'home' ? 'none' : 'block';
    }

    currentActiveSection = section;
    const targetId = section === 'home' ? 'home-section' :
        section === 'browse' ? 'browse-section' :
            section === 'manage' ? 'manage-section' :
                section === 'my-regs' ? 'my-regs-section' :
                    section === 'revenue' ? 'revenue-section' :
                        section === 'verify' ? 'verify-section' :
                            section === 'all-regs' ? 'all-regs-section' :
                                section === 'users' ? 'users-section' : 'settings-section';

    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    if (targetId === 'browse-section') {
        targetEl.style.display = 'grid';
    } else if (['my-regs-section', 'manage-section'].includes(targetId)) {
        targetEl.style.display = (currentViewMode === 'card') ? 'grid' : 'block';
    } else {
        targetEl.style.display = 'block';
    }

    if (section === 'home') {
        document.getElementById('section-title').textContent = 'Home';
        tabs[0].classList.add('active');
        updateHomeStats();
    } else if (section === 'browse') {
        document.getElementById('section-title').textContent = 'Browse Events';
        document.getElementById('browse-nav-btn')?.classList.add('active');
        document.getElementById('admin-browse-nav-btn')?.classList.add('active');
        loadEvents();
    } else if (section === 'manage') {
        document.getElementById('section-title').textContent = 'Manage Events';
        document.getElementById('admin-manage-nav-btn')?.classList.add('active');
        loadEvents();
    } else if (section === 'my-regs') {
        document.getElementById('section-title').textContent = 'My Registrations';
        document.getElementById('student-regs-btn')?.classList.add('active');
        loadMyRegistrations();
    } else if (section === 'revenue') {
        document.getElementById('section-title').textContent = 'Revenue Analytics';
        const rBtn = document.getElementById('admin-revenue-btn');
        if (rBtn) rBtn.classList.add('active');
        loadRevenueData();
    } else if (section === 'verify') {
        document.getElementById('section-title').textContent = 'Ticket Verification';
        const vBtn = document.getElementById('admin-verify-btn');
        if (vBtn) vBtn.classList.add('active');
    } else if (section === 'all-regs') {
        document.getElementById('section-title').textContent = 'Student Registrations';
        const arBtn = document.getElementById('admin-regs-btn');
        if (arBtn) arBtn.classList.add('active');
        loadAllRegistrations();
    } else if (section === 'users') {
        document.getElementById('section-title').textContent = 'User Management';
        const userBtn = document.getElementById('admin-users-btn');
        if (userBtn) userBtn.classList.add('active');
        loadAllUsers();
    } else if (section === 'settings') {
        document.getElementById('section-title').textContent = 'Account Settings';
        syncUserUI();
    }

    // Auto-close sidebar on mobile
    const sidebarContent = document.getElementById('sidebar-content');
    if (window.innerWidth <= 992 && sidebarContent && sidebarContent.classList.contains('active')) {
        toggleMobileMenu();
    }
}

function switchSettingsTab(tab) {
    const profileBtn = document.getElementById('btn-settings-profile');
    const passwordBtn = document.getElementById('btn-settings-password');
    const profileCard = document.getElementById('settings-profile-card');
    const passwordCard = document.getElementById('settings-password-card');

    if (tab === 'profile') {
        profileBtn.className = 'btn btn-primary';
        passwordBtn.className = 'btn btn-outline';
        profileCard.style.display = 'block';
        passwordCard.style.display = 'none';
    } else {
        profileBtn.className = 'btn btn-outline';
        passwordBtn.className = 'btn btn-primary';
        profileCard.style.display = 'none';
        passwordCard.style.display = 'block';
    }
}

async function updateHomeStats() {
    try {
        const fullName = currentUser.fullname || currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
        document.getElementById('welcome-name').textContent = fullName;

        // Active Events Count
        // Use allEvents if already loaded, otherwise fetch
        const events = allEvents.length > 0 ? allEvents : await apiFetch('/api/events');
        const activeEvents = events.filter(e => e.status !== 'ended');
        const statCount = document.getElementById('stat-events-count');
        if (statCount) statCount.textContent = activeEvents.length;

        // My Registrations Count
        const myRegs = await apiFetch('/api/registrations/my-registrations');
        const statRegs = document.getElementById('stat-my-regs');
        if (statRegs) statRegs.textContent = myRegs.length;

        // New events this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const newEventsList = events.filter(e => new Date(e.created_at) > oneWeekAgo);
        const statNew = document.getElementById('stat-new');
        if (statNew) statNew.textContent = newEventsList.length;

    } catch (err) {
        console.error('Stats update error:', err);
    }
}

// Load student registrations into a single grouped table (Admin only)
async function loadAllRegistrations() {
    try {
        const rows = await apiFetch('/api/registrations/grouped');
        const tbody = document.getElementById('grouped-regs-table-body');

        if (!rows || rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No registrations found.</td></tr>`;
            return;
        }

        // Group rows by user_id so we can calculate rowspan
        const grouped = {};
        const order = []; // preserve student order
        rows.forEach(row => {
            if (!grouped[row.user_id]) {
                grouped[row.user_id] = [];
                order.push(row.user_id);
            }
            grouped[row.user_id].push(row);
        });

        // Build HTML with rowspan for student name & faculty
        let html = '';
        order.forEach((userId, groupIndex) => {
            const studentRows = grouped[userId];
            const count = studentRows.length;

            // Alternate background for visual grouping
            const groupBg = groupIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(99,102,241,0.04)';

            studentRows.forEach((reg, i) => {
                const isFirst = i === 0;
                const isLast = i === count - 1;
                const topBorder = isFirst ? '2px solid var(--glass-border)' : '1px solid rgba(255,255,255,0.05)';
                const bottomBorder = isLast ? '2px solid var(--glass-border)' : 'none';

                html += `<tr style="background: ${groupBg}; border-top: ${topBorder}; border-bottom: ${bottomBorder};">`;

                // Student name & faculty — only on first row, with rowspan
                if (isFirst) {
                    html += `
                        <td rowspan="${count}" style="padding: 1rem; font-weight: 700; vertical-align: top; border-right: 1px solid rgba(255,255,255,0.07);">
                            ${reg.student_name}
                        </td>
                        <td rowspan="${count}" style="padding: 1rem; vertical-align: top; border-right: 1px solid rgba(255,255,255,0.07);">
                            <span style="background: rgba(99,102,241,0.15); color: var(--primary); padding: 0.2rem 0.7rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;">
                                ${reg.faculty || '-'}
                            </span>
                        </td>`;
                }

                // Event name & registration time — every row
                html += `
                    <td style="padding: 0.85rem 1rem;">• ${reg.event_name}</td>
                    <td style="padding: 0.85rem 1rem; font-size: 0.83rem; color: var(--text-muted);">
                        ${new Date(reg.registration_date).toLocaleString()}
                    </td>
                    <td style="padding: 0.85rem 1rem; text-align: right;">
                        <button class="btn btn-outline" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); font-size: 0.75rem; padding: 0.3rem 0.7rem;" 
                            onclick="deleteRegistrationAdmin(${reg.reg_id})">Delete</button>
                    </td>
                </tr>`;
            });
        });

        if (tbody.innerHTML.trim() !== html.trim()) {
            tbody.innerHTML = html;
        }
    } catch (err) {
        console.error('Registration report load error:', err);
    }
}

async function exportRegistrationsToExcel() {
    try {
        showToast('Preparing your Excel file...');
        const rows = await apiFetch('/api/registrations/grouped');

        if (!rows || rows.length === 0) {
            showToast('No data found to export.', 'error');
            return;
        }

        // Format data for SheetJS - One name per student grouping
        let lastUserId = null;
        const formattedData = rows.map(reg => {
            const isFirstOccurrence = reg.user_id !== lastUserId;
            lastUserId = reg.user_id;

            return {
                'Student Name': isFirstOccurrence ? reg.student_name : '',
                'Faculty': isFirstOccurrence ? (reg.faculty || '-') : '',
                'Event Registered': reg.event_name,
                'Registration Time': new Date(reg.registration_date).toLocaleString()
            };
        });

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

        // Auto-size columns for better visibility
        const wscols = [
            { wch: 25 }, // Name
            { wch: 15 }, // Faculty
            { wch: 35 }, // Event
            { wch: 25 }  // Time
        ];
        worksheet['!cols'] = wscols;

        // Write and download the file
        XLSX.writeFile(workbook, `Student_Registrations_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
        showToast('Excel file downloaded successfully!', 'success');

    } catch (err) {
        console.error('Export error:', err);
        showToast('Failed to generate Excel file', 'error');
    }
}


async function loadAllUsers() {
    try {
        const users = await apiFetch('/api/auth/students');
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        const newHTML = users.map(user => `
            <tr style="border-bottom: 1px solid var(--glass-border);">
                <td style="padding: 1rem;">${user.fullname}</td>
                <td style="padding: 1rem;">${user.faculty || '-'}</td>
                <td style="padding: 1rem;">${user.email}</td>
                <td style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                    ${new Date(user.created_at).toLocaleDateString()}
                </td>
                <td style="padding: 1rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;" 
                        onclick="resetUserPassword(${user.id})">Reset</button>
                    <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" 
                        onclick="deleteUser(${user.id}, '${user.fullname}')">Delete</button>
                </td>
</tr>
        `).join('');

        if (tbody.innerHTML.trim() !== newHTML.trim()) {
            tbody.innerHTML = newHTML;
        }
    } catch (err) {
        console.error('Users load error:', err);
    }
}

async function resetUserPassword(userId) {
    window.currentUserIdToReset = userId;
    const confirmModal = document.getElementById('reset-confirm-modal');
    if (confirmModal) {
        confirmModal.style.display = 'flex';
        confirmModal.style.opacity = '1';
    }
}

function closeResetConfirmModal() {
    const confirmModal = document.getElementById('reset-confirm-modal');
    if (confirmModal) {
        confirmModal.style.opacity = '0';
        setTimeout(() => {
            confirmModal.style.display = 'none';
            confirmModal.style.opacity = '1';
        }, 200);
    }
}

async function confirmResetPassword() {
    const userId = window.currentUserIdToReset;
    if (!userId) return;
    closeResetConfirmModal();
    try {
        await apiFetch(`/api/auth/reset-user-password/${userId}`, { method: 'POST' });
        const successModal = document.getElementById('reset-success-modal');
        if (successModal) {
            successModal.style.display = 'flex';
            successModal.style.opacity = '1';
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeResetSuccessModal() {
    const successModal = document.getElementById('reset-success-modal');
    if (successModal) {
        successModal.style.opacity = '0';
        setTimeout(() => {
            successModal.style.display = 'none';
            successModal.style.opacity = '1';
        }, 200);
    }
}

async function deleteUser(userId, name) {
    if (!confirm(`CAUTION: Are you sure you want to delete user "${name}"? This will also remove all their event registrations. This action cannot be undone.`)) return;
    try {
        const response = await apiFetch(`/api/auth/${userId}`, { method: 'DELETE' });
        showToast(response.message);
        loadAllUsers(); // Refresh the list
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Admin Event CRUD
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');

function openModal(isEdit = false) {
    document.getElementById('modal-title').textContent = isEdit ? 'Edit Event' : 'Create New Event';
    if (!isEdit) {
        eventForm.reset();
        document.getElementById('event-id').value = '';
        document.getElementById('event-thumbnail').value = ''; // Ensure file input is cleared
        document.getElementById('image-preview').style.display = 'none';
    }
    if (eventModal) eventModal.style.display = 'flex';
}

function closeModal() {
    if (eventModal) eventModal.style.display = 'none';
}

function editEvent(id) {
    console.log('Editing event with ID:', id);
    const event = allEvents.find(e => e.id == id); // Use == for flexible string/number comparison
    if (!event) {
        console.error('Event not found for ID:', id);
        return;
    }

    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-desc').value = event.description;
    document.getElementById('event-date').value = event.event_date.split('T')[0];
    document.getElementById('event-time').value = event.event_time;
    document.getElementById('event-location').value = event.location;
    document.getElementById('event-capacity').value = event.capacity;
    document.getElementById('event-deadline').value = event.registration_deadline ? event.registration_deadline.split('T')[0] : '';
    document.getElementById('event-category').value = event.category || 'free';
    document.getElementById('price-regular').value = event.price_regular || 0;
    document.getElementById('price-student').value = event.price_student || 0;
    togglePriceFields();

    // Show current image as preview
    if (event.image_url) {
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('img-preview-src').src = event.image_url;
    } else {
        document.getElementById('image-preview').style.display = 'none';
    }

    openModal(true);
}

// Preview Image when selected
document.getElementById('event-thumbnail')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            document.getElementById('image-preview').style.display = 'block';
            document.getElementById('img-preview-src').src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;

    const eventDate = document.getElementById('event-date').value;
    const deadlineValue = document.getElementById('event-deadline').value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Client-side validation: Past date checks
    if (eventDate && new Date(eventDate) < today) {
        showToast('Event start date cannot be in the past.', 'error');
        return;
    }

    if (deadlineValue && new Date(deadlineValue) < today) {
        showToast('Registration deadline cannot be in the past.', 'error');
        return;
    }

    // Client-side validation: Deadline must be strictly earlier than Event Date
    if (deadlineValue && eventDate) {
        if (new Date(deadlineValue) >= new Date(eventDate)) {
            showToast('Registration deadline must be earlier than the event start date.', 'error');
            return;
        }
    }

    const formData = new FormData();
    formData.append('title', document.getElementById('event-title').value);
    formData.append('description', document.getElementById('event-desc').value);
    formData.append('event_date', eventDate);
    formData.append('event_time', document.getElementById('event-time').value);
    formData.append('location', document.getElementById('event-location').value);
    formData.append('capacity', document.getElementById('event-capacity').value);
    formData.append('registration_deadline', deadlineValue || null);
    formData.append('category', document.getElementById('event-category').value);
    formData.append('price_regular', document.getElementById('price-regular').value);
    formData.append('price_student', document.getElementById('price-student').value);

    const imageFile = document.getElementById('event-thumbnail').files[0];
    if (imageFile) {
        formData.append('thumbnail', imageFile);
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/events/${id}` : '/api/events';

        await apiFetch(url, {
            method,
            body: formData // Body is now FormData
        });

        showToast(id ? 'Event updated' : 'Event created');
        closeModal();
        loadEvents();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function deleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
        await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
        showToast('Event deleted');
        loadEvents();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function endEvent(id) {
    if (!confirm('Are you sure you want to end this event? This will close registrations.')) return;
    try {
        await apiFetch(`/api/events/${id}/end`, { method: 'PATCH' });
        showToast('Event marked as ended');
        loadEvents();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function viewAttendees(eventId) {
    try {
        const attendees = await apiFetch(`/api/registrations/event/${eventId}`);
        const list = document.getElementById('attendee-list');
        if (attendees.length === 0) {
            list.innerHTML = '<p>No students registered yet.</p>';
        } else {
            list.innerHTML = attendees.map(a => `
                <div class="glass" style="padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${a.fullname} <span style="font-size:0.8em; color:var(--primary); margin-left:5px;">${a.faculty || ''}</span></div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${a.email}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); text-align: right;">
                            <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; opacity: 0.6;">Registered</div>
                            ${new Date(a.registration_date).toLocaleDateString()}
                        </div>
                        <button class="btn" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; font-size: 0.8rem; border-radius: 6px; cursor: pointer; transition: 0.2s;" 
                            onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'"
                            title="Remove student from event" onclick="removeStudentFromRoster(${eventId}, ${a.user_id}, '${a.fullname}')">❌</button>
                    </div>
                </div>
            `).join('');
        }
        document.getElementById('attendees-modal').style.display = 'flex';
    } catch (err) {
        showToast('Failed to load attendees', 'error');
    }
}

function closeAttendeesModal() {
    document.getElementById('attendees-modal').style.display = 'none';
}

// ===================== IMAGE CROPPER =====================
let cropImage = new Image();
let cropScale = 1;
let cropOffsetX = 0, cropOffsetY = 0;
let cropDragging = false;
let cropDragStartX = 0, cropDragStartY = 0;
let croppedBlob = null;

const CANVAS_SIZE = 260;

function drawCropCanvas() {
    const canvas = document.getElementById('crop-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const scaledW = cropImage.width * cropScale;
    const scaledH = cropImage.height * cropScale;
    const x = (CANVAS_SIZE - scaledW) / 2 + cropOffsetX;
    const y = (CANVAS_SIZE - scaledH) / 2 + cropOffsetY;

    ctx.drawImage(cropImage, x, y, scaledW, scaledH);
}

function openCropModal(src) {
    cropImage = new Image();
    cropImage.onload = () => {
        cropScale = 1;
        cropOffsetX = 0;
        cropOffsetY = 0;
        document.getElementById('crop-zoom').value = 1;

        // Auto-fit: scale so image fills the circle (Cover behavior)
        const fitScale = Math.max(CANVAS_SIZE / cropImage.width, CANVAS_SIZE / cropImage.height);

        const slider = document.getElementById('crop-zoom');
        if (slider) {
            slider.min = (fitScale * 0.8).toFixed(4); // Allow slightly smaller than cover
            slider.max = (fitScale * 5).toFixed(4);   // Up to 5x cover zoom
            slider.step = "0.001";
            slider.value = fitScale;
        }

        cropScale = fitScale;
        drawCropCanvas();
        document.getElementById('crop-modal').style.display = 'flex';
    };

    cropImage.src = src;
}

function cancelCrop() {
    document.getElementById('crop-modal').style.display = 'none';
    document.getElementById('profile-pic-input').value = '';
    croppedBlob = null;
}

function applyCrop() {
    const canvas = document.getElementById('crop-canvas');
    canvas.toBlob(blob => {
        croppedBlob = blob;
        // Show preview in settings
        const url = URL.createObjectURL(blob);
        document.getElementById('settings-profile-preview').src = url;
        document.getElementById('crop-modal').style.display = 'none';

        // Reset the file input value so picking the same file again triggers 'change'
        const input = document.getElementById('profile-pic-input');
        if (input) input.value = '';

        // Scroll to the form so they see the Save button
        document.getElementById('update-profile-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 'image/jpeg', 0.92);
}

const cropZoomSlider = document.getElementById('crop-zoom');
// Zoom from center
function setZoom(newScale) {
    const oldScale = cropScale;
    const minScale = parseFloat(cropZoomSlider.min) || 0.1;
    const maxScale = parseFloat(cropZoomSlider.max) || 10;

    cropScale = Math.max(minScale, Math.min(maxScale, parseFloat(newScale)));

    // Adjust offsets to zoom from center
    if (oldScale > 0) {
        cropOffsetX = (cropOffsetX * cropScale) / oldScale;
        cropOffsetY = (cropOffsetY * cropScale) / oldScale;
    }

    if (cropZoomSlider) cropZoomSlider.value = cropScale;
    drawCropCanvas();
}

if (cropZoomSlider) {
    cropZoomSlider.addEventListener('input', function () {
        setZoom(this.value);
    });
}


// Drag to reposition
const cropCanvas = document.getElementById('crop-canvas');
if (cropCanvas) {
    cropCanvas.addEventListener('mousedown', e => {
        cropDragging = true;
        cropDragStartX = e.clientX - cropOffsetX;
        cropDragStartY = e.clientY - cropOffsetY;
        cropCanvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
        if (!cropDragging) return;
        cropOffsetX = e.clientX - cropDragStartX;
        cropOffsetY = e.clientY - cropDragStartY;
        drawCropCanvas();
    });
    window.addEventListener('mouseup', () => {
        cropDragging = false;
        if (cropCanvas) cropCanvas.style.cursor = 'grab';
    });

    // Wheel support for zooming
    cropCanvas.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out/in speed
        setZoom(cropScale * delta);
    }, { passive: false });

    // Touch support for mobile
    cropCanvas.addEventListener('touchstart', e => {
        const t = e.touches[0];
        cropDragging = true;
        cropDragStartX = t.clientX - cropOffsetX;
        cropDragStartY = t.clientY - cropOffsetY;
    }, { passive: true });
    window.addEventListener('touchmove', e => {
        if (!cropDragging) return;
        const t = e.touches[0];
        cropOffsetX = t.clientX - cropDragStartX;
        cropOffsetY = t.clientY - cropDragStartY;
        drawCropCanvas();
    }, { passive: true });
    window.addEventListener('touchend', () => { cropDragging = false; });
}


// Profile Update Logic
const updateProfileForm = document.getElementById('update-profile-form');
const profilePicInput = document.getElementById('profile-pic-input');

if (profilePicInput) {
    profilePicInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            openCropModal(event.target.result);
        };
        reader.readAsDataURL(file);
    });
}


if (updateProfileForm) {
    updateProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('settings-fullname').value;
        const faculty = document.getElementById('settings-faculty').value;

        const formData = new FormData();
        formData.append('fullname', fullname);

        // Only append faculty if user is a student
        if (currentUser.role === 'student') {
            const faculty = document.getElementById('settings-faculty').value;
            formData.append('faculty', faculty);
        }

        // Use the cropped blob if available, else fall back to raw file
        if (croppedBlob) {
            formData.append('profile_pic', croppedBlob, 'profile.jpg');
        } else if (profilePicInput.files[0]) {
            formData.append('profile_pic', profilePicInput.files[0]);
        }

        try {
            const response = await apiFetch('/api/auth/update-profile', {
                method: 'POST',
                body: formData
            });

            showToast(response.message);
            // Update local state
            currentUser.fullname = fullname;
            if (currentUser.role === 'student') {
                currentUser.faculty = document.getElementById('settings-faculty').value;
            }
            if (response.profile_pic) currentUser.profile_pic = response.profile_pic;

            // Persist the changes to localStorage
            localStorage.setItem('user', JSON.stringify(currentUser));

            croppedBlob = null; // Clear the crop state after success

            // Clear the file input as well
            if (profilePicInput) profilePicInput.value = '';

            syncUserUI();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Settings / Change Password
const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            return showToast('New passwords do not match', 'error');
        }

        // Frontend validation
        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.valid) {
            return showToast(passwordCheck.message, 'error');
        }

        try {
            const response = await apiFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            showToast(response.message);
            changePasswordForm.reset();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}
// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }
});

// Ticketing & UI Helpers
function togglePriceFields() {
    const category = document.getElementById('event-category').value;
    const priceFields = document.getElementById('price-fields');
    if (priceFields) priceFields.style.display = category === 'paid' ? 'block' : 'none';
}

// Revenue Analytics
let revenueChart = null;
let paymentPieChart = null;

async function loadRevenueData() {
    try {
        const data = await apiFetch('/api/analytics/revenue');

        // Render Stats Cards
        const statsContainer = document.getElementById('revenue-stats');
        statsContainer.innerHTML = `
            <div class="glass stat-card">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Total Revenue</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--primary);">Rs. ${data.totalRevenue}</div>
            </div>
            <div class="glass stat-card">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Tickets Sold</div>
                <div style="font-size: 1.8rem; font-weight: 800;">${data.paidTicketsSold}</div>
            </div>
            <div class="glass stat-card">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Free Regs</div>
                <div style="font-size: 1.8rem; font-weight: 800;">${data.freeRegistrations}</div>
            </div>
            <div class="glass stat-card">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Top Event</div>
                <div style="font-size: 1.1rem; font-weight: 700; margin-top: 5px;">${data.mostProfitableEvent.title}</div>
                <div style="font-size: 0.8rem; color: var(--primary);">Rs. ${data.mostProfitableEvent.revenue}</div>
            </div>
        `;

        // Render Recent Transactions
        const transTable = document.getElementById('recent-transactions-table');
        transTable.innerHTML = data.recentTransactions.map(t => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.75rem; font-size: 0.85rem;">${t.user_name}</td>
                <td style="padding: 0.75rem; font-size: 0.85rem;">${t.event_title}</td>
                <td style="padding: 0.75rem; font-size: 0.85rem; font-weight: 600;">Rs. ${t.amount}</td>
                <td style="padding: 0.75rem; font-size: 0.85rem;">${t.payment_method}</td>
                <td style="padding: 0.75rem;"><span class="badge" style="background: #10b981; font-size: 0.6rem;">${t.payment_status}</span></td>
                <td style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">${new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');

        // Charts logic
        if (revenueChart) revenueChart.destroy();
        if (paymentPieChart) paymentPieChart.destroy();

        const ctx1 = document.getElementById('revenue-chart').getContext('2d');
        revenueChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: data.monthlyRevenue.map(m => m.month).reverse(),
                datasets: [{
                    label: 'Revenue (Rs.)',
                    data: data.monthlyRevenue.map(m => m.total).reverse(),
                    borderColor: '#6366f1',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.1)'
                }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });

        const ctx2 = document.getElementById('payment-pie-chart').getContext('2d');
        paymentPieChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: data.statusStats.map(s => s.payment_status),
                datasets: [{
                    data: data.statusStats.map(s => s.count),
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6366f1']
                }]
            }
        });

    } catch (err) {
        console.error(err);
    }
}

// QR Verification
async function verifyTicketByID() {
    const ticketIdInput = document.getElementById('verify-ticket-id');
    const ticketId = ticketIdInput ? ticketIdInput.value.trim() : '';

    if (!ticketId) return showToast('Please enter a Ticket ID', 'error');

    const resultDiv = document.getElementById('verification-result');
    const icon = document.getElementById('result-status-icon');
    const msg = document.getElementById('result-message');
    const details = document.getElementById('result-details');

    try {
        const result = await apiFetch('/api/verification/verify', {
            method: 'POST',
            body: { ticket_id: ticketId }
        });

        if (resultDiv) resultDiv.style.display = 'block';
        if (icon) icon.textContent = '✅';
        if (msg) {
            msg.textContent = result.message || 'Ticket Verified Successfully';
            msg.style.color = '#10b981';
        }
        if (details && result.attendee) {
            details.innerHTML = `
                <p><strong>Attendee:</strong> ${result.attendee.name}</p>
                <p><strong>Event:</strong> ${result.attendee.event}</p>
                <p><strong>Ticket Type:</strong> ${result.attendee.ticket}</p>
            `;
        }
        showToast(result.message || 'Ticket Verified Successfully', 'success');
    } catch (err) {
        if (resultDiv) resultDiv.style.display = 'block';
        if (icon) icon.textContent = '❌';
        if (msg) {
            msg.textContent = err.message || 'Verification failed';
            msg.style.color = '#ef4444';
        }
        if (details) details.innerHTML = '';
        showToast(err.message || 'Verification failed', 'error');
    }
}

function showTicket(regId, eventTitle, ticketType, eventDate, eventTime, eventLocation) {
    const container = document.getElementById('qr-code-container');
    if (!container) return;
    container.innerHTML = '';

    // Populate New Vertical Design Fields
    try {
        const userRole = (currentUser.role || 'student').toLowerCase();
        const isAdmin = userRole === 'admin';
        const studentName = currentUser.fullname || currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : (isAdmin ? 'Admin' : 'Student'));

        const formattedRegId = `#${String(regId).padStart(6, '0')}`;
        const passLabel = (ticketType || 'ENTRY').toUpperCase() + ' PASS';

        // Header Section
        document.getElementById('qr-event-title-display').textContent = eventTitle || 'EVENT NAME';
        document.getElementById('qr-ticket-type-display').textContent = passLabel;
        document.getElementById('qr-student-name-display').textContent = studentName;
        document.getElementById('qr-reg-id-display').textContent = formattedRegId;
    } catch (err) {
        console.error("Error populating vertical ticket fields:", err);
    }

    const qrData = JSON.stringify({
        reg_id: regId,
        student: currentUser ? currentUser.name : 'Unknown',
        event: eventTitle,
        type: ticketType
    });

    // Generate QR Code
    try {
        const tempDiv = document.createElement('div');
        new QRCode(tempDiv, {
            text: qrData,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        setTimeout(() => {
            const canvas = tempDiv.querySelector('canvas');
            if (canvas) {
                const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
                container.innerHTML = `<img src="${dataUrl}" style="width: 160px; height: 160px; display: block; margin: 0 auto;">`;
            }
        }, 200);
    } catch (err) {
        console.error("QR Generation Error:", err);
        container.innerHTML = '<p style="color:red; font-size:0.7rem;">QR Load Error</p>';
    }

    document.getElementById('qr-modal').style.display = 'flex';
}

function closeQRModal() {
    document.getElementById('qr-modal').style.display = 'none';
}

function downloadTicket() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('premium-ticket');
    const downloadBtn = event.currentTarget;
    if (!element || !downloadBtn) return;

    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '⌛ Rendering...';
    downloadBtn.disabled = true;

    showToast('Generating high-resolution pass...');

    // Temporarily scroll to top for perfect capture
    const scrollPos = window.scrollY;
    window.scrollTo(0, 0);

    html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#080b14',
        logging: false,
        onclone: (clonedDoc) => {
            const ticket = clonedDoc.getElementById('premium-ticket');
            if (ticket) {
                ticket.style.transform = 'none';
                ticket.style.margin = '0';

                // Fix h1 gradient clip issue in html2canvas
                const h1 = ticket.querySelector('h1');
                if (h1) {
                    h1.style.background = 'none';
                    h1.style.webkitTextFillColor = '#ffffff';
                    h1.style.color = '#ffffff';
                }

                // Ensure QR section background is clean for download
                const qrSection = ticket.querySelector('div[style*="margin-bottom: 2.5rem"]');
                if (qrSection) {
                    qrSection.style.background = '#111827';
                    qrSection.style.boxShadow = 'none';
                }

                // Hide all animations during capture
                const allDivs = ticket.querySelectorAll('div');
                allDivs.forEach(div => {
                    if (div.style.animation || div.className === 'scanline') {
                        div.style.display = 'none';
                    }
                });
            }
        }
    }).then(canvas => {
        window.scrollTo(0, scrollPos); // Restore scroll
        const eventTitle = document.getElementById('qr-event-title-display').textContent;
        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        // Get exact dimensions of the vertical ticket card in mm (1px = 0.264583mm)
        const widthMm = element.offsetWidth * 0.264583;
        const heightMm = element.offsetHeight * 0.264583;

        // Create PDF in portrait/vertical custom size matching the ticket card
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [widthMm, heightMm]
        });

        // Add the styled premium ticket card full-bleed
        pdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);

        // Save PDF instead of JPG
        pdf.save(`Entry_Pass_${eventTitle.replace(/\s+/g, '_')}.pdf`);

        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
        showToast('Ticket Downloaded as PDF!', 'success');
    }).catch(err => {
        console.error(err);
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
        showToast('Download failed. Please try again.', 'error');
    });
}

// Update My Registrations to show "View Ticket" button
async function loadMyRegistrations() {
    try {
        const regs = await apiFetch('/api/registrations/my-registrations');

        // Update global tracking set
        myRegistrationIds = new Set(regs.map(r => r.event_id));

        const container = document.getElementById('my-regs-section');

        // Restore Grid/Block logic
        container.style.display = (currentViewMode === 'card') ? 'grid' : 'block';

        if (regs.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem;" class="glass">You haven\'t registered for any events yet.</div>';
            return;
        }

        container.innerHTML = regs.map(reg => {
            if (currentViewMode === 'list') {
                return `
                    <div class="glass" onclick="viewEventDetails(${reg.event_id})" style="display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; margin-bottom: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); gap: 1.5rem; flex-wrap: wrap; transition: 0.3s ease; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <!-- Left Section: Title & Status -->
                        <div style="flex: 2; min-width: 280px; display: flex; flex-direction: column; gap: 0.4rem;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff; letter-spacing: -0.3px;">${reg.title}</h3>
                                <span style="background: ${(reg.amount == 0 || reg.payment_status === 'paid') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)'}; color: ${(reg.amount == 0 || reg.payment_status === 'paid') ? '#10b981' : '#f59e0b'}; padding: 3px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; white-space: nowrap; border: 1px solid ${(reg.amount == 0 || reg.payment_status === 'paid') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'};">
                                    ${reg.amount == 0 ? 'Enrolled ✓' : (reg.payment_status === 'paid' ? 'Paid ✓' : 'Pending')}
                                </span>
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; font-family: 'Inter', sans-serif;">
                                📅 ${formatDate(reg.event_date)} | 🕒 ${formatTime(reg.event_time)}
                            </div>
                        </div>

                        <!-- Middle Section: Ticket Type -->
                        <div style="flex: 0.8; min-width: 100px; text-align: center; border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); padding: 0 1rem;">
                            <span style="display: block; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 4px; opacity: 0.7;">Ticket Type</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: #fff; letter-spacing: 0.5px;">${(reg.amount > 0 || (reg.ticket_type && reg.ticket_type !== 'regular')) ? 'PAID' : 'FREE'}</span>
                        </div>

                        <!-- Right Section: Slim Actions -->
                        <div style="display: flex; gap: 0.6rem; align-items: center; min-width: 200px; justify-content: flex-end;">
                            ${reg.payment_status === 'paid'
                        ? `<button class="btn btn-primary" style="padding: 7px 18px; font-size: 0.72rem; border-radius: 6px; white-space: nowrap; font-weight: 700; text-transform: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);" onclick="event.stopPropagation(); showTicket(${reg.reg_id}, '${reg.title.replace(/'/g, "\\'")}', '${reg.ticket_type}', '${reg.event_date}', '${reg.event_time}', '${reg.location.replace(/'/g, "\\'")}')">View Ticket</button>`
                        : `<button class="btn btn-outline" style="padding: 7px 18px; font-size: 0.72rem; border-radius: 6px; white-space: nowrap; font-weight: 700; text-transform: none;" onclick="event.stopPropagation(); viewEventDetails(${reg.event_id})">View Details</button>`
                    }
                            <button class="btn btn-outline" style="padding: 7px 18px; font-size: 0.72rem; border-radius: 6px; white-space: nowrap; font-weight: 700; text-transform: none; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" onclick="event.stopPropagation(); cancelRegistration(${reg.reg_id})">Cancel</button>
                        </div>
                    </div>`;
            } else {
                // Original Clean Card View (Restored)
                return `
                    <div class="glass event-card" onclick="viewEventDetails(${reg.event_id})" style="padding: 1.5rem; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(255,255,255,0.03); position: relative; transition: 0.3s; height: 100%; min-height: 240px; cursor: pointer;">
                        <!-- Top Badge Section: Forced Horizontal Alignment -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; width: 100%;">
                            <span style="background: ${(reg.amount == 0 || reg.payment_status === 'paid') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${(reg.amount == 0 || reg.payment_status === 'paid') ? '#10b981' : '#f59e0b'}; padding: 6px 12px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; border: 1px solid ${(reg.amount == 0 || reg.payment_status === 'paid') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; line-height: 1; display: inline-flex; align-items: center; justify-content: center; height: 24px; margin: 0;">
                                ${reg.amount == 0 ? 'ENROLLED' : (reg.payment_status === 'paid' ? 'PAID' : 'PENDING')}
                            </span>
                            <span style="background: ${reg.ticket_type === 'student' ? 'var(--primary)' : 'rgba(100, 116, 139, 0.2)'}; color: ${reg.ticket_type === 'student' ? 'white' : '#cbd5e1'}; padding: 6px 12px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); line-height: 1; display: inline-flex; align-items: center; justify-content: center; height: 24px; margin: 0;">
                                ${(reg.ticket_type || 'regular').toUpperCase()}
                            </span>
                        </div>

                        <!-- Title -->
                        <h3 style="margin-bottom: 0.8rem; font-size: 1.15rem; font-weight: 700; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${reg.title}
                        </h3>

                        <!-- Date & Time Row -->
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; white-space: nowrap;">
                            ${formatDate(reg.event_date)} &nbsp; | &nbsp; ${formatTime(reg.event_time)}
                        </div>

                        <!-- Bottom Action Buttons -->
                        <div style="margin-top: auto; display: flex; gap: 0.8rem;">
                            ${reg.payment_status === 'paid'
                        ? `<button class="btn btn-primary" style="flex: 1; padding: 8px; font-size: 0.75rem; border-radius: 6px; font-weight: 700; white-space: nowrap; text-transform: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);" onclick="event.stopPropagation(); showTicket(${reg.reg_id}, '${reg.title.replace(/'/g, "\\'")}', '${reg.ticket_type}', '${reg.event_date}', '${reg.event_time}', '${reg.location.replace(/'/g, "\\'")}')">View Ticket</button>`
                        : `<button class="btn btn-outline" style="flex: 1; padding: 8px; font-size: 0.75rem; border-radius: 6px; font-weight: 700; white-space: nowrap; text-transform: none;" onclick="event.stopPropagation(); viewEventDetails(${reg.event_id})">View Details</button>`
                    }
                            <button class="btn btn-outline" style="flex: 1; padding: 8px; font-size: 0.75rem; border-radius: 6px; font-weight: 700; white-space: nowrap; text-transform: none; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" onclick="event.stopPropagation(); cancelRegistration(${reg.reg_id})">Cancel</button>
                        </div>
                    </div>`;
            }
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

async function resetRevenueAnalytics() {
    if (!confirm('CRITICAL WARNING: This will permanently delete all payment history and transaction logs. Registrations will remain but revenue will show as 0. This cannot be undone.\n\nAre you sure?')) return;

    if (!confirm('FINAL CONFIRMATION: Are you absolutely certain you want to clear all financial data?')) return;

    try {
        const response = await apiFetch('/api/analytics/reset', { method: 'POST' });
        showToast(response.message, 'success');
        loadRevenueData(); // Refresh the analytics view
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteRegistrationAdmin(regId) {
    if (!confirm('Are you sure you want to delete this student registration?')) return;
    try {
        const response = await apiFetch(`/api/registrations/admin/${regId}`, { method: 'DELETE' });
        showToast(response.message || 'Registration deleted', 'success');
        loadAllRegistrations();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function removeStudentFromRoster(eventId, studentId, studentName) {
    if (!confirm(`Are you sure you want to remove ${studentName || 'this student'} from the event roster?`)) return;
    try {
        const response = await apiFetch(`/api/registrations/admin/${eventId}/${studentId}`, { method: 'DELETE' });
        showToast(response.message || 'Student removed from roster', 'success');
        viewAttendees(eventId); // Refresh roster modal list
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Ensure administrative functions are globally accessible
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.endEvent = endEvent;
window.viewAttendees = viewAttendees;
window.closeModal = closeModal;
window.openModal = openModal;
window.closeAttendeesModal = closeAttendeesModal;
window.setViewMode = setViewMode;
window.showSection = showSection;
window.toggleEventsSubmenu = toggleEventsSubmenu;
window.filterEvents = filterEvents;
window.viewEventDetails = viewEventDetails;
window.registerForEvent = registerForEvent;
window.initiatePayment = initiatePayment;
window.cancelRegistration = cancelRegistration;
window.closeCancelRegModal = closeCancelRegModal;
window.confirmCancelRegistration = confirmCancelRegistration;
window.showTicket = showTicket;
window.closeQRModal = closeQRModal;
window.downloadTicket = downloadTicket;
window.deleteRegistrationAdmin = deleteRegistrationAdmin;
window.removeStudentFromRoster = removeStudentFromRoster;
window.resetUserPassword = resetUserPassword;
window.closeResetConfirmModal = closeResetConfirmModal;
window.confirmResetPassword = confirmResetPassword;
window.closeResetSuccessModal = closeResetSuccessModal;
window.submitEventReview = submitEventReview;
window.deleteEventReview = deleteEventReview;


// ===================== REVIEWS & RATINGS LOGIC =====================
let currentDetailEventId = null;
let currentSelectedRatingInput = 0;

function setupStarRatingInput() {
    const stars = document.querySelectorAll('#rating-stars-input .star-btn');
    stars.forEach(star => {
        // Hover effect: highlight stars up to hovered one
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.getAttribute('data-value'));
            stars.forEach((s, idx) => {
                if (idx < val) {
                    s.style.color = '#f59e0b';
                } else {
                    s.style.color = '#475569';
                }
            });
        });

        // Mouse out: revert to selected rating
        star.addEventListener('mouseout', () => {
            stars.forEach((s, idx) => {
                if (idx < currentSelectedRatingInput) {
                    s.style.color = '#f59e0b';
                } else {
                    s.style.color = '#475569';
                }
            });
        });

        // Click to select rating
        star.addEventListener('click', () => {
            currentSelectedRatingInput = parseInt(star.getAttribute('data-value'));
        });
    });
}

async function loadEventReviews(eventId) {
    try {
        const data = await apiFetch(`/api/events/${eventId}/reviews`);
        const reviews = data.reviews || [];
        const avgRating = data.average_rating;
        const reviewCount = data.review_count;

        // Render Summary
        const avgValEl = document.getElementById('avg-rating-value');
        if (avgValEl) avgValEl.textContent = avgRating ? avgRating.toFixed(1) : '0.0';

        const avgStarsEl = document.getElementById('avg-rating-stars');
        if (avgStarsEl) {
            let starsHTML = '';
            const roundRating = Math.round(avgRating || 0);
            for (let i = 1; i <= 5; i++) {
                starsHTML += `<span style="color: ${i <= roundRating ? '#f59e0b' : '#475569'};">★</span>`;
            }
            avgStarsEl.innerHTML = starsHTML;
        }

        const countEl = document.getElementById('review-count-value');
        if (countEl) countEl.textContent = `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`;

        // Render List
        const listEl = document.getElementById('detail-reviews-list');
        if (listEl) {
            if (reviews.length === 0) {
                listEl.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin: 1rem 0;">No reviews yet. Be the first to share your experience!</p>`;
            } else {
                listEl.innerHTML = reviews.map(rev => {
                    const canDelete = currentUser && ((currentUser.role || '').toLowerCase() === 'admin' || rev.user_id === currentUser.id);
                    const deleteBtn = canDelete 
                        ? `<button onclick="deleteEventReview('${rev.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.background='none'">🗑️</button>`
                        : '';

                    let starsHTML = '';
                    for (let i = 1; i <= 5; i++) {
                        starsHTML += `<span style="color: ${i <= rev.rating ? '#f59e0b' : '#475569'}; font-size: 0.85rem;">★</span>`;
                    }

                    let profilePic = rev.user_profile_pic;
                    if (!profilePic || profilePic === 'null' || profilePic === 'undefined') {
                        profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.user_name)}&background=6366f1&color=fff`;
                    } else if (typeof profilePic === 'string' && !profilePic.startsWith('http')) {
                        profilePic = profilePic.startsWith('/') ? profilePic : '/' + profilePic;
                    }

                    return `
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 0.75rem 1rem; border-radius: 10px; display: flex; flex-direction: column; gap: 0.35rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <img src="${profilePic}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary);">
                                    <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">${rev.user_name}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="font-size: 0.7rem; color: var(--text-muted);">${new Date(rev.created_at).toLocaleDateString()}</span>
                                    ${deleteBtn}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="display: flex; gap: 1px;">${starsHTML}</div>
                            </div>
                            ${rev.comment ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">${rev.comment}</p>` : ''}
                        </div>
                    `;
                }).join('');
            }
        }

        // Show/Hide Add Review Form
        const addSection = document.getElementById('add-review-section');
        if (addSection) {
            const isStudent = currentUser && (currentUser.role || '').toLowerCase() === 'student';
            const isRegistered = myRegistrationIds.has(parseInt(eventId));
            const hasReviewed = reviews.some(rev => rev.user_id === currentUser.id);

            if (isStudent && isRegistered && !hasReviewed) {
                addSection.style.display = 'block';
            } else {
                addSection.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

async function submitEventReview() {
    if (!currentDetailEventId) return;
    if (currentSelectedRatingInput < 1 || currentSelectedRatingInput > 5) {
        showToast('Please select a star rating.', 'error');
        return;
    }

    const commentInput = document.getElementById('review-comment-input');
    const comment = commentInput ? commentInput.value.trim() : '';

    try {
        const res = await apiFetch(`/api/events/${currentDetailEventId}/reviews`, {
            method: 'POST',
            body: JSON.stringify({ rating: currentSelectedRatingInput, comment })
        });

        showToast(res.message || 'Review submitted successfully!', 'success');
        
        currentSelectedRatingInput = 0;
        if (commentInput) commentInput.value = '';
        document.querySelectorAll('#rating-stars-input .star-btn').forEach(s => s.style.color = '#475569');

        await loadEventReviews(currentDetailEventId);
        loadEvents(true);
    } catch (err) {
        showToast(err.message || 'Failed to submit review.', 'error');
    }
}

async function deleteEventReview(reviewId) {
    if (!currentDetailEventId) return;
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
        const res = await apiFetch(`/api/events/${currentDetailEventId}/reviews/${reviewId}`, {
            method: 'DELETE'
        });

        showToast(res.message || 'Review deleted successfully.', 'success');
        await loadEventReviews(currentDetailEventId);
        loadEvents(true);
    } catch (err) {
        showToast(err.message || 'Failed to delete review.', 'error');
    }
}

function showAdminRestrictModal() {
    const modal = document.getElementById('admin-restrict-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
    }
}
window.showAdminRestrictModal = showAdminRestrictModal;

function closeAdminRestrictModal() {
    const modal = document.getElementById('admin-restrict-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.opacity = '1';
        }, 200);
    }
}
window.closeAdminRestrictModal = closeAdminRestrictModal;
