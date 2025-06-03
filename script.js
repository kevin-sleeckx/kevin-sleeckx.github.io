// Core data management
let dailyWage = parseFloat(localStorage.getItem('dailyWage')) || 0;
let startingAmount = parseFloat(localStorage.getItem('startingAmount')) || 0;
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentDate = new Date();

// Shift multipliers for earning overtime
const earnMultipliers = {
    dag: 1.5,    // +50%
    vroege: 1.55, // +55%
    late: 1.65,  // +65%
    nacht: 2.0   // +100%
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
function init() {
    updateTotalDisplay();
    updateWageDisplay();
    updateStartingDisplay();
    setDefaultDates();
    renderCalendar();
    checkBackupReminder();
    registerServiceWorker();
}

// PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration);
                
                // Show install button if app is installable
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    const installBtn = document.getElementById('installBtn');
                    installBtn.style.display = 'block';
                    installBtn.onclick = () => {
                        e.prompt();
                        e.userChoice.then((choiceResult) => {
                            if (choiceResult.outcome === 'accepted') {
                                installBtn.style.display = 'none';
                            }
                        });
                    };
                });
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('overtimeDate').value = today;
    document.getElementById('takeDate').value = today;
    document.getElementById('orderDate').value = today;
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
    document.getElementById('currentStarting').textContent = startingAmount.toFixed(2).replace('.', ',');
    document.getElementById('startingAmount').value = startingAmount;
    if (startingAmount !== 0) {
        document.getElementById('startingDisplay').style.display = 'block';
    }
}

