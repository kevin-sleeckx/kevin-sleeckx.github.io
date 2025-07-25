// Normalize transactions in localStorage: hours as 'X uur Y min', description as 'toegevoegd', 'opgenomen', or reason for adjustment
function normalizeTransactions() {
    if (!Array.isArray(transactions) || transactions.length === 0) {
        alert('Geen transacties gevonden om te normaliseren.');
        return;
    }
    let changed = false;
    transactions = transactions.map(t => {
        // Normalize type to English if needed
        let type = t.type;
        if (type === 'toevoegen' || type === 'toegevoegd' || type === 'add' || type === 'plus') type = 'overtime';
        if (type === 'opnemen' || type === 'opgenomen' || type === 'oppakken' || type === 'take' || type === 'min') type = 'take';
        if (type === 'aanpassing' || type === 'adjustment' || type === 'correctie' || type === 'correction') type = 'adjustment';

        let newDesc = t.description || '';
        if (type === 'overtime' || type === 'take') {
            // Always use 'X uur Y min' format, never decimal
            let urenStr = '';
            if (typeof t.hours === 'number' && !isNaN(t.hours)) {
                urenStr = decimalToHoursMinutes(t.hours);
            }
            if (urenStr === '0m') urenStr = '';
            const actie = type === 'overtime' ? 'toegevoegd' : 'opgenomen';
            newDesc = urenStr ? `${urenStr} ${actie}` : actie;
        } else if (type === 'adjustment') {
            newDesc = t.description || 'Aanpassing';
        }
        // Only update if changed
        if (t.description !== newDesc || t.type !== type) {
            changed = true;
            return { ...t, description: newDesc, type };
        }
        return t;
    });
    if (changed) {
        localStorage.setItem('transactions', JSON.stringify(transactions));
        alert('Transacties zijn succesvol genormaliseerd!');
    } else {
        alert('Alle transacties zijn al uniform.');
    }
}
// Helper to convert decimal hours to "X uur Y min" format
function decimalToHoursMinutes(decimal) {
    if (typeof decimal !== 'number' || isNaN(decimal)) return '';
    const abs = Math.abs(decimal);
    const hours = Math.floor(abs);
    const minutes = Math.round((abs - hours) * 60);
    let result = '';
    if (hours > 0) result += hours + 'u';
    if (minutes > 0) result += (hours > 0 ? ' ' : '') + minutes + 'm';
    if (result === '') result = '0m';
    return result;
}
// Core data management
let dailyWage = parseFloat(localStorage.getItem('dailyWage')) || 0;
let startingAmount = parseFloat(localStorage.getItem('startingAmount')) || 0;
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let employeeName = localStorage.getItem('employeeName') || '';
let currentDate = new Date();

// Version management
const CURRENT_VERSION = '1.7.13';
const LAST_VERSION_KEY = 'app_version';

// Update version display in the UI
function updateVersionDisplay() {
    const versionInfo = document.getElementById('versionInfo');
    if (versionInfo) {
        const lastUpdatedDate = new Date();
        const lastUpdated = `${lastUpdatedDate.getDate().toString().padStart(2, '0')}-${(lastUpdatedDate.getMonth() + 1).toString().padStart(2, '0')}-${lastUpdatedDate.getFullYear()}`;
        versionInfo.textContent = `Versie ${CURRENT_VERSION} – Laatst bijgewerkt: ${lastUpdated}`;
        console.log('[Version] Display updated to:', CURRENT_VERSION);
    }
}

async function checkVersion() {
    console.log('[Version] Checking version...');
    console.log('[Version] Current version:', CURRENT_VERSION);
    const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
    console.log('[Version] Last version from storage:', lastVersion);

    if (lastVersion !== CURRENT_VERSION) {
        console.log('[Version] Nieuwe update gedetecteerd! Versie wordt bijgewerkt naar', CURRENT_VERSION);
        // Clear cache to force reload of new assets
        if ('caches' in window) {
            try {
                console.log('[Cache] Alle caches worden gewist voor een schone update...');
                const cacheKeys = await caches.keys();
                console.log('[Cache] Gevonden caches:', cacheKeys);
                await Promise.all(
                    cacheKeys.map(key => caches.delete(key))
                );
                console.log('[Cache] Alle caches succesvol gewist');
            } catch (err) {
                console.error('[Cache] Fout bij wissen van cache:', err);
            }
        }

        // Maak een volledige JSON-backup vóór normalisatie
        try {
            if (typeof exportData === 'function') {
                exportData();
                console.log('[Backup] Volledige JSON-backup gemaakt na update.');
            } else {
                console.warn('[Backup] exportData functie niet gevonden, backup niet gemaakt.');
            }
        } catch (err) {
            console.error('[Backup] Fout bij maken van backup:', err);
        }

        // Voer automatisch normalisatie uit
        try {
            if (typeof normalizeTransactions === 'function') {
                normalizeTransactions();
                console.log('[Normalisatie] Transacties automatisch genormaliseerd na update.');
            } else {
                console.warn('[Normalisatie] normalizeTransactions functie niet gevonden, normalisatie niet uitgevoerd.');
            }
        } catch (err) {
            console.error('[Normalisatie] Fout bij normaliseren van transacties:', err);
        }

        // Update stored version
        localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
    }
}

// PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        console.log('[SW] Browser supports Service Workers');
        
        // Track if we're refreshing to avoid multiple refreshes
        let refreshing = false;

        // Only listen for REFRESH_NEEDED to log, do not reload here
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'REFRESH_NEEDED') {
                console.log('[SW] Refresh message received');
                // Do not reload here! Wait for controllerchange event.
            }
        });

        // Always auto-refresh on controllerchange
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] Controller change event received');
            if (!refreshing) {
                refreshing = true;
                console.log('[SW] Triggering page reload...');
                setTimeout(() => {
                    window.location.reload(true);
                }, 100); // Small delay to ensure service worker is ready
            }
        });

        // Function to check for updates
        function checkForUpdates(registration) {
            if (registration.waiting) {
                console.log('[SW] New version waiting to activate');
                showUpdateNotification();
                return;
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[SW] Update found, new worker state:', newWorker.state);
                
                newWorker.addEventListener('statechange', () => {
                    console.log('[SW] New worker state changed to:', newWorker.state);
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SW] New version installed, showing notification');
                        showUpdateNotification();
                    }
                });
            });
        }

        // Register and check for updates
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('[SW] Registration successful. Scope:', registration.scope);
                
                // Check for updates immediately
                checkForUpdates(registration);

                // Periodically check for updates (every 60 minutes)
                setInterval(() => {
                    console.log('[SW] Checking for updates...');
                    registration.update().then(() => checkForUpdates(registration));
                }, 60 * 60 * 1000);

                // Show install button if app is installable
                window.addEventListener('beforeinstallprompt', (e) => {
                    console.log('[Install] Install prompt event received');
                    e.preventDefault();
                    const installBtn = document.getElementById('installBtn');
                    installBtn.style.display = 'block';
                    installBtn.onclick = () => {
                        e.prompt();
                        e.userChoice.then((choiceResult) => {
                            console.log('[Install] User choice:', choiceResult.outcome);
                            if (choiceResult.outcome === 'accepted') {
                                installBtn.style.display = 'none';
                            }
                        });
                    };
                });
            })
            .catch(error => {
                console.error('[SW] Registration failed:', error);
            });
    } else {
        console.log('[SW] Service Workers not supported');
    }
}

