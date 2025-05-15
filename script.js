// Knop voor aanpassen startbedrag
function editStartAmount() {
  const current = parseFloat(localStorage.getItem('startAmount')) || 0;
  const nieuw = prompt('Nieuw startbedrag:', current);
  if (nieuw !== null && !isNaN(parseFloat(nieuw))) {
    localStorage.setItem('startAmount', parseFloat(nieuw));
    document.getElementById('startAmountDisplay').textContent = parseFloat(nieuw).toFixed(2);
    renderTable();
  }
}

// Knop voor aanpassen dagloon
function editWage() {
  const current = parseFloat(localStorage.getItem('defaultDailyWage')) || 0;
  const nieuw = prompt('Nieuw dagloon:', current);
  if (nieuw !== null && !isNaN(parseFloat(nieuw))) {
    localStorage.setItem('defaultDailyWage', parseFloat(nieuw));
    document.getElementById('wageAmountDisplay').textContent = parseFloat(nieuw).toFixed(2);
  }
}

// Toon huidige bedragen bij laden
window.addEventListener('load', () => {
  document.querySelectorAll('.blur-toggle').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('reveal');
    });
  });
  const start = parseFloat(localStorage.getItem('startAmount')) || 0;
  const wage = parseFloat(localStorage.getItem('defaultDailyWage')) || 0;
  document.getElementById('startAmountDisplay').textContent = start.toFixed(2);
  document.getElementById('wageAmountDisplay').textContent = wage.toFixed(2);
});

// ==== CONFIGURATIE EN INITIATIE ====
const STANDARD_HOURS = 7.25; // Aantal standaard werkuren per dag
const shiftBonuses = { dag: 0.5, vroeg: 0.55, laat: 0.65, nacht: 1.0 }; // Bonuspercentages voor Recup+ per shift
const oppakBonuses = { dag: 0.0, vroeg: 0.05, laat: 0.10, nacht: 0.5 }; // Bonuspercentages voor Recup- per shift
let log = JSON.parse(localStorage.getItem('overurenLog') || '[]');
// Removed redundant startAmount variable

const form = document.querySelector('form');
const tbody = document.querySelector('#logTable tbody');
const totalNet = document.getElementById('totalNet');
const dateInput = document.getElementById('date');
const shiftInput = document.getElementById('shift');
const typeInput = document.getElementById('entryType');

window.onload = () => {
  dateInput.value = new Date().toISOString().split('T')[0];
  renderTable();
};

typeInput.addEventListener('change', () => {
  const isBestelling = typeInput.value === 'bestelling';
  document.getElementById('shiftLabel').classList.toggle('hide', isBestelling);
  document.getElementById('hoursDiv').classList.toggle('hide', isBestelling);
  document.getElementById('customLabel').classList.toggle('hide', !isBestelling);
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const warningBox = document.getElementById('warningBox');
  warningBox.innerHTML = '';
  warningBox.style.display = 'none';
  const warnings = [];

  const hoursVal = document.getElementById('hours').value;
  const minutesVal = document.getElementById('minutes').value;
  const type = typeInput.value;

  if ((hoursVal === '' || parseFloat(hoursVal) === 0) && (minutesVal === '' || parseFloat(minutesVal) === 0) && type !== 'bestelling') {
    warnings.push('Vul minstens uren of minuten in.');
  }

  if (type !== 'bestelling') {
    const dagloonCheck = localStorage.getItem('defaultDailyWage') || '';
    if (dagloonCheck === '' || isNaN(parseFloat(dagloonCheck)) || parseFloat(dagloonCheck) === 0) {
      warnings.push('Vul een geldig dagloon in.');
    }
  }

  if (type === 'bestelling') {
    const customVal = document.getElementById('customAmount').value;
    if (customVal === '' || isNaN(parseFloat(customVal)) || parseFloat(customVal) === 0) {
      warnings.push('Vul een geldig bedrag in voor de bestelling.');
    }
  }

  if (warnings.length > 0) {
    warningBox.innerHTML = warnings.map(w => `<p>${w}</p>`).join('');
    warningBox.style.display = 'block';
    return;
  }
  const datum = dateInput.value;
  const shift = shiftInput.value;
  const hours = parseFloat(document.getElementById('hours').value) || 0;
  const minutes = parseFloat(document.getElementById('minutes').value) || 0;
  const uren = hours + (minutes / 60);
  const dagloon = parseFloat(localStorage.getItem('defaultDailyWage')) || 0;
  const custom = parseFloat(document.getElementById('customAmount').value) || 0;

  let bedrag = 0;
  if (type === 'recupPlus') {
    bedrag = uren * (dagloon / STANDARD_HOURS) * (1 + shiftBonuses[shift]);
  } else if (type === 'recupMin') {
    bedrag = -uren * (dagloon / STANDARD_HOURS) * (1 + oppakBonuses[shift]);
  } else if (type === 'bestelling') {
    bedrag = -custom;
  }

  log.push({ datum, type, shift, uren, bedrag });
  localStorage.setItem('overurenLog', JSON.stringify(log));
  renderTable();

  form.reset();
  dateInput.value = new Date().toISOString().split('T')[0];
  document.getElementById('hours').value = '';
  document.getElementById('minutes').value = '';
  document.getElementById('customAmount').value = 0;
  typeInput.value = type;
  shiftInput.value = shift;

  typeInput.dispatchEvent(new Event('change'));
});

