'use strict';

const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const resultTitle = document.getElementById('result-title');
const resultIcon = document.getElementById('result-icon');
const form = document.getElementById('redeem-form');
const identifierInput = document.getElementById('identifier');
const submitButton = document.getElementById('submit-button');
const alternativeButton = document.getElementById('alternative-button');
const formDescription = document.getElementById('form-description');
const errorMessage = document.getElementById('error-message');
const privacyNote = document.getElementById('privacy-note');
const countElement = document.getElementById('count');

let activeType = 'ausweis';

function updateFormForType() {
  const isAlternative = activeType === 'andere_angabe';
  formDescription.textContent = isAlternative
    ? 'Nur für Ausnahmefälle: eindeutige Ersatzangabe eingeben'
    : 'Personalausweisnummer eingeben';
  identifierInput.placeholder = isAlternative ? 'z. B. MAX MUSTERMANN 12B' : 'z. B. L01X00T47';
  identifierInput.maxLength = isAlternative ? 120 : 9;
  identifierInput.value = '';
  errorMessage.textContent = '';
  submitButton.textContent = isAlternative ? 'Ersatzangabe prüfen' : 'Prüfen';
  alternativeButton.textContent = isAlternative ? 'Zurück' : 'Andere Angabe';
  privacyNote.textContent = isAlternative
    ? 'Nur verwenden, wenn kein Personalausweis vorliegt. Die Angabe wird nicht im Klartext gespeichert.'
    : 'Die eingegebene Angabe wird nicht im Klartext gespeichert.';
  identifierInput.focus();
}

function showResult(kind, title, icon) {
  startScreen.classList.add('hidden');
  resultScreen.className = `screen result-screen ${kind}`;
  resultTitle.textContent = title;
  resultIcon.textContent = icon;
  resultScreen.focus();
}

function returnToStart() {
  resultScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  identifierInput.value = '';
  errorMessage.textContent = '';
  activeType = 'ausweis';
  updateFormForType();
  refreshCount();
}

async function refreshCount() {
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' });
    const data = await response.json();
    countElement.textContent = data.count;
  } catch {
    countElement.textContent = '–';
  }
}

identifierInput.addEventListener('input', () => {
  const cursor = identifierInput.selectionStart;
  identifierInput.value = identifierInput.value.toUpperCase();
  identifierInput.setSelectionRange(cursor, cursor);
});

alternativeButton.addEventListener('click', () => {
  activeType = activeType === 'ausweis' ? 'andere_angabe' : 'ausweis';
  updateFormForType();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.textContent = '';

  const identifier = identifierInput.value.trim().toUpperCase();
  if (!identifier) {
    errorMessage.textContent = 'Bitte gib eine Angabe ein.';
    identifierInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Wird geprüft …';

  try {
    const response = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, type: activeType })
    });

    const data = await response.json();
    if (typeof data.count === 'number') countElement.textContent = data.count;

    if (response.status === 201 && data.status === 'success') {
      showResult('success', 'Eintrag erfolgreich eingetragen', '✓');
      return;
    }

    if (response.status === 409 && data.status === 'exists') {
      showResult('exists', 'Eintrag existiert schon', '!');
      return;
    }

    errorMessage.textContent = data.message || 'Ungültige Eingabe.';
    identifierInput.focus();
  } catch {
    showResult('error', 'Server nicht erreichbar', '×');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = activeType === 'andere_angabe' ? 'Ersatzangabe prüfen' : 'Prüfen';
  }
});

resultScreen.addEventListener('click', returnToStart);
resultScreen.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') returnToStart();
});

updateFormForType();
refreshCount();