// Update notification functions
function showUpdateNotification() {
    console.log('[Update] Showing update notification');
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.style.display = 'flex';
    }
}

function updateApp() {
    console.log('[Update] Update button clicked');
    
    // Hide the notification
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.style.display = 'none';
    }

    // Get the registration and trigger update
    navigator.serviceWorker.getRegistration().then(async registration => {
        console.log('[Update] Current registration state:', {
            waiting: !!registration?.waiting,
            active: !!registration?.active,
            installing: !!registration?.installing
        });

        if (registration && registration.waiting) {
            try {
                console.log('[Update] Found waiting worker, clearing caches...');
                const cacheKeys = await caches.keys();
                console.log('[Update] Found caches to clear:', cacheKeys);
                await Promise.all(
                    cacheKeys.map(key => {
                        console.log('[Update] Deleting cache:', key);
                        return caches.delete(key);
                    })
                );
                console.log('[Update] All caches cleared, sending skip waiting message');
                
                // Skip waiting on the service worker
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                console.log('[Update] Skip waiting message sent');
            } catch (err) {
                console.error('[Update] Error during update:', err);
            }
        } else {
            console.log('[Update] No waiting worker found');
        }
    }).catch(err => {
        console.error('[Update] Error getting registration:', err);
    });
}

// Correct ISO 8601 week number and year calculation
function getISOWeekData(date) {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

    // Get the day number (Monday = 1, Sunday = 7)
    const dayNr = (target.getUTCDay() + 6) % 7 + 1;

    // Set target to Thursday in current week
    target.setUTCDate(target.getUTCDate() + (4 - dayNr));

    // ISO year is the year of the Thursday
    const isoYear = target.getUTCFullYear();

    // Get Thursday of the first ISO week
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstThursdayDayNr = (firstThursday.getUTCDay() + 6) % 7 + 1;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - (firstThursdayDayNr - 4));

    // Calculate ISO week number
    const weekNumber = 1 + Math.floor((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));

    return { weekNumber, year: isoYear };
}

// Handle PWA shortcuts
function handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action) {
        switch (action) {
            case 'add':
                switchTab('add');
                break;
            case 'take':
                switchTab('take');
                break;
            case 'adjustment':
                switchTab('adjustment');
                break;
        }
    }
}

// Helper functions for hours/minutes validation and conversion
function validateMinutes(minutes) {
    const allowedMinutes = [0, 15, 30, 45];
    return allowedMinutes.includes(parseInt(minutes));
}

function convertHoursMinutesToDecimal(hours, minutes) {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    
    // Validate inputs
    if (h < 0 || h > 24) return null;
    if (!validateMinutes(m)) return null;
    if (h === 0 && m === 0) return null; // At least one field must be filled
    
    return h + (m / 60);
}

function getOvertimeHours() {
    const hours = document.getElementById('overtimeHours').value;
    const minutes = document.getElementById('overtimeMinutes').value;
    return convertHoursMinutesToDecimal(hours, minutes);
}

function getTakeHours() {
    const hours = document.getElementById('takeHours').value;
    const minutes = document.getElementById('takeMinutes').value;
    return convertHoursMinutesToDecimal(hours, minutes);
}

// Validation for minutes input
function validateMinutesInput(inputElement) {
    const value = parseInt(inputElement.value);
    if (inputElement.value !== '' && !validateMinutes(value)) {
        inputElement.setCustomValidity('Alleen 0, 15, 30, of 45 minuten toegestaan');
        inputElement.reportValidity();
        return false;
    } else {
        inputElement.setCustomValidity('');
        return true;
    }
}

// Add event listeners for minutes validation
document.addEventListener('DOMContentLoaded', function() {
    const overtimeMinutes = document.getElementById('overtimeMinutes');
    const takeMinutes = document.getElementById('takeMinutes');
    
    if (overtimeMinutes) {
        overtimeMinutes.addEventListener('blur', function() {
            validateMinutesInput(this);
        });
    }
    
    if (takeMinutes) {
        takeMinutes.addEventListener('blur', function() {
            validateMinutesInput(this);
        });
    }
});

const earnMultipliers = {
    dag: 1.5,    // +50%
    vroege: 1.55, // +55%
    late: 1.65,  // +65%
    nacht: 2.0,   // +100%
    feestdag: 2.5 // +150%
};

// Additional deduction multipliers for taking overtime
const takeMultipliers = {
    dag: 1.0,    // Base rate (0% additional)
    vroege: 1.05, // +5% additional deduction
    late: 1.15,  // +15% additional deduction
    nacht: 1.5   // +50% additional deduction
};

