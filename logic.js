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
    // „1.000,5” → „1000.5”; „7,4” → „7.4”; „7.4” rămâne
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
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

    var blocaj;
    if (debit > ref + EPS) {
      blocaj = 'peste_referinta';
      validare = true;
      motive.push({
        cod: 'debit_peste_referinta',
        text: 'Debitul liniei (' + fmt(debit) + ' găleți/min) depășește valoarea testată pentru acest format (' + fmt(ref) + ' găleți/min).'
      });
    } else if (debit < ref - EPS) {
      blocaj = 'amonte';
      note.push({
        cod: 'blocaj_amonte',
        text: 'Linia dvs. (' + fmt(debit) + ' găleți/min) este mai lentă decât valoarea testată (' + fmt(ref) +
          ' găleți/min): limita este în amonte, la umplere. Robotul nu crește debitul fabricii.'
      });
    } else {
      blocaj = 'la_referinta';
      note.push({
        cod: 'debit_la_referinta',
        text: 'Debitul liniei este egal cu valoarea testată pentru acest format (' + fmt(ref) + ' găleți/min): nu există rezervă de ritm; se verifică la evaluarea tehnică.'
      });
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

  function calificaCererea(input, rezultat, contact) {
    var i = input || {};
    var c = contact || {};
    var lipsuri = [];

    CAMPURI_TEHNICE.forEach(function (camp) {
      if (!camp[2](i[camp[0]])) lipsuri.push(camp[1]);
    });
    if (!rezultat || !rezultat.verdict) lipsuri.push('Lipsește verdictul verificării');
    if (i.industrie === 'alta') lipsuri.push('Industria nu este cea alimentară: cerințele tehnice se validează separat');
    if (rezultat && rezultat.verdict === 'in_afara') lipsuri.push('Verdict în afara aplicației de referință');
    if (!completat(c.firma)) lipsuri.push('Lipsește firma');
    if (!completat(c.rol)) lipsuri.push('Lipsește rolul');
    if (!completat(c.judet)) lipsuri.push('Lipsește județul');

    var relevanta = lipsuri.length === 0;
    return {
      relevanta: relevanta,
      eticheta: relevanta ? 'Cerere relevantă' : 'Cerere incompletă',
      lipsuri: lipsuri
    };
  }

  var api = {
    REFERINTA: REFERINTA,
    VERDICT_TEXT: VERDICT_TEXT,
    parseNumarRo: parseNumarRo,
    debitReferinta: debitReferinta,
    evaluate: evaluate,
    locatieTechCon: locatieTechCon,
    calificaCererea: calificaCererea
  };

  root.UR20Logic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
