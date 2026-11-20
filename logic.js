/* Verificator UR20 — logică pură (fără DOM).
   Expusă ca globalThis.UR20Logic și, dacă există, prin module.exports. */
(function (root) {
  'use strict';

  var REFERINTA = Object.freeze({
    capacitateKg: 20,            // UR20, sarcină nominală (fișa Universal Robots, oct. 2026)
    capacitateCuConditiiKg: 25,  // doar mențiune în text, nu prag
    gripperImplicitKg: 5,        // ipoteză editabilă
    greutateMinTestataKg: 5,     // PURATOS: găleți de 5 kg
    greutateMaxTestataKg: 13,    // PURATOS: găleți de 13 kg
    debitTestat5kg: 8.6,         // găleți/min, rezultat de test PURATOS
    debitTestat13kg: 7.4,        // găleți/min, rezultat de test PURATOS
    debitTinta: 6                // găleți/min, ținta PURATOS
  });

  var EPS = 1e-9;

  var VERDICT_TEXT = {
    in_afara: 'În afara aplicației de referință',
    validare: 'Necesită validare suplimentară',
    potrivit: 'Potrivit pentru evaluare tehnică'
  };

  function fmt(n, zecimale) {
    var z = zecimale == null ? 2 : zecimale;
    return Number(n).toLocaleString('ro-RO', { maximumFractionDigits: z });
  }

  /* Transformă textul unui câmp numeric („7,4”, „1.000”, „ 13 ”) în număr; NaN dacă nu se poate. */
  function parseNumarRo(text) {
    if (typeof text === 'number') return isFinite(text) ? text : NaN;
    if (text == null) return NaN;
    var s = String(text).trim().replace(/\s+/g, '');
    if (s === '') return NaN;
    // „1.000” → „1000”, „12.500” → „12500”, „1.000,5” → „1000.5” (punctul separă miile: grupuri de exact trei cifre)
    if (/^[-+]?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    // „7,4” → „7.4”; „7.4” rămâne; punct și virgulă în altă formă decât cea de mai sus („1.2,3”, „1,2.3”) → NaN
    else if (s.indexOf(',') !== -1) { if (s.indexOf('.') !== -1) return NaN; s = s.replace(',', '.'); }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function debitReferinta(greutateKg) {
    return greutateKg <= REFERINTA.greutateMinTestataKg + EPS
      ? REFERINTA.debitTestat5kg
      : REFERINTA.debitTestat13kg;
  }

  function evaluate(input) {
    var i = input || {};
    var gripper = (typeof i.greutateGripperKg === 'number' && isFinite(i.greutateGripperKg))
      ? i.greutateGripperKg : REFERINTA.gripperImplicitKg;
    var g = i.greutateKg;
    var debit = i.debitGaletiMin;
    var ref = debitReferinta(g);
    var sarcina = g + gripper;
    var motive = [];
    var note = [];
    var inAfara = false;
    var validare = false;

    if (sarcina > REFERINTA.capacitateKg + EPS) {
      inAfara = true;
      motive.push({
        cod: 'capacitate',
        text: 'Sarcina totală (găleată ' + fmt(g) + ' kg + gripper ' + fmt(gripper) + ' kg = ' + fmt(sarcina) +
          ' kg) depășește capacitatea nominală UR20 de 20 kg. Cei 25 kg din fișa producătorului se aplică doar cu condiții-limită conform manualului și nu sunt folosiți aici.'
      });
    }

    if (g < REFERINTA.greutateMinTestataKg - EPS || g > REFERINTA.greutateMaxTestataKg + EPS) {
      validare = true;
      motive.push({
        cod: 'greutate_in_afara_intervalului',
        text: 'Găleata de ' + fmt(g) + ' kg este în afara intervalului testat la PURATOS (5–13 kg).'
      });
    } else if (g > REFERINTA.greutateMinTestataKg + EPS && g < REFERINTA.greutateMaxTestataKg - EPS) {
      note.push({
        cod: 'format_intermediar',
        text: 'Formatul de ' + fmt(g) + ' kg nu a fost testat (la PURATOS s-au testat 5 kg și 13 kg). Folosim valoarea de 7,4 găleți/min, fără interpolare; debitul real se validează la evaluarea tehnică.'
      });
    }

    var formatRef = g <= REFERINTA.greutateMinTestataKg + EPS
      ? REFERINTA.greutateMinTestataKg : REFERINTA.greutateMaxTestataKg;
    var formatExact = Math.abs(g - REFERINTA.greutateMinTestataKg) <= EPS ||
      Math.abs(g - REFERINTA.greutateMaxTestataKg) <= EPS;
    var galeataRef = 'găleata de ' + fmt(formatRef) + ' kg';

    var blocaj;
    if (debit > ref + EPS) {
      blocaj = 'peste_referinta';
      validare = true;
      motive.push({
        cod: 'debit_peste_referinta',
        text: formatExact
          ? 'Debitul liniei (' + fmt(debit) + ' găleți/min) depășește valoarea testată la PURATOS pentru ' + galeataRef + ' (' + fmt(ref) + ' găleți/min).'
          : 'Debitul liniei (' + fmt(debit) + ' găleți/min) depășește reperul de ' + fmt(ref) + ' găleți/min, testat la PURATOS pentru ' + galeataRef +
            ', nu pentru formatul dvs.: comparația este orientativă și se validează la evaluarea tehnică.'
      });
    } else if (debit < ref - EPS) {
      blocaj = 'amonte';
      if (!inAfara) {
        note.push({
          cod: 'blocaj_amonte',
          text: formatExact
            ? 'Linia dvs. (' + fmt(debit) + ' găleți/min) este mai lentă decât valoarea testată la PURATOS pentru ' + galeataRef + ' (' + fmt(ref) +
              ' găleți/min): limita este în amonte, la umplere. Robotul nu crește debitul fabricii.'
            : 'Linia dvs. (' + fmt(debit) + ' găleți/min) este sub reperul de ' + fmt(ref) + ' găleți/min, testat la PURATOS pentru ' + galeataRef +
              ', nu pentru formatul dvs.: comparația este orientativă. Dacă se confirmă la evaluarea tehnică, limita este în amonte, la umplere, iar robotul nu crește debitul fabricii.'
        });
      }
    } else {
      blocaj = 'la_referinta';
      if (!inAfara) {
        note.push({
          cod: 'debit_la_referinta',
          text: formatExact
            ? 'Debitul liniei este egal cu valoarea testată la PURATOS pentru ' + galeataRef + ' (' + fmt(ref) + ' găleți/min): nu există rezervă de ritm; se verifică la evaluarea tehnică.'
            : 'Debitul liniei este egal cu reperul de ' + fmt(ref) + ' găleți/min, testat la PURATOS pentru ' + galeataRef +
              ', nu pentru formatul dvs.: comparația este orientativă; se verifică la evaluarea tehnică.'
        });
      }
    }

    if (i.maner === false) {
      validare = true;
      motive.push({
        cod: 'fara_maner',
        text: 'Găleata nu are mâner: aplicația de referință preia găleata orientând mânerul; gripperul trebuie validat pentru alt mod de prindere.'
      });
    }

    if (i.industrie !== 'alimentar') {
      validare = true;
      motive.push({
        cod: 'alta_industrie',
        text: 'Altă industrie decât cea alimentară: cerințele tehnice (ambalaj, mediu, siguranță) se validează separat.'
      });
    }

    if (i.spatiu === 'nu' || i.spatiu === 'nu_stiu') {
      validare = true;
      motive.push({
        cod: 'spatiu',
        text: i.spatiu === 'nu'
          ? 'Nu există spațiu liber la capătul liniei: amplasarea celulei trebuie validată la fața locului.'
          : 'Nu se știe dacă există spațiu la capătul liniei: amplasarea celulei se verifică la fața locului.'
      });
    }

    if (i.separator === true) {
      note.push({
        cod: 'separator',
        text: 'Folosiți separatoare între straturi: amplasarea lor rămâne manuală, ca la PURATOS.'
      });
    }

    note.push({
      cod: 'gripper_ipoteza',
      text: 'Greutatea gripperului (' + fmt(gripper) + ' kg) este o ipoteză de calcul; o găleată pe ciclu.'
    });

    var verdict = inAfara ? 'in_afara' : (validare ? 'validare' : 'potrivit');

    var kgPeSchimb = debit * 60 * i.orePeSchimb * g;
    var calcule = {
      sarcinaTotalaKg: sarcina,
      capacitateKg: REFERINTA.capacitateKg,
      debitReferinta: ref,
      formatReferintaKg: formatRef,
      formatTestatExact: formatExact,
      kgPeSchimb: kgPeSchimb,
      tonePeSchimb: kgPeSchimb / 1000,
      kgPeZi: kgPeSchimb * i.schimburiPeZi,
      kgPeOperatorPeSchimb: i.operatori > 0 ? kgPeSchimb / i.operatori : null,
      paletiPeOra: i.galetiPePalet > 0 ? debit * 60 / i.galetiPePalet : null,
      minuteIntrePaleti: debit > 0 ? i.galetiPePalet / debit : null
    };

    return {
      verdict: verdict,
      verdictText: VERDICT_TEXT[verdict],
      motive: motive,
      note: note,
      calcule: calcule,
      blocaj: blocaj
    };
  }

  var JUDETE_IASI = ['iasi', 'suceava', 'botosani', 'neamt', 'bacau', 'vaslui', 'vrancea', 'galati'];
  var JUDETE_TIMISOARA = ['timis', 'arad', 'caras-severin', 'hunedoara', 'bihor'];

  function normalizeaza(text) {
    return String(text == null ? '' : text).trim().toLowerCase()
      .replace(/[ăâ]/g, 'a').replace(/î/g, 'i').replace(/[șş]/g, 's').replace(/[țţ]/g, 't')
      .replace(/\s+/g, '-');
  }

  function locatieTechCon(judet) {
    var j = normalizeaza(judet);
    if (JUDETE_IASI.indexOf(j) !== -1) return 'Iași';
    if (JUDETE_TIMISOARA.indexOf(j) !== -1) return 'Timișoara';
    return 'Dragomirești-Deal';
  }

  var CAMPURI_TEHNICE = [
    ['industrie', 'Lipsește tipul de produs / industria', function (v) { return v === 'alimentar' || v === 'alta'; }],
    ['greutateKg', 'Lipsește greutatea găleții', esteNumar],
    ['galetiPePalet', 'Lipsește numărul de găleți pe palet', esteNumar],
    ['debitGaletiMin', 'Lipsește debitul liniei', esteNumar],
    ['schimburiPeZi', 'Lipsește numărul de schimburi pe zi', esteNumar],
    ['orePeSchimb', 'Lipsesc orele pe schimb', esteNumar],
    ['operatori', 'Lipsește numărul de operatori', esteNumar],
    ['maner', 'Lipsește răspunsul despre mâner', esteBool],
    ['separator', 'Lipsește răspunsul despre separatoare', esteBool],
    ['spatiu', 'Lipsește răspunsul despre spațiul la capătul liniei', function (v) { return v === 'da' || v === 'nu' || v === 'nu_stiu'; }]
  ];

  function esteNumar(v) { return typeof v === 'number' && isFinite(v); }
  function esteBool(v) { return v === true || v === false; }
  function completat(v) { return typeof v === 'string' && v.trim() !== ''; }

  var ETICHETE_CERERE = {
    relevanta: 'Cerere relevantă',
    incompleta: 'Cerere incompletă',
    validare_separata: 'Cerere de validat separat'
  };

  function calificaCererea(input, rezultat, contact) {
    var i = input || {};
    var c = contact || {};
    var lipsuri = [];
    var dateLipsa = 0;    // date tehnice sau de contact necompletate
    var separat = 0;      // date complete, dar în afara segmentului (altă industrie sau verdict „în afara”)

    CAMPURI_TEHNICE.forEach(function (camp) {
      if (!camp[2](i[camp[0]])) { lipsuri.push(camp[1]); dateLipsa++; }
    });
    if (!rezultat || !rezultat.verdict) { lipsuri.push('Lipsește verdictul verificării'); dateLipsa++; }
    if (i.industrie === 'alta') { lipsuri.push('Industria nu este cea alimentară: cerințele tehnice se validează separat'); separat++; }
    if (rezultat && rezultat.verdict === 'in_afara') { lipsuri.push('Verdict în afara aplicației de referință'); separat++; }
    if (!completat(c.firma)) { lipsuri.push('Lipsește firma'); dateLipsa++; }
    if (!completat(c.rol)) { lipsuri.push('Lipsește rolul'); dateLipsa++; }
    if (!completat(c.judet)) { lipsuri.push('Lipsește județul'); dateLipsa++; }

    var tip = dateLipsa ? 'incompleta' : (separat ? 'validare_separata' : 'relevanta');
    return {
      relevanta: tip === 'relevanta',
      tip: tip,
      eticheta: ETICHETE_CERERE[tip],
      lipsuri: lipsuri
    };
  }


  /* ---------- validarea datelor brute din formular ---------- */
  /* Câmpurile, în ordinea din pagină. tip: 'numar' sau 'alegere'. */
  var CAMPURI_FORMULAR = [
    { id: 'industrie', tip: 'alegere', cheie: 'industrie', variante: ['alimentar', 'alta'] },
    { id: 'greutate', tip: 'numar', cheie: 'greutateKg', nume: 'greutatea găleții', maxim: 100, unitate: 'kg' },
    { id: 'galeti-palet', tip: 'numar', cheie: 'galetiPePalet', nume: 'numărul de găleți pe palet', intreg: true },
    { id: 'debit', tip: 'numar', cheie: 'debitGaletiMin', nume: 'debitul liniei', maxim: 60, unitate: 'găleți pe minut' },
    { id: 'schimburi', tip: 'numar', cheie: 'schimburiPeZi', nume: 'numărul de schimburi pe zi' },
    { id: 'ore', tip: 'numar', cheie: 'orePeSchimb', nume: 'orele pe schimb' },
    { id: 'operatori', tip: 'numar', cheie: 'operatori', nume: 'numărul de operatori', intreg: true },
    { id: 'maner', tip: 'alegere', cheie: 'maner', variante: ['da', 'nu'], bool: true },
    { id: 'separator', tip: 'alegere', cheie: 'separator', variante: ['da', 'nu'], bool: true },
    { id: 'spatiu', tip: 'alegere', cheie: 'spatiu', variante: ['da', 'nu', 'nu_stiu'] },
    { id: 'gripper', tip: 'numar', cheie: 'greutateGripperKg', nume: 'greutatea gripperului', poateLipsi: true, poateFiZero: true }
  ];

  var MESAJE = {
    text: 'Introduceți un număr, de exemplu 7,4 (fără litere).',
    negativ: 'Valoarea nu poate fi negativă.',
    zero: 'Valoarea trebuie să fie mai mare decât zero.',
    schimburi: 'Schimburile pe zi sunt 1, 2 sau 3.',
    intreg: 'Introduceți un număr întreg.',
    orePeste12: 'Un schimb are cel mult 12 ore.',
    alegere: 'Alegeți o variantă.'
  };

  /* Primește valorile brute (text) din formular, cu cheile = id-urile câmpurilor.
     Întoarce { ok, erori: {id: mesaj}, avertismente: {id: mesaj}, valori } — valori este input-ul pentru evaluate(). */
  function valideaza(brut) {
    var b = brut || {};
    var erori = {};
    var avertismente = {};
    var valori = {};

    CAMPURI_FORMULAR.forEach(function (c) {
      var text = String(b[c.id] == null ? '' : b[c.id]).trim();
      if (c.tip === 'alegere') {
        if (c.variante.indexOf(text) === -1) { erori[c.id] = MESAJE.alegere; return; }
        valori[c.cheie] = c.bool ? text === 'da' : text;
        return;
      }
      if (text === '') {
        if (c.poateLipsi) { valori[c.cheie] = REFERINTA.gripperImplicitKg; return; }
        erori[c.id] = 'Completați ' + c.nume + '.';
        return;
      }
      var n = parseNumarRo(text);
      if (!isFinite(n)) { erori[c.id] = MESAJE.text; return; }
      if (n < 0) { erori[c.id] = MESAJE.negativ; return; }
      if (n === 0 && !c.poateFiZero) { erori[c.id] = MESAJE.zero; return; }
      if (c.id === 'schimburi' && (n !== Math.floor(n) || n < 1 || n > 3)) { erori[c.id] = MESAJE.schimburi; return; }
      if (c.intreg && n !== Math.floor(n)) { erori[c.id] = MESAJE.intreg; return; }
      if (c.id === 'ore' && n > 12) { erori[c.id] = MESAJE.orePeste12; return; }
      if (c.maxim && n > c.maxim) { erori[c.id] = 'Verificați valoarea și unitatea (' + c.unitate + ').'; return; }
      valori[c.cheie] = n;
    });

    // Program: schimburi × ore nu pot depăși 24 de ore pe zi.
    if (!erori.schimburi && !erori.ore && valori.schimburiPeZi * valori.orePeSchimb > 24 + EPS) {
      erori.ore = fmt(valori.schimburiPeZi) + (valori.schimburiPeZi === 1 ? ' schimb' : ' schimburi') + ' × ' +
        fmt(valori.orePeSchimb) + ' ore depășesc 24 de ore pe zi.';
      delete valori.orePeSchimb;
    }

    // Capacitate: avertisment, nu blochează (verdictul „În afara aplicației de referință” se afișează în continuare).
    if (!erori.greutate && !erori.gripper) {
      var sarcina = valori.greutateKg + valori.greutateGripperKg;
      if (sarcina > REFERINTA.capacitateKg + EPS) {
        avertismente.greutate = fmt(sarcina) + ' kg cu gripperul depășesc capacitatea UR20 de ' +
          fmt(REFERINTA.capacitateKg) + ' kg: linia iese din aplicația de referință.';
      }
    }

    return { ok: Object.keys(erori).length === 0, erori: erori, avertismente: avertismente, valori: valori };
  }

  var api = {
    REFERINTA: REFERINTA,
    VERDICT_TEXT: VERDICT_TEXT,
    parseNumarRo: parseNumarRo,
    debitReferinta: debitReferinta,
    evaluate: evaluate,
    locatieTechCon: locatieTechCon,
    calificaCererea: calificaCererea,
    valideaza: valideaza,
    CAMPURI_FORMULAR: CAMPURI_FORMULAR
  };

  root.UR20Logic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