// Tab switching function
function switchTab(tabName) {
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    document.querySelector(`.tab-${tabName}`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Initialize app
async function init() {
    await checkVersion(); // wacht op versiecontrole, inclusief eventuele reload

    // Alleen verdergaan als er geen reload gebeurde
    updateTotalDisplay();
    updateWageDisplay();
    updateStartingDisplay();
    updateEmployeeNameDisplay();
    setDefaultDates();
    renderCalendar();
    checkBackupReminder();
    registerServiceWorker();
    handleURLParams();
    updateVersionDisplay();
}

// PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        console.log('[SW] Browser supports Service Workers');
        
        // Track if we're refreshing to avoid multiple refreshes
        let refreshing = false;

        // Only listen for REFRESH_NEEDED to log, do not reload here
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'REFRESH_NEEDED') {
                console.log('[SW] Refresh message received');
                // Do not reload here! Wait for controllerchange event.
            }
        });

        // Always auto-refresh on controllerchange
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] Controller change event received');
            if (!refreshing) {
                refreshing = true;
                console.log('[SW] Triggering page reload...');
                setTimeout(() => {
                    window.location.reload(true);
                }, 100); // Small delay to ensure service worker is ready
            }
        });

        // Function to check for updates
        function checkForUpdates(registration) {
            if (registration.waiting) {
                console.log('[SW] New version waiting to activate');
                showUpdateNotification();
                return;
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[SW] Update found, new worker state:', newWorker.state);
                
                newWorker.addEventListener('statechange', () => {
                    console.log('[SW] New worker state changed to:', newWorker.state);
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SW] New version installed, showing notification');
                        showUpdateNotification();
                    }
                });
            });
        }

        // Register and check for updates
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('[SW] Registration successful. Scope:', registration.scope);
                
                // Check for updates immediately
                checkForUpdates(registration);

                // Periodically check for updates (every 60 minutes)
                setInterval(() => {
                    console.log('[SW] Checking for updates...');
                    registration.update().then(() => checkForUpdates(registration));
                }, 60 * 60 * 1000);

                // Show install button if app is installable
                window.addEventListener('beforeinstallprompt', (e) => {
                    console.log('[Install] Install prompt event received');
                    e.preventDefault();
                    const installBtn = document.getElementById('installBtn');
                    installBtn.style.display = 'block';
                    installBtn.onclick = () => {
                        e.prompt();
                        e.userChoice.then((choiceResult) => {
                            console.log('[Install] User choice:', choiceResult.outcome);
                            if (choiceResult.outcome === 'accepted') {
                                installBtn.style.display = 'none';
                            }
                        });
                    };
                });
            })
            .catch(error => {
                console.error('[SW] Registration failed:', error);
            });
    } else {
        console.log('[SW] Service Workers not supported');
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('overtimeDate').value = today;
    document.getElementById('takeDate').value = today;
    document.getElementById('adjustmentDate').value = today;
}

// Starting Amount Management
function saveStartingAmount() {
    const amount = parseFloat(document.getElementById('startingAmount').value);
    if (isNaN(amount)) {
        alert('Voer een geldig startbedrag in');
        return;
    }
    startingAmount = amount;
    localStorage.setItem('startingAmount', startingAmount.toString());
    updateStartingDisplay();
    updateTotalDisplay();
    alert('Startbedrag succesvol opgeslagen!');
}

function updateStartingDisplay() {
    document.getElementById('startingAmount').value = startingAmount;
}

// Daily Wage Management (Hidden by default)
function toggleConfigSection() {
    const section = document.getElementById('configSection');
    const btn = document.getElementById('toggleConfigBtn');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '🔒 Configuratie Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '⚙️ Configuratie Opties';
    }
}

function updateWageDisplay() {
    if (dailyWage > 0) {
        document.getElementById('dailyWage').value = dailyWage;
    }
}

// Employee Name Management
function saveEmployeeName() {
    const name = document.getElementById('employeeNameConfig').value.trim();
    if (!name) {
        alert('Voer een geldige naam in');
        return;
    }
    employeeName = name;
    localStorage.setItem('employeeName', employeeName);
    alert('Naam succesvol opgeslagen!');
}

function updateEmployeeNameDisplay() {
    document.getElementById('employeeNameConfig').value = employeeName;
}

// Calendar Functions
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update title
    const monthNames = [
        'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
        'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
    ];
    document.getElementById('calendarTitle').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    
    // Monday is first day of week (1), so adjust
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    // Day headers (Monday first)
    const dayHeaders = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        const prevMonth = new Date(year, month, 0);
        const prevDay = prevMonth.getDate() - firstDayOfWeek + i + 1;
        emptyDay.textContent = prevDay;
        grid.appendChild(emptyDay);
    }
    
    // Days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTransactions = getDayTransactions(dateStr);
        const dayTotal = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Add classes based on day total
        if (dayTotal > 0) {
            dayElement.classList.add('positive');
        } else if (dayTotal < 0) {
            dayElement.classList.add('negative');
        }
        
        // Mark today
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        dayElement.addEventListener('click', () => showDayDetails(dateStr));
        grid.appendChild(dayElement);
    }
    
    // Fill remaining cells
    const remainingCells = 42 - (firstDayOfWeek + lastDay.getDate());
    for (let day = 1; day <= remainingCells; day++) {
        const nextDay = document.createElement('div');
        nextDay.className = 'calendar-day other-month';
        nextDay.textContent = day;
        grid.appendChild(nextDay);
    }
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

function getDayTransactions(dateStr) {
    return transactions.filter(t => t.date === dateStr);
}