// Daily Wage Management (Hidden by default)
function toggleDailyWage() {
    const section = document.getElementById('dailyWageSection');
    const btn = document.getElementById('toggleWageBtn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '🔒 Dagloon Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '⚙️ Dagloon Configureren';
    }
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
    const lastBackup = localStorage.getItem('lastBackupWeek');
    const currentWeek = getWeekNumber(new Date());
    
    if (!lastBackup || parseInt(lastBackup) !== currentWeek) {
        document.getElementById('backupReminder').classList.add('show');
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
        document.getElementById('currentWage').textContent = dailyWage.toFixed(2).replace('.', ',');
        document.getElementById('hourlyRate').textContent = (dailyWage / 7.25).toFixed(2).replace('.', ',');
        document.getElementById('wageDisplay').style.display = 'block';
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

function updateEarnPreview() {
    const hours = parseFloat(document.getElementById('overtimeHours').value);
    const customHours = parseFloat(document.getElementById('customHoursInput').value);
    const actualHours = hours === 0 && customHours ? customHours : hours;
    const shiftType = document.getElementById('shiftType').value;
    
    // Show/hide custom hours input
    if (document.getElementById('overtimeHours').value === 'custom') {
        document.getElementById('customOvertimeHours').style.display = 'block';
    } else {
        document.getElementById('customOvertimeHours').style.display = 'none';
    }
    
    if (actualHours > 0 && dailyWage > 0) {
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
    const hours = parseFloat(document.getElementById('takeHours').value);
    const customHours = parseFloat(document.getElementById('customTakeInput').value);
    const actualHours = hours === 0 && customHours ? customHours : hours;
    const shiftType = document.getElementById('takeShiftType').value;
    
    // Show/hide custom hours input
    if (document.getElementById('takeHours').value === 'custom') {
        document.getElementById('customTakeHours').style.display = 'block';
    } else {
        document.getElementById('customTakeHours').style.display = 'none';
    }
    
    if (actualHours > 0 && dailyWage > 0) {
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
    const hours = parseFloat(document.getElementById('overtimeHours').value);
    const customHours = parseFloat(document.getElementById('customHoursInput').value);
    const actualHours = hours === 0 && customHours ? customHours : hours;
    const shiftType = document.getElementById('shiftType').value;
    
    if (!date || actualHours <= 0 || dailyWage <= 0) {
        alert('Vul alle velden in en stel eerst een dagloon in');
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
    document.getElementById('overtimeHours').value = '0';
    document.getElementById('customHoursInput').value = '';
    document.getElementById('customOvertimeHours').style.display = 'none';
    document.getElementById('earnPreview').style.display = 'none';
    
    alert(`€${earnings.toFixed(2).replace('.', ',')} toegevoegd aan uw saldo!`);
}

function takeOvertime() {
    const date = document.getElementById('takeDate').value;
    const hours = parseFloat(document.getElementById('takeHours').value);
    const customHours = parseFloat(document.getElementById('customTakeInput').value);
    const actualHours = hours === 0 && customHours ? customHours : hours;
    const shiftType = document.getElementById('takeShiftType').value;
    
    if (!date || actualHours <= 0 || dailyWage <= 0) {
        alert('Vul alle velden in en stel eerst een dagloon in');
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
    document.getElementById('takeHours').value = '0';
    document.getElementById('customTakeInput').value = '';
    document.getElementById('customTakeHours').style.display = 'none';
    document.getElementById('takePreview').style.display = 'none';
    
    alert(`€${deduction.toFixed(2).replace('.', ',')} afgetrokken van uw saldo!`);
}

function addOrder() {
    const date = document.getElementById('orderDate').value;
    const amount = parseFloat(document.getElementById('orderAmount').value);
    const description = document.getElementById('orderDescription').value || 'Bestelling';
    
    if (!date || amount <= 0) {
        alert('Vul datum en bedrag in');
        return;
    }
    
    const transaction = {
        id: Date.now(),
        type: 'order',
        date: date,
        amount: -amount,
        description: description
    };
    
    transactions.unshift(transaction);
    saveTransactions();
    updateTotalDisplay();
    renderCalendar();
    
    // Reset form
    document.getElementById('orderAmount').value = '';
    document.getElementById('orderDescription').value = '';
    
    alert(`€${amount.toFixed(2).replace('.', ',')} afgetrokken voor: ${description}`);
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
    document.getElementById('nameModal').style.display = 'block';
}

function closeNameModal() {
    document.getElementById('nameModal').style.display = 'none';
}

function generatePDFWithName() {
    const exportOrdersOnly = localStorage.getItem('exportOrdersOnly') === 'true';
    const employeeName = document.getElementById('employeeName').value.trim();
    if (!employeeName) {
        alert('Voer uw naam in voor het PDF rapport');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Filter transactions if we're only exporting orders
    const relevantTransactions = exportOrdersOnly 
        ? transactions.filter(t => t.type === 'order')
        : transactions;
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...relevantTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(exportOrdersOnly ? 'Bestellingen Rapport' : 'Overuren Rapport', 20, 30);
    
    doc.setFontSize(12);
    doc.text(`Naam: ${employeeName}`, 20, 45);
    doc.text(`Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}`, 20, 55);
    
    if (exportOrdersOnly) {
        const totalOrders = sortedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        doc.text(`Totaal Bestellingen: €${totalOrders.toFixed(2).replace('.', ',')}`, 20, 65);
    } else {
        doc.text(`Start Bedrag: €${startingAmount.toFixed(2).replace('.', ',')}`, 20, 65);
        const transactionTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
        const grandTotal = startingAmount + transactionTotal;
        doc.text(`Verdiend/Afgetrokken: €${transactionTotal.toFixed(2).replace('.', ',')}`, 20, 75);
        doc.text(`Totaal Saldo: €${grandTotal.toFixed(2).replace('.', ',')}`, 20, 85);
    }
    
    let yPosition = exportOrdersOnly ? 85 : 105;
    
    if (sortedTransactions.length === 0) {
        doc.text(exportOrdersOnly ? 'Geen bestellingen geregistreerd.' : 'Geen transacties geregistreerd.', 20, yPosition);
    } else {
        const tableData = sortedTransactions.map(t => [
            new Date(t.date).toLocaleDateString('nl-NL'),
            t.description,
            `€${Math.abs(t.amount).toFixed(2).replace('.', ',')}`
        ]);
        
        doc.autoTable({
            startY: yPosition,
            head: [['Datum', 'Beschrijving', 'Bedrag']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [108, 117, 125] },
            columnStyles: {
                2: { halign: 'right' }
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
    
    // Save PDF with appropriate name
    const filename = exportOrdersOnly 
        ? `bestellingen-rapport-${employeeName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
        : `overuren-rapport-${employeeName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(filename);
    
    // Clear the orders-only flag and close the modal
    localStorage.removeItem('exportOrdersOnly');
    closeNameModal();
    alert(exportOrdersOnly ? 'Bestellingen rapport geëxporteerd!' : 'PDF succesvol geëxporteerd! Backup herinnering gewist voor deze week.');
    
    // Only mark backup as done for full exports
    if (!exportOrdersOnly) {
        markBackupDone();
    }
}

function exportOrdersToPDF() {
    document.getElementById('nameModal').style.display = 'block';
    // Set a flag to indicate we're exporting orders only
    localStorage.setItem('exportOrdersOnly', 'true');
}

function exportOrdersToText() {
    // Filter only order transactions and sort by date (newest first)
    const orderTransactions = transactions
        .filter(t => t.type === 'order')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let textReport = `BESTELLINGEN RAPPORT\n`;
    textReport += `Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}\n\n`;
    
    if (orderTransactions.length === 0) {
        textReport += 'Geen bestellingen geregistreerd.\n';
    } else {
        textReport += 'BESTELLINGEN:\n';
        textReport += '='.repeat(50) + '\n';
        
        orderTransactions.forEach(t => {
            textReport += `${new Date(t.date).toLocaleDateString('nl-NL')} - ${t.description} - €${Math.abs(t.amount).toFixed(2).replace('.', ',')}\n`;
        });
        
        const totalOrders = orderTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        textReport += '\n='.repeat(50) + '\n';
        textReport += `Totaal Bestellingen: €${totalOrders.toFixed(2).replace('.', ',')}\n`;
    }
    
    // Create download
    const blob = new Blob([textReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestellingen-rapport-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Bestellingen rapport gedownload!');
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
function toggleOvertimeSection() {
    const section = document.getElementById('overtimeSection');
    const btn = document.getElementById('toggleOvertimeBtn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '📝 Overuren Invoer Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '📝 Overuren Invoer Toevoegen';
    }
}

function toggleTakeSection() {
    const section = document.getElementById('takeSection');
    const btn = document.getElementById('toggleTakeBtn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '📤 Overuren Opname Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '📤 Overuren Opname Invoer';
    }
}

function toggleOrderSection() {
    const section = document.getElementById('orderSection');
    const btn = document.getElementById('toggleOrderBtn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '🛍️ Bestelling Invoer Verbergen';
    } else {
        section.style.display = 'none';
        btn.textContent = '🛍️ Bestelling Invoer Toevoegen';
    }
}

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
function generateExportData() {
    const exportData = {
        dailyWage: dailyWage,
        startingAmount: startingAmount,
        transactions: transactions,
        exported: new Date().toISOString(),
        version: '1.0'
    };
    
    const compressed = btoa(JSON.stringify(exportData));
    document.getElementById('exportDataText').value = compressed;
}

function copyToClipboard() {
    const textArea = document.getElementById('exportDataText');
    if (!textArea.value) {
        alert('Genereer eerst export gegevens');
        return;
    }
    
    textArea.select();
    document.execCommand('copy');
    alert('Gegevens gekopieerd naar klembord!');
}

function importData() {
    const importText = document.getElementById('importDataText').value.trim();
    if (!importText) {
        alert('Plak eerst de gegevens in het tekstveld');
        return;
    }
    
    try {
        const decompressed = atob(importText);
        const importData = JSON.parse(decompressed);
        
        if (confirm('Dit vervangt alle huidige gegevens. Weet u het zeker?')) {
            dailyWage = importData.dailyWage || 0;
            startingAmount = importData.startingAmount || 0;
            transactions = importData.transactions || [];
            
            localStorage.setItem('dailyWage', dailyWage.toString());
            localStorage.setItem('startingAmount', startingAmount.toString());
            localStorage.setItem('transactions', JSON.stringify(transactions));
            
            init();
            alert('Gegevens succesvol geïmporteerd!');
            document.getElementById('importDataText').value = '';
        }
    } catch (error) {
        alert('Ongeldige gegevens. Controleer of u de juiste tekst heeft geplakt.');
    }
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
document.addEventListener('DOMContentLoaded', init);