function renderTable() {
  tbody.innerHTML = '';
  let totaal = 0;
  const start = parseFloat(localStorage.getItem('startAmount')) || 0;
  totaal += start;

  const sorted = [...log].sort((a, b) => b.datum.localeCompare(a.datum));

  sorted.forEach(entry => {
    const tr = document.createElement('tr');
    tr.className = entry.bedrag >= 0 ? 'positief' : 'negatief';
    tr.innerHTML = `
      <td>${formatDate(entry.datum)}</td>
      <td>${entry.type === 'bestelling' ? 'Bestelling' : entry.shift}</td>
      <td>${entry.uren?.toFixed(2) || ''}</td>
      <td>${entry.bedrag.toFixed(2)}</td>
      <td class="actions">
        <i class="fas fa-trash-alt" title="Verwijder" onclick="deleteEntry(${log.indexOf(entry)})"></i>
      </td>
    `;
    tbody.appendChild(tr);
    totaal += entry.bedrag;
  });

  totalNet.textContent = totaal.toFixed(2);
  document.getElementById('totalsDisplay').className = 'totals ' + (totaal >= 0 ? 'positief' : 'negatief');
}

function deleteEntry(index) {
  if (!confirm('Weet je zeker dat je deze entry wilt verwijderen?')) return;
  log.splice(index, 1);
  localStorage.setItem('overurenLog', JSON.stringify(log));
  renderTable();
}

function formatDate(d) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function exportToPDF() {
  checkExportStatus();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const grouped = {};

  log.forEach(entry => {
    const [year, month] = entry.datum.split('-');
    const key = `${year}-${month}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  });

  let y = 10;
  let totaal = 0;

  const start = parseFloat(localStorage.getItem('startAmount')) || 0;
  y += 10;
  doc.text(`Startbedrag: €${start.toFixed(2)}`, 10, y);
  y += 10;

  Object.keys(grouped).sort().reverse().forEach(monthKey => {
    const entries = grouped[monthKey].sort((a, b) => b.datum.localeCompare(a.datum));
    const maandTotaal = entries.reduce((sum, e) => sum + e.bedrag, 0);
    totaal += maandTotaal;

    doc.text(`Maand: ${monthKey}  (Totaal: €${maandTotaal.toFixed(2)})`, 10, y);
    y += 6;

    const body = entries.map(e => [
      formatDate(e.datum),
      e.type === 'bestelling' ? 'Bestelling' : e.shift,
      e.uren?.toFixed(2) || '',
      `€${e.bedrag.toFixed(2)}`
    ]);

    doc.autoTable({
      head: [['Datum', 'Type/Shift', 'Uren', 'Bedrag (€)']],
      body,
      startY: y,
      styles: { fontSize: 10 },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const value = parseFloat(data.cell.raw.replace('€', ''));
          if (!isNaN(value)) {
            if (value < 0) {
              data.cell.styles.fillColor = [255, 230, 230];
              data.cell.styles.textColor = 80;
            } else {
              data.cell.styles.fillColor = [230, 255, 230];
              data.cell.styles.textColor = 20;
            }
          }
        }
      },
      margin: { top: y, left: 10, right: 10 },
      didDrawPage: (d) => { y = d.cursor.y + 10; }
    });
  });

  doc.text(`Totaal alle maanden (incl. startbedrag): €${(totaal + start).toFixed(2)}`, 10, y);

  const today = new Date();
  const currentWeek = `${today.getFullYear()}-W${String(getWeekNumber(today)).padStart(2, '0')}`;
  localStorage.setItem('lastExportWeek', currentWeek);

  doc.save(`overuren_per_maand.pdf`);
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function checkExportStatus() {
  const today = new Date();
  const currentWeek = `${today.getFullYear()}-W${String(getWeekNumber(today)).padStart(2, '0')}`;
  const lastExport = localStorage.getItem('lastExportWeek') || '';
  const statusBox = document.getElementById('exportStatus');
  statusBox.style.display = 'block';
  if (lastExport === currentWeek) {
    statusBox.textContent = '✅ Deze week is al een PDF geëxporteerd.';
    statusBox.style.backgroundColor = '#d4edda';
    statusBox.style.color = '#155724';
    statusBox.style.border = '1px solid #c3e6cb';
  } else {
    statusBox.textContent = '⚠️ Vergeet deze week je PDF-export niet!';
    statusBox.style.backgroundColor = '#fff3cd';
    statusBox.style.color = '#856404';
    statusBox.style.border = '1px solid #ffeeba';
  }
}

function toggleInfoBox() {
  const infoBox = document.getElementById('infoBox');
  infoBox.style.display = infoBox.style.display === 'block' ? 'none' : 'block';
}

checkExportStatus();
document.addEventListener('click', function(event) {
  const infoBox = document.getElementById('infoBox');
  const icon = document.querySelector('.question-icon');
  if (!infoBox.contains(event.target) && !icon.contains(event.target)) {
    infoBox.style.display = 'none';
  }
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered: ', registration);
      })
      .catch(error => {
        console.log('Service Worker registration failed: ', error);
      });
  });
}