function showDayDetails(dateStr) {
    const dayTransactions = getDayTransactions(dateStr);
    const dayTotal = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const date = new Date(dateStr);
    const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    const monthNames = [
        'januari', 'februari', 'maart', 'april', 'mei', 'juni',
        'juli', 'augustus', 'september', 'oktober', 'november', 'december'
    ];
    
    document.getElementById('modalDate').textContent = 
        `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    
    // Update day total with new color classes
    const dayTotalElement = document.getElementById('dayTotal');
    dayTotalElement.textContent = dayTotal.toFixed(2).replace('.', ',');
    dayTotalElement.classList.remove('positive-amount', 'negative-amount');
    if (dayTotal >= 0) {
        dayTotalElement.classList.add('positive-amount');
    } else {
        dayTotalElement.classList.add('negative-amount');
    }
    
    const container = document.getElementById('dailyTransactions');
    if (dayTransactions.length === 0) {
        container.innerHTML = '<p class="text-center small-text">Geen transacties voor deze dag.</p>';
    } else {
        container.innerHTML = dayTransactions.map(transaction => {
            const isPositive = transaction.amount > 0;
            const shiftBadge = transaction.shiftType ? 
                `<span class="shift-badge ${transaction.shiftType}">${transaction.shiftType}</span>` : '';
            // Show hours/minutes if present, else show amount
            let extraInfo = '';
            if (typeof transaction.hours === 'number' && !isNaN(transaction.hours)) {
                extraInfo = `<span style=\"margin-left:8px; color:#888; font-size:0.95em;\">(${decimalToHoursMinutes(transaction.hours)})</span>`;
            }
            return `
                <div class="daily-transaction ${isPositive ? 'positive' : 'negative'}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <strong>${transaction.description}</strong>
                            <div style="margin-top: 5px;">
                                ${shiftBadge}
                                <span style="margin-left: 10px; font-weight: bold;" class="${isPositive ? 'positive-amount' : 'negative-amount'}">
                                    ${isPositive ? '+' : ''}€${Math.abs(transaction.amount).toFixed(2).replace('.', ',')}
                                </span>
                                ${extraInfo}
                            </div>
                        </div>
                        <button class="button danger" style="padding: 6px 12px; font-size: 12px; margin-left: 12px;" 
                                onclick="deleteTransaction(${transaction.id})" 
                                title="Transactie verwijderen">
                            🗑️ Verwijderen
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    document.getElementById('dailyModal').style.display = 'block';

    // Add event listeners for quick add buttons
    setTimeout(() => {
        const addBtn = document.getElementById('addOvertimeFromDayBtn');
        const takeBtn = document.getElementById('takeOvertimeFromDayBtn');
        const adjustmentBtn = document.getElementById('addOrderFromDayBtn');
        const tabNav = document.querySelector('.tab-navigation');
        if (addBtn) {
            addBtn.onclick = function() {
                switchTab('add');
                document.getElementById('overtimeDate').value = dateStr;
                closeDailyModal();
                setTimeout(() => {
                    if (tabNav) tabNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            };
        }
        if (takeBtn) {
            takeBtn.onclick = function() {
                switchTab('take');
                document.getElementById('takeDate').value = dateStr;
                closeDailyModal();
                setTimeout(() => {
                    if (tabNav) tabNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            };
        }
        if (adjustmentBtn) {
            adjustmentBtn.onclick = function() {
                switchTab('adjustment');
                document.getElementById('adjustmentDate').value = dateStr;
                closeDailyModal();
                setTimeout(() => {
                    if (tabNav) tabNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            };
        }

        // Add event listeners for prev/next day
        const prevBtn = document.getElementById('prevDayBtn');
        const nextBtn = document.getElementById('nextDayBtn');
        if (prevBtn) {
            prevBtn.onclick = function(e) {
                e.stopPropagation();
                const prevDate = getAdjacentDay(dateStr, -1);
                showDayDetails(prevDate);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = function(e) {
                e.stopPropagation();
                const nextDate = getAdjacentDay(dateStr, 1);
                showDayDetails(nextDate);
            };
        }
    }, 0);
}

function getAdjacentDay(dateStr, offset) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
}

// Delete individual transaction
function deleteTransaction(transactionId) {
    if (confirm('Weet u zeker dat u deze transactie wilt verwijderen?')) {
        transactions = transactions.filter(t => t.id !== transactionId);
        saveTransactions();
        updateTotalDisplay();
        renderCalendar();
        
        // Refresh the modal if it's still open
        const modal = document.getElementById('dailyModal');
        if (modal.style.display === 'block') {
            // Find the date from the modal title and refresh
            const modalTitle = document.getElementById('modalDate').textContent;
            // Extract date and re-show details
            const currentModalDate = getCurrentModalDate();
            if (currentModalDate) {
                showDayDetails(currentModalDate);
            } else {
                closeDailyModal();
            }
        }
        
        alert('Transactie succesvol verwijderd!');
    }
}

// Helper function to get current modal date
function getCurrentModalDate() {
    try {
        const modalTitle = document.getElementById('modalDate').textContent;
        const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
        const monthNames = [
            'januari', 'februari', 'maart', 'april', 'mei', 'juni',
            'juli', 'augustus', 'september', 'oktober', 'november', 'december'
        ];
        
        // Parse the modal title to extract date
        const parts = modalTitle.split(' ');
        if (parts.length >= 4) {
            const day = parseInt(parts[1]);
            const monthName = parts[2];
            const year = parseInt(parts[3]);
            const month = monthNames.indexOf(monthName);
            
            if (month !== -1) {
                return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    } catch (error) {
        console.error('Error parsing modal date:', error);
    }
    return null;
}

function closeDailyModal() {
    document.getElementById('dailyModal').style.display = 'none';
}

// Backup reminder system
function checkBackupReminder() {
    const now = new Date();
    const lastBackup = localStorage.getItem('lastBackupWeek');
    const currentWeek = getWeekNumber(now);
    
    // Show weekly backup reminder only on Fridays at 12:00
    const isFriday = now.getDay() === 5; // 0 = Sunday, 5 = Friday
    const isNoonHour = now.getHours() === 12;
    
    if (isFriday && isNoonHour && lastBackup !== currentWeek.toString()) {
        const modal = document.getElementById('weeklyBackupModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
}

function closeWeeklyBackupModal() {
    const modal = document.getElementById('weeklyBackupModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        // Save that we've shown it this week
        const currentWeek = getWeekNumber(new Date());
        localStorage.setItem('lastBackupWeek', currentWeek.toString());
    }
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function markBackupDone() {
    const currentWeek = getWeekNumber(new Date());
    localStorage.setItem('lastBackupWeek', currentWeek.toString());
    document.getElementById('backupReminder').classList.remove('show');
}

// Wage management
function saveDailyWage() {
    const wage = parseFloat(document.getElementById('dailyWage').value);
    if (wage <= 0) {
        alert('Voer een geldig dagloon in');
        return;
    }
    dailyWage = wage;
    localStorage.setItem('dailyWage', dailyWage.toString());
    updateWageDisplay();
    updateEarnPreview();
    updateTakePreview();
    alert('Dagloon succesvol opgeslagen!');
}

function updateWageDisplay() {
    if (dailyWage > 0) {
        document.getElementById('dailyWage').value = dailyWage;
    }
}

// Calculation functions
function calculateEarnings(hours, shiftType) {
    if (dailyWage <= 0) return 0;
    const hourlyRate = dailyWage / 7.25;
    const multiplier = earnMultipliers[shiftType];
    return hourlyRate * hours * multiplier;
}

function calculateDeduction(hours, shiftType) {
    if (dailyWage <= 0) return 0;
    const hourlyRate = dailyWage / 7.25;
    const multiplier = takeMultipliers[shiftType];
    return hourlyRate * hours * multiplier;
}

// Calculation preview toggle
let showCalculations = true;
function toggleShowCalculations() {
    showCalculations = document.getElementById('showCalcCheckbox').checked;
    updateEarnPreview();
    updateTakePreview();
}

// Patch preview functions to respect toggle
function updateEarnPreview() {
    const actualHours = getOvertimeHours();
    const shiftType = document.getElementById('shiftType').value;
    if (!showCalculations) {
        document.getElementById('earnPreview').style.display = 'none';
        return;
    }
    if (actualHours && actualHours > 0 && dailyWage > 0) {
        const earnings = calculateEarnings(actualHours, shiftType);
        const hourlyRate = dailyWage / 7.25;
        const multiplier = earnMultipliers[shiftType];
        const percentage = ((multiplier - 1) * 100).toFixed(0);
        document.getElementById('earnCalculation').innerHTML = `
            <div>Dagloon: €${dailyWage.toFixed(2).replace('.', ',')}</div>
            <div>Uurloon: €${dailyWage.toFixed(2).replace('.', ',')} ÷ 7,25 = €${hourlyRate.toFixed(2).replace('.', ',')}</div>
            <div>Overuren: ${actualHours} uur × €${hourlyRate.toFixed(2).replace('.', ',')} × ${multiplier} (+${percentage}%) = <strong>€${earnings.toFixed(2).replace('.', ',')}</strong></div>
        `;
        document.getElementById('earnPreview').style.display = 'block';
    } else {
        document.getElementById('earnPreview').style.display = 'none';
    }
}

function updateTakePreview() {
    const actualHours = getTakeHours();
    const shiftType = document.getElementById('takeShiftType').value;
    if (!showCalculations) {
        document.getElementById('takePreview').style.display = 'none';
        return;
    }
    if (actualHours && actualHours > 0 && dailyWage > 0) {
        const deduction = calculateDeduction(actualHours, shiftType);
        const hourlyRate = dailyWage / 7.25;
        const multiplier = takeMultipliers[shiftType];
        const percentage = ((multiplier - 1) * 100).toFixed(0);
        let calculationText = `
            <div>Dagloon: €${dailyWage.toFixed(2).replace('.', ',')}</div>
            <div>Basis Uurloon: €${dailyWage.toFixed(2).replace('.', ',')} ÷ 7,25 = €${hourlyRate.toFixed(2).replace('.', ',')}</div>
        `;
        if (multiplier > 1) {
            calculationText += `<div>Opname Tarief: €${hourlyRate.toFixed(2).replace('.', ',')} × ${multiplier} (+${percentage}% extra) = €${(hourlyRate * multiplier).toFixed(2).replace('.', ',')}</div>`;
        }
        calculationText += `<div>Aftrekking: ${actualHours} uur × €${(hourlyRate * multiplier).toFixed(2).replace('.', ',')} = <strong>-€${deduction.toFixed(2).replace('.', ',')}</strong></div>`;
        document.getElementById('takeCalculation').innerHTML = calculationText;
        document.getElementById('takePreview').style.display = 'block';
    } else {
        document.getElementById('takePreview').style.display = 'none';
    }
}

// Transaction functions
function addOvertime() {
    const date = document.getElementById('overtimeDate').value;
    const actualHours = getOvertimeHours();
    const shiftType = document.getElementById('shiftType').value;
    
    if (!date) {
        alert('Vul een datum in');
        return;
    }
    
    if (!actualHours || actualHours <= 0) {
        alert('Vul geldige overuren in (minimaal één veld invullen)');
        return;
    }
    
    if (dailyWage <= 0) {
        alert('Stel eerst een dagloon in');
        return;
    }
    
    const earnings = calculateEarnings(actualHours, shiftType);
    
    const transaction = {
        id: Date.now(),
        type: 'overtime',
        date: date,
        hours: actualHours,
        shiftType: shiftType,
        amount: earnings,
        description: `${actualHours}u overuren (${shiftType} dienst)`
    };
    
    transactions.unshift(transaction);
    saveTransactions();
    updateTotalDisplay();
    renderCalendar();
    
    // Reset form
    document.getElementById('overtimeHours').value = '';
    document.getElementById('overtimeMinutes').value = '';
    document.getElementById('earnPreview').style.display = 'none';
    
    alert(`€${earnings.toFixed(2).replace('.', ',')} toegevoegd aan uw saldo!`);
}

function takeOvertime() {
    const date = document.getElementById('takeDate').value;
    const actualHours = getTakeHours();
    const shiftType = document.getElementById('takeShiftType').value;
    
    if (!date) {
        alert('Vul een datum in');
        return;
    }
    
    if (!actualHours || actualHours <= 0) {
        alert('Vul geldige uren in (minimaal één veld invullen)');
        return;
    }
    
    if (dailyWage <= 0) {
        alert('Stel eerst een dagloon in');
        return;
    }
    
    const deduction = calculateDeduction(actualHours, shiftType);
    
    const transaction = {
        id: Date.now(),
        type: 'take',
        date: date,
        hours: actualHours,
        shiftType: shiftType,
        amount: -deduction,
        description: `${actualHours}u overuren opgenomen (${shiftType} dienst)`
    };
    
    transactions.unshift(transaction);
    saveTransactions();
    updateTotalDisplay();
    renderCalendar();
    
    // Reset form
    document.getElementById('takeHours').value = '';
    document.getElementById('takeMinutes').value = '';
    document.getElementById('takePreview').style.display = 'none';
    
    alert(`€${deduction.toFixed(2).replace('.', ',')} afgetrokken van uw saldo!`);
}

function addAdjustment() {
    const date = document.getElementById('adjustmentDate').value;
    const type = document.getElementById('adjustmentType').value;
    const amount = parseFloat(document.getElementById('adjustmentAmount').value);
    const description = document.getElementById('adjustmentDescription').value || 'Aanpassing';
    if (!date || isNaN(amount) || amount <= 0) {
        alert('Vul datum en een positief bedrag in');
        return;
    }
    const signedAmount = type === 'positive' ? amount : -amount;
    const transaction = {
        id: Date.now(),
        type: 'adjustment',
        date: date,
        amount: signedAmount,
        description: description
    };
    transactions.unshift(transaction);
    saveTransactions();
    updateTotalDisplay();
    renderCalendar();
    // Reset form
    document.getElementById('adjustmentAmount').value = '';
    document.getElementById('adjustmentDescription').value = '';
    alert(`€${Math.abs(amount).toFixed(2).replace('.', ',')} ${(type === 'positive' ? 'toegevoegd' : 'afgetrokken')} (${description})`);
}

function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function updateTotalDisplay() {
    const transactionTotal = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const grandTotal = startingAmount + transactionTotal;
    document.getElementById('totalAmount').textContent = grandTotal.toFixed(2).replace('.', ',');
    
    // Color coding for total using new CSS classes
    const totalElement = document.getElementById('totalAmount');
    totalElement.classList.remove('positive-amount', 'negative-amount');
    if (grandTotal >= 0) {
        totalElement.classList.add('positive-amount');
    } else {
        totalElement.classList.add('negative-amount');
    }
}

// PDF Export Function (Updated - no daily wage, includes starting amount)
async function exportToPDF() {
    if (!employeeName) {
        alert('Stel eerst uw naam in bij de configuratie voordat u exporteert.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const transactionTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
    const grandTotal = startingAmount + transactionTotal;
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Overuren Rapport', 20, 30);
    doc.setFontSize(12);
    doc.text(`Naam: ${employeeName}`, 20, 45);
    doc.text(`Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}`, 20, 55);
    doc.text(`Start Bedrag: €${startingAmount.toFixed(2).replace('.', ',')}`, 20, 65);
    doc.text(`Verdiend/Opgenomen: €${transactionTotal.toFixed(2).replace('.', ',')}`, 20, 75);
    doc.text(`Totaal Saldo: €${grandTotal.toFixed(2).replace('.', ',')}`, 20, 85);
    let yPosition = 105;
    if (transactions.length === 0) {
        doc.text('Geen transacties geregistreerd.', 20, yPosition);
    } else {
        // Sort all transactions by date descending (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Group transactions by ISO week
        const weeklyGroups = [];
        let currentWeekData = null;
        
        sortedTransactions.forEach(t => {
            const date = new Date(t.date);
            // Get ISO week number and year for proper week boundaries
            const { weekNumber, year: isoYear } = getISOWeekData(date);
            const weekKey = `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
            
            // If this is a new week or first transaction, create new week group
            if (!currentWeekData || currentWeekData.weekKey !== weekKey) {
                if (currentWeekData) {
                    weeklyGroups.push(currentWeekData);
                }
                
                currentWeekData = {
                    weekKey: weekKey,
                    weekNumber: weekNumber,
                    year: isoYear,
                    transactions: [],
                    total: 0
                };
            }
            
            // Add transaction to current week
            currentWeekData.transactions.push(t);
            currentWeekData.total += t.amount;
        });
        
        // Add the last week group
        if (currentWeekData) {
            weeklyGroups.push(currentWeekData);
        }
        
        // Check if we need a new page
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 30;
        }
        
        // Prepare table data with all transactions and weekly summaries
        const tableData = [];
        weeklyGroups.forEach((weekData, weekIndex) => {
            // Add spacing before each week (except the first one)
            if (weekIndex > 0) {
                tableData.push(['', '', '', '']);
            }
            // Add all transactions for this week
            weekData.transactions.forEach(t => {
                let beschrijving = '';
                if (t.type === 'overtime' || t.type === 'take') {
                    const uren = (typeof t.hours === 'number' && !isNaN(t.hours)) ? decimalToHoursMinutes(t.hours) : '';
                    const actie = t.type === 'overtime' ? 'toegevoegd' : 'opgenomen';
                    beschrijving = `${uren ? uren + ' ' : ''}${actie}`;
                } else if (t.type === 'adjustment') {
                    beschrijving = t.description;
                } else {
                    beschrijving = t.description;
                }
                // Format amount with sign, space, and euro symbol
                let amountStr = '';
                if (t.amount > 0) {
                    amountStr = `+ ${t.amount.toFixed(2).replace('.', ',')} €`;
                } else {
                    amountStr = `- ${Math.abs(t.amount).toFixed(2).replace('.', ',')} €`;
                }
                tableData.push([
                    new Date(t.date).toLocaleDateString('nl-NL'),
                    beschrijving,
                    t.shiftType || '-',
                    amountStr
                ]);
            });
            // Add weekly summary row - using ISO week year
            const weekSummaryText = `Week ${weekData.weekNumber} (${weekData.year}) - Totaal`;
            const weekTotalFormatted = (weekData.total >= 0 ? '+ ' : '- ') + `${Math.abs(weekData.total).toFixed(2).replace('.', ',')} €`;
            tableData.push(['', weekSummaryText, '', weekTotalFormatted]);
        });
        
        doc.autoTable({
            startY: yPosition,
            head: [['Datum', 'Beschrijving', 'Shift', 'Bedrag']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [108, 117, 125] }, // Gray header (#6c757d)
            columnStyles: {
                3: {
                    textColor: function(data) {
                        // Always parse the numeric value for color logic
                        let val = data.cell.text[0];
                        let num = parseFloat(val.replace(/[^\d,\.-]/g, '').replace(',', '.'));
                        if (val.trim().startsWith('-')) num = -Math.abs(num);
                        if (val.trim().startsWith('+')) num = Math.abs(num);
                        if (num > 0) return [34, 139, 34]; // soft green
                        if (num < 0) return [220, 53, 69]; // soft red
                        return [0, 0, 0];
                    }
                }
            },
            didParseCell: function(data) {
                // Style empty spacing rows
                if (data.row.raw[0] === '' && data.row.raw[1] === '' && data.row.raw[2] === '' && data.row.raw[3] === '') {
                    data.cell.styles.minCellHeight = 8; // Add height for spacing
                    data.cell.styles.fillColor = [255, 255, 255]; // White background
                    data.cell.styles.lineColor = [255, 255, 255]; // Hide borders
                    data.cell.styles.lineWidth = 0; // No border
                    return;
                }
                // Style weekly summary rows
                if (data.row.raw[1] && data.row.raw[1].includes('Week ') && data.row.raw[1].includes('Totaal')) {
                    data.cell.styles.fillColor = [173, 216, 230]; // Light blue background
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fontSize = 10;
                    // Special styling for the total amount column
                    if (data.column.index === 3) {
                        let val = data.cell.text[0];
                        let num = parseFloat(val.replace(/[^\d,\.-]/g, '').replace(',', '.'));
                        if (val.trim().startsWith('-')) num = -Math.abs(num);
                        if (val.trim().startsWith('+')) num = Math.abs(num);
                        data.cell.styles.textColor = num >= 0 ? [34, 139, 34] : [220, 53, 69];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    return;
                }
                // Style amount column for all normal rows
                if (data.column.index === 3) {
                    let val = data.cell.text[0];
                    let num = parseFloat(val.replace(/[^\d,\.-]/g, '').replace(',', '.'));
                    if (val.trim().startsWith('-')) num = -Math.abs(num);
                    if (val.trim().startsWith('+')) num = Math.abs(num);
                    if (num > 0) data.cell.styles.textColor = [34, 139, 34];
                    else if (num < 0) data.cell.styles.textColor = [220, 53, 69];
                }
            },
            margin: { left: 20, right: 20 }
        });
        
        yPosition = doc.lastAutoTable.finalY + 20;
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Pagina ${i} van ${pageCount}`, 20, doc.internal.pageSize.height - 10);
        doc.text('Gegenereerd door Overuren Logger', doc.internal.pageSize.width - 80, doc.internal.pageSize.height - 10);
    }
    
    // Save PDF
    doc.save(`overuren-rapport-${employeeName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Mark backup as done
    markBackupDone();
    alert('PDF succesvol geëxporteerd! Backup herinnering gewist voor deze week.');
}

function exportCurrentWeekToPDF() {
    if (!employeeName) {
        alert('Stel eerst uw naam in bij de configuratie voordat u exporteert.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // Filter transactions for current week
    const now = new Date();
    const { weekNumber: currentWeek, year: currentYear } = getISOWeekData(now);
    const filteredTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        const { weekNumber, year } = getISOWeekData(tDate);
        return weekNumber === currentWeek && year === currentYear;
    });
    const transactionTotal = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const grandTotal = startingAmount + transactions.reduce((sum, t) => sum + t.amount, 0);
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Overuren Rapport (Huidige Week)', 20, 30);
    doc.setFontSize(12);
    doc.text(`Naam: ${employeeName}`, 20, 45);
    doc.text(`Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}`, 20, 55);
    doc.text(`Start Bedrag: €${startingAmount.toFixed(2).replace('.', ',')}`, 20, 65);
    doc.text(`Verdiend/Opgenomen deze week: €${transactionTotal.toFixed(2).replace('.', ',')}`, 20, 75);
    doc.text(`Totaal Saldo: €${grandTotal.toFixed(2).replace('.', ',')}`, 20, 85);
    let yPosition = 105;
    if (filteredTransactions.length === 0) {
        doc.text('Geen transacties geregistreerd voor deze week.', 20, yPosition);
    } else {
        // Sort by date descending
        const sortedTransactions = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        // Prepare table data
        const tableData = sortedTransactions.map(t => {
            let beschrijving = '';
            if (t.type === 'overtime' || t.type === 'take') {
                const uren = (typeof t.hours === 'number' && !isNaN(t.hours)) ? decimalToHoursMinutes(t.hours) : '';
                const actie = t.type === 'overtime' ? 'toegevoegd' : 'opgenomen';
                beschrijving = `${uren ? uren + ' ' : ''}${actie}`;
            } else if (t.type === 'adjustment') {
                beschrijving = t.description;
            } else {
                beschrijving = t.description;
            }
            let amountStr = '';
            if (t.amount > 0) {
                amountStr = `+ ${t.amount.toFixed(2).replace('.', ',')} €`;
            } else {
                amountStr = `- ${Math.abs(t.amount).toFixed(2).replace('.', ',')} €`;
            }
            return [
                new Date(t.date).toLocaleDateString('nl-NL'),
                beschrijving,
                t.shiftType || '-',
                amountStr
            ];
        });
        // Add summary row for the week
        const weekTotalFormatted = (transactionTotal >= 0 ? '+ ' : '- ') + `${Math.abs(transactionTotal).toFixed(2).replace('.', ',')} €`;
        tableData.push([
            '',
            `Week ${currentWeek} (${currentYear}) - Totaal`,
            '',
            weekTotalFormatted
        ]);
        doc.autoTable({
            startY: yPosition,
            head: [['Datum', 'Beschrijving', 'Shift', 'Bedrag']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [108, 117, 125] }, // Gray header (#6c757d)
            columnStyles: {
                3: {
                    textColor: function(data) {
                        // Always parse the numeric value for color logic
                        let val = data.cell.text[0];
                        let num = parseFloat(val.replace(/[^\d,\.-]/g, '').replace(',', '.'));
                        if (val.trim().startsWith('-')) num = -Math.abs(num);
                        if (val.trim().startsWith('+')) num = Math.abs(num);
                        if (num > 0) return [34, 139, 34]; // soft green
                        if (num < 0) return [220, 53, 69]; // soft red
                        return [0, 0, 0];
                    }
                }
            },
            didParseCell: function(data) {
                // Style weekly summary row (last row)
                if (data.row.index === tableData.length - 1) {
                    data.cell.styles.fillColor = [173, 216, 230]; // Light blue background
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fontSize = 10;
                    if (data.column.index === 3) {
                        let val = data.cell.text[0];
                        let num = parseFloat(val.replace(/[^\d,\.-]/g, '').replace(',', '.'));
                        if (val.trim().startsWith('-')) num = -Math.abs(num);
                        if (val.trim().startsWith('+')) num = Math.abs(num);
                        data.cell.styles.textColor = num >= 0 ? [34, 139, 34] : [220, 53, 69];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    return;
                }
                // Style amount column for all normal rows
                if (data.column.index === 3) {
                    let val = data.cell.text[0];
                    let num = parseFloat(val.replace(/[^\d,\.-]/g, '').replace(',', '.'));
                    if (val.trim().startsWith('-')) num = -Math.abs(num);
                    if (val.trim().startsWith('+')) num = Math.abs(num);
                    if (num > 0) data.cell.styles.textColor = [34, 139, 34];
                    else if (num < 0) data.cell.styles.textColor = [220, 53, 69];
                }
            },
            margin: { left: 20, right: 20 }
        });
    }
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Pagina ${i} van ${pageCount}`, 20, doc.internal.pageSize.height - 10);
        doc.text('Gegenereerd door Overuren Logger', doc.internal.pageSize.width - 80, doc.internal.pageSize.height - 10);
    }
    const { weekNumber: fileWeekNumber } = getISOWeekData(new Date());
    doc.save(`overuren-week-${fileWeekNumber}-${employeeName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    markBackupDone();
    alert('PDF van huidige week succesvol geëxporteerd! Backup herinnering gewist voor deze week.');
}

// Close modals when clicking outside
window.onclick = function(event) {
    const dailyModal = document.getElementById('dailyModal');
    const nameModal = document.getElementById('nameModal');
    if (event.target === dailyModal) {
        closeDailyModal();
    }
    if (event.target === nameModal) {
        closeNameModal();
    }
}

// Toggle section functions for collapsible sections

function toggleExportSection() {
    const section = document.getElementById('exportSection');
    const btn = document.getElementById('toggleExportBtn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '📊 Export & Backup Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '📊 Export & Backup Opties';
    }
}

function toggleTransferSection() {
    const section = document.getElementById('transferSection');
    const btn = document.getElementById('toggleTransferBtn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '🔄 Gegevens Overdracht Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '🔄 Gegevens Overdracht Opties';
    }
}

// Data transfer functions
function exportData() {
  const data = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `overuren-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function importData() {
  if (!confirm("Weet je zeker dat je alle huidige gegevens wilt vervangen met een bestand?\nDit kan niet ongedaan worden gemaakt.")) {
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // Reset alle bestaande localStorage
        localStorage.clear();

        let ietsGeïmporteerd = false;

        for (const key in data) {
          if (data[key] !== undefined && data[key] !== null) {
            localStorage.setItem(key, data[key]);
            ietsGeïmporteerd = true;
          }
        }

        if (ietsGeïmporteerd) {
          alert("Data succesvol geïmporteerd. De pagina wordt herladen.");
          location.reload();
        } else {
          alert("Geen geldige data gevonden in het bestand.");
        }
      } catch (err) {
        alert("Fout bij het inlezen van het bestand. Zorg dat het een geldig JSON-bestand is.");
      }
    };

    reader.readAsText(file);
  };

  input.click();
}

function exportToText() {
    const transactionTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
    const grandTotal = startingAmount + transactionTotal;
    
    let textReport = `OVERUREN RAPPORT\n`;
    textReport += `Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}\n\n`;
    textReport += `Start Bedrag: €${startingAmount.toFixed(2).replace('.', ',')}\n`;
    textReport += `Verdiend/Afgetrokken: €${transactionTotal.toFixed(2).replace('.', ',')}\n`;
    textReport += `Totaal Saldo: €${grandTotal.toFixed(2).replace('.', ',')}\n\n`;
    
    if (transactions.length === 0) {
        textReport += 'Geen transacties geregistreerd.\n';
    } else {
        textReport += 'TRANSACTIES:\n';
        textReport += '='.repeat(50) + '\n';
        
        transactions.forEach(t => {
            textReport += `${new Date(t.date).toLocaleDateString('nl-NL')} - ${t.description} - €${t.amount.toFixed(2).replace('.', ',')}\n`;
        });
    }
    
    // Create download
    const blob = new Blob([textReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overuren-rapport-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    markBackupDone();
    alert('Tekst rapport gedownload!');
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', function() {
    init();
    // Force show backup reminder immediately for testing
    setTimeout(checkBackupReminder, 100);
    // Check backup reminder status every minute
    setInterval(checkBackupReminder, 60000);
});

// Update notification functions
function showUpdateNotification() {
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.style.display = 'flex';
    }
}

function updateApp() {
    // Hide the notification
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.style.display = 'none';
    }

    // Get the registration and trigger update
    navigator.serviceWorker.getRegistration().then(async registration => {
        if (registration && registration.waiting) {
            try {
                // Clear the cache first
                const cacheKeys = await caches.keys();
                await Promise.all(
                    cacheKeys.map(key => caches.delete(key))
                );
                console.log('Cache cleared before update');
                
                // Skip waiting on the service worker
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } catch (err) {
                console.error('Error during update:', err);
            }
        }
    });
}

// Enable editing of daily wage
function enableDailyWageEdit() {
    var input = document.getElementById('dailyWage');
    input.readOnly = false;
    input.style.filter = 'none';
    input.focus();
    document.getElementById('editDailyWageBtn').style.display = 'none';
    input.addEventListener('blur', function handler() {
        input.readOnly = true;
        input.style.filter = 'blur(6px)';
        document.getElementById('editDailyWageBtn').style.display = '';
        input.removeEventListener('blur', handler);
    });
}

 
    // --- Developer Message Modal Logic ---
    const DEV_MESSAGE_VERSION = '1.7.13'; // Update this with each release
    const DEV_MESSAGE = 'App bijgewerkt<br /><br />Weekelijkse en maandelijkse backups iets meer laten opvallen.'; // Change this message as needed

    function showDevMessageIfNeeded() {
      try {
        const lastSeen = localStorage.getItem('devMessageVersion');
        if (lastSeen !== DEV_MESSAGE_VERSION) {
          document.getElementById('devMessageContent').innerHTML = DEV_MESSAGE;
          document.getElementById('devMessageModal').style.display = 'flex';
        }
      } catch (e) {}
    }
    function closeDevMessageModal() {
      try {
        localStorage.setItem('devMessageVersion', DEV_MESSAGE_VERSION);
      } catch (e) {}
      document.getElementById('devMessageModal').style.display = 'none';
    }
    window.addEventListener('DOMContentLoaded', showDevMessageIfNeeded);

    // --- Maandelijkse Backup Reminder ---
    function shouldShowMonthlyBackup() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        // Show on last 2 days of the month (28/29/30/31 depending on month)
        if (now.getDate() < lastDay - 1) return false;
        // Only show once per month
        const lastShown = localStorage.getItem('monthlyBackupLastShown');
        const thisMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
        return lastShown !== thisMonth;
    }

    function showMonthlyBackupModal() {
        const modal = document.getElementById('monthlyBackupModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeMonthlyBackupModal() {
        const modal = document.getElementById('monthlyBackupModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            // Save that we've shown it this month
            const now = new Date();
            localStorage.setItem('monthlyBackupLastShown', `${now.getFullYear()}-${now.getMonth() + 1}`);
        }
    }

    // Check for monthly backup on load
    if (shouldShowMonthlyBackup()) {
        setTimeout(showMonthlyBackupModal, 800); // Delay to let UI load
    }
