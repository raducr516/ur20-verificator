/* Verificator UR20 — interfața (DOM). Logica de calcul este în logic.js (globalThis.UR20Logic). */
(function () {
  'use strict';

  var L = window.UR20Logic;
  var CHEIE_FORMULAR = 'ur20.formular';
  var CHEIE_CERERI = 'ur20.cereri';

  var JUDETE = [
    'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 'Brăila', 'București',
    'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați',
    'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți',
    'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș',
    'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea'
  ];

  /* Câmpurile numerice ale formularului: id-ul câmpului → cheia din input-ul pentru evaluate(). */
  var NUMERICE = [
    { id: 'greutate', cheie: 'greutateKg', nume: 'greutatea găleții' },
    { id: 'galeti-palet', cheie: 'galetiPePalet', nume: 'numărul de găleți pe palet' },
    { id: 'debit', cheie: 'debitGaletiMin', nume: 'debitul liniei' },
    { id: 'schimburi', cheie: 'schimburiPeZi', nume: 'numărul de schimburi' },
    { id: 'ore', cheie: 'orePeSchimb', nume: 'orele pe schimb' },
    { id: 'operatori', cheie: 'operatori', nume: 'numărul de operatori' },
    { id: 'gripper', cheie: 'greutateGripperKg', nume: 'greutatea gripperului' }
  ];
  var RADIO = ['industrie', 'maner', 'separator', 'spatiu'];
  var TOATE_ERORILE = NUMERICE.map(function (c) { return c.id; }).concat(RADIO);

  var stare = { raw: null, input: null, rezultat: null, ultimaCerere: null };

  function $(id) { return document.getElementById(id); }

  function fmt(n, z) {
    if (n == null || !isFinite(n)) return '–';
    return Number(n).toLocaleString('ro-RO', { maximumFractionDigits: z == null ? 2 : z });
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ---------- stocare (doar localStorage, fiecare acces în try/catch) ---------- */
  function citesteStocare(cheie, implicit) {
    try {
      var v = window.localStorage.getItem(cheie);
      return v ? JSON.parse(v) : implicit;
    } catch (e) { return implicit; }
  }
  function scrieStocare(cheie, valoare) {
    try { window.localStorage.setItem(cheie, JSON.stringify(valoare)); return true; } catch (e) { return false; }
  }

  /* ---------- formular ---------- */

  /* Singurul loc în care se citesc valorile brute din formular. */
  function citesteFormular() {
    var raw = {};
    NUMERICE.forEach(function (c) { raw[c.id] = $(c.id).value; });
    RADIO.forEach(function (nume) {
      var ales = document.querySelector('input[name="' + nume + '"]:checked');
      raw[nume] = ales ? ales.value : '';
    });
    return raw;
  }

  /* Completează formularul din valori brute (folosit la restaurare și, ulterior, la butoanele „Exemplu”). */
  function completeazaFormular(raw) {
    if (!raw) return;
    NUMERICE.forEach(function (c) { if (raw[c.id] != null) $(c.id).value = raw[c.id]; });
    RADIO.forEach(function (nume) {
      var radios = document.querySelectorAll('input[name="' + nume + '"]');
      Array.prototype.forEach.call(radios, function (r) { r.checked = (r.value === raw[nume]); });
    });
  }

  /* Singurul loc în care valorile brute se convertesc în numere și se validează (minim). */
  function convertesteFormular(raw) {
    var input = {};
    var erori = {};
    NUMERICE.forEach(function (c) {
      var text = String(raw[c.id] == null ? '' : raw[c.id]).trim();
      if (c.id === 'gripper' && text === '') { input[c.cheie] = L.REFERINTA.gripperImplicitKg; return; }
      if (text === '') { erori[c.id] = 'Completați ' + c.nume + '.'; return; }
      var n = L.parseNumarRo(text);
      if (!isFinite(n)) { erori[c.id] = 'Introduceți un număr (ex. 7,4).'; return; }
      if (n <= 0 && c.id !== 'gripper') { erori[c.id] = 'Valoarea trebuie să fie mai mare decât zero.'; return; }
      if (n < 0) { erori[c.id] = 'Valoarea nu poate fi negativă.'; return; }
      input[c.cheie] = n;
    });
    if (!raw.industrie) erori.industrie = 'Alegeți tipul de produs.'; else input.industrie = raw.industrie;
    if (!raw.maner) erori.maner = 'Alegeți Da sau Nu.'; else input.maner = raw.maner === 'da';
    if (!raw.separator) erori.separator = 'Alegeți Da sau Nu.'; else input.separator = raw.separator === 'da';
    if (!raw.spatiu) erori.spatiu = 'Alegeți un răspuns.'; else input.spatiu = raw.spatiu;
    return { input: input, erori: erori, valid: Object.keys(erori).length === 0 };
  }

  /* Singurul loc în care se afișează erorile pe câmp. */
  function afiseazaErori(erori) {
    erori = erori || {};
    TOATE_ERORILE.forEach(function (id) {
      var el = $('err-' + id);
      if (el) el.textContent = erori[id] || '';
      var camp = $(id);
      if (camp && camp.tagName === 'INPUT') {
        if (erori[id]) camp.setAttribute('aria-invalid', 'true'); else camp.removeAttribute('aria-invalid');
      }
    });
    var n = Object.keys(erori).length;
    $('err-form').textContent = n ? 'Verificați ' + (n === 1 ? 'câmpul marcat' : 'cele ' + n + ' câmpuri marcate') + ' mai sus.' : '';
    if (erori.gripper) $('ipoteze').open = true;
    if (n) {
      var primul = TOATE_ERORILE.filter(function (id) { return erori[id]; })[0];
      var tinta = $(primul) || document.querySelector('input[name="' + primul + '"]');
      if (tinta) tinta.focus();
    }
  }

  /* ---------- navigare ---------- */
  var ECRANE = { linie: 1, rezultat: 2, cerere: 3, confirmare: 3 };

  function arataEcran(nume) {
    Object.keys(ECRANE).forEach(function (e) { $('ecran-' + e).hidden = (e !== nume); });
    var pas = ECRANE[nume];
    for (var i = 1; i <= 3; i++) {
      var li = $('pas-ind-' + i);
      li.classList.toggle('activ', i === pas);
      li.classList.toggle('gata', i < pas || (nume === 'confirmare' && i === 3));
      if (i === pas) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
    var h = $('titlu-' + nume);
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }

  /* ---------- rezultat ---------- */
  var PICTOGRAME = {
    potrivit: '<svg class="pictograma" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    validare: '<svg class="pictograma" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L23 21.5H1z" fill="currentColor"/><path d="M12 8.5v6.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18" r="1.5" fill="#fff"/></svg>',
    in_afara: '<svg class="pictograma" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7.5 7.5l9 9M16.5 7.5l-9 9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>'
  };
  var ETICHETE_VERDICT = { potrivit: 'Verdict', validare: 'Verdict', in_afara: 'Verdict' };

  function htmlVerdict(rez) {
    return PICTOGRAME[rez.verdict] +
      '<div><p class="eticheta">' + ETICHETE_VERDICT[rez.verdict] + '</p><p class="text">' + esc(rez.verdictText) + '</p></div>';
  }

  function bara(valoare, maxim) {
    var p = maxim > 0 ? Math.min(100, Math.max(0, valoare / maxim * 100)) : 0;
    return '<div class="bara' + (valoare > maxim ? ' peste' : '') + '" aria-hidden="true"><span style="width:' + p.toFixed(1) + '%"></span></div>';
  }

  function card(val, unitate, desc, lat, extra) {
    return '<div class="card' + (lat ? ' lat' : '') + '"><span class="val">' + val + (unitate ? ' <small>' + unitate + '</small>' : '') +
      '</span><span class="desc">' + desc + '</span>' + (extra || '') + '</div>';
  }

  function htmlCalcule(input, rez) {
    var c = rez.calcule;
    return [
      card(fmt(c.tonePeSchimb), 't', 'ridicate manual pe schimb (' + fmt(c.kgPeSchimb, 0) + ' kg); ' + fmt(c.kgPeZi, 0) + ' kg pe zi'),
      card(fmt(c.kgPeOperatorPeSchimb, 0), 'kg', 'ridicate manual de fiecare operator, pe schimb'),
      card(fmt(c.paletiPeOra), 'paleți/oră', 'paleți compleți pe oră'),
      card(fmt(c.minuteIntrePaleti), 'min', 'între două schimbări de palet (manuale)'),
      card(fmt(c.sarcinaTotalaKg) + ' / ' + fmt(c.capacitateKg), 'kg', 'sarcina totală (găleată + gripper ' + fmt(input.greutateGripperKg) + ' kg, ipoteză) față de capacitatea nominală UR20', true, bara(c.sarcinaTotalaKg, c.capacitateKg)),
      card(fmt(input.debitGaletiMin) + ' / ' + fmt(c.debitReferinta), 'găleți/min', 'debitul liniei dvs. față de valoarea testată la PURATOS pentru acest format (rezultat de test, nu garanție)', true, bara(input.debitGaletiMin, c.debitReferinta))
    ].join('');
  }

  function randeazaLista(ul, bloc, elemente) {
    ul.innerHTML = elemente.map(function (m) { return '<li>' + esc(m.text) + '</li>'; }).join('');
    bloc.hidden = elemente.length === 0;
  }

  function arataRezultat(input, rez) {
    var v = $('verdict');
    v.className = 'verdict verdict-' + rez.verdict;
    v.setAttribute('data-verdict', rez.verdict);
    v.innerHTML = htmlVerdict(rez);
    randeazaLista($('lista-motive'), $('bloc-motive'), rez.motive);
    randeazaLista($('lista-note'), $('bloc-note'), rez.note);
    $('calcule').innerHTML = htmlCalcule(input, rez);
    arataEcran('rezultat');
  }

  function laVerifica(ev) {
    ev.preventDefault();
    var raw = citesteFormular();
    scrieStocare(CHEIE_FORMULAR, raw);
    var conv = convertesteFormular(raw);
    afiseazaErori(conv.erori);
    if (!conv.valid) return;
    stare.raw = raw;
    stare.input = conv.input;
    stare.rezultat = L.evaluate(conv.input);
    arataRezultat(stare.input, stare.rezultat);
  }

  /* ---------- cerere și fișa de pre-evaluare ---------- */
  var ETICHETE_INDUSTRIE = { alimentar: 'Alimentar', alta: 'Altă industrie' };
  var ETICHETE_SPATIU = { da: 'Da', nu: 'Nu', nu_stiu: 'Nu știu' };

  function numarCerere(d) {
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return 'UR20-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + String(Math.floor(1000 + Math.random() * 9000));
  }

  function rand(th, td) { return '<tr><th scope="row">' + th + '</th><td>' + td + '</td></tr>'; }

  function htmlFisa(cerere) {
    var i = cerere.input, r = cerere.rezultat, c = r.calcule, k = cerere.calificare, ct = cerere.contact;
    var dataText = new Date(cerere.data).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var icoOk = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var icoAtentie = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L23 21.5H1z" fill="currentColor"/><path d="M12 8.5v6.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18" r="1.5" fill="#fff"/></svg>';
    var calif = '<div id="calificare" class="calificare ' + (k.relevanta ? 'calificare-relevanta' : 'calificare-incompleta') + '" data-relevanta="' + k.relevanta + '">' +
      '<p class="titlu">' + (k.relevanta ? icoOk : icoAtentie) + '<span id="eticheta-cerere">' + esc(k.eticheta) + '</span></p>' +
      (k.lipsuri.length ? '<ul id="lista-lipsuri">' + k.lipsuri.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') +
      '</div>';
    var alocare = '<div class="alocare"><p id="alocare">' + (ct.judet
      ? 'Propunere de alocare: Tech-Con ' + esc(cerere.locatie) + ' (după județul ' + esc(ct.judet) + ').'
      : 'Propunere de alocare: Tech-Con ' + esc(cerere.locatie) + ' (implicit, județul nu a fost ales).') + '</p></div>';
    return '<div class="fisa-antet"><span>Cererea nr. <strong id="nr-cerere">' + esc(cerere.numar) + '</strong></span><span>Data: <strong id="data-cerere">' + esc(dataText) + '</strong></span></div>' +
      calif + alocare +
      '<div class="verdict verdict-' + r.verdict + '">' + htmlVerdict(r) + '</div>' +
      '<div class="bloc"><h3>Date de contact <span class="eticheta-ipoteza">fictive</span></h3><table class="tabel-date"><tbody>' +
        rand('Firma', esc(ct.firma) || '–') + rand('Rol', esc(ct.rol) || '–') + rand('Județ', esc(ct.judet) || '–') +
      '</tbody></table></div>' +
      '<div class="bloc"><h3>Datele liniei</h3><table class="tabel-date"><tbody>' +
        rand('Tip produs / industrie', ETICHETE_INDUSTRIE[i.industrie] || '–') +
        rand('Greutatea găleții pline', fmt(i.greutateKg) + ' kg') +
        rand('Găleți pe palet', fmt(i.galetiPePalet)) +
        rand('Debitul liniei', fmt(i.debitGaletiMin) + ' găleți/min') +
        rand('Program', fmt(i.schimburiPeZi) + ' schimburi × ' + fmt(i.orePeSchimb) + ' h') +
        rand('Operatori la paletizare, pe schimb', fmt(i.operatori)) +
        rand('Mâner', i.maner ? 'Da' : 'Nu') +
        rand('Separatoare între straturi', i.separator ? 'Da' : 'Nu') +
        rand('Spațiu la capătul liniei', ETICHETE_SPATIU[i.spatiu] || '–') +
        rand('Gripper (ipoteză)', fmt(i.greutateGripperKg) + ' kg') +
      '</tbody></table></div>' +
      '<div class="bloc"><h3>Calcule <span class="eticheta-ipoteza">pe baza datelor introduse</span></h3><table class="tabel-date"><tbody>' +
        rand('Ridicate manual pe schimb', fmt(c.tonePeSchimb) + ' t (' + fmt(c.kgPeSchimb, 0) + ' kg)') +
        rand('Ridicate manual pe zi', fmt(c.kgPeZi, 0) + ' kg') +
        rand('Pe operator, pe schimb', fmt(c.kgPeOperatorPeSchimb, 0) + ' kg') +
        rand('Paleți pe oră', fmt(c.paletiPeOra)) +
        rand('Minute între două schimbări de palet', fmt(c.minuteIntrePaleti)) +
        rand('Sarcină totală / capacitate UR20', fmt(c.sarcinaTotalaKg) + ' / ' + fmt(c.capacitateKg) + ' kg') +
        rand('Debit linie / valoare testată', fmt(i.debitGaletiMin) + ' / ' + fmt(c.debitReferinta) + ' găleți/min') +
      '</tbody></table></div>' +
      '<p class="fix">Valorile de referință sunt rezultate de test din aplicația PURATOS, nu garanții pentru linia dumneavoastră.</p>';
  }

  function citesteContact() {
    return { firma: $('firma').value.trim(), rol: $('rol').value, judet: $('judet').value };
  }

  function laTrimite(ev) {
    ev.preventDefault();
    if (!stare.input || !stare.rezultat) { arataEcran('linie'); return; }
    var contact = citesteContact();
    var d = new Date();
    var cerere = {
      numar: stare.ultimaCerere && stare.ultimaCerere.inCompletare ? stare.ultimaCerere.numar : numarCerere(d),
      data: d.toISOString(),
      input: stare.input,
      rezultat: stare.rezultat,
      contact: contact,
      calificare: L.calificaCererea(stare.input, stare.rezultat, contact),
      locatie: L.locatieTechCon(contact.judet)
    };
    var cereri = citesteStocare(CHEIE_CERERI, []);
    if (!Array.isArray(cereri)) cereri = [];
    cereri = cereri.filter(function (x) { return x && x.numar !== cerere.numar; });
    cereri.push(cerere);
    scrieStocare(CHEIE_CERERI, cereri.slice(-50));
    stare.ultimaCerere = cerere;
    $('fisa').innerHTML = htmlFisa(cerere);
    $('btn-completeaza').hidden = cerere.calificare.relevanta;
    arataEcran('confirmare');
  }

  function laCompleteaza() {
    if (stare.ultimaCerere) stare.ultimaCerere.inCompletare = true;
    var lipsuri = stare.ultimaCerere ? stare.ultimaCerere.calificare.lipsuri : [];
    var doarContact = lipsuri.every(function (l) { return /firma|rolul|județul/.test(l); });
    arataEcran(doarContact ? 'cerere' : 'linie');
  }

  function laVerificareNoua() {
    stare = { raw: null, input: null, rezultat: null, ultimaCerere: null };
    $('form-linie').reset();
    $('form-cerere').reset();
    $('gripper').value = String(L.REFERINTA.gripperImplicitKg);
    afiseazaErori({});
    scrieStocare(CHEIE_FORMULAR, null);
    arataEcran('linie');
  }

  /* ---------- pornire ---------- */
  function init() {
    var sel = $('judet');
    JUDETE.forEach(function (j) {
      var o = document.createElement('option');
      o.value = j; o.textContent = j;
      sel.appendChild(o);
    });

    completeazaFormular(citesteStocare(CHEIE_FORMULAR, null));

    $('form-linie').addEventListener('submit', laVerifica);
    $('btn-modifica').addEventListener('click', function () { arataEcran('linie'); });
    $('btn-solicita').addEventListener('click', function () {
      if (stare.ultimaCerere) stare.ultimaCerere.inCompletare = false;
      arataEcran('cerere');
    });
    $('btn-inapoi-rezultat').addEventListener('click', function () { arataEcran('rezultat'); });
    $('form-cerere').addEventListener('submit', laTrimite);
    $('btn-completeaza').addEventListener('click', laCompleteaza);
    $('btn-verificare-noua').addEventListener('click', laVerificareNoua);

    /* Ștergem eroarea unui câmp de îndată ce utilizatorul îl modifică. */
    $('form-linie').addEventListener('input', function (ev) {
      var t = ev.target, id = t.type === 'radio' ? t.name : t.id;
      var el = $('err-' + id);
      if (el && el.textContent) { el.textContent = ''; t.removeAttribute('aria-invalid'); }
    });
    $('form-linie').addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.type === 'radio') { var el = $('err-' + t.name); if (el) el.textContent = ''; }
    });
  }

  /* Punct de extindere pentru pasul următor (exemple, validări detaliate). */
  window.UR20App = {
    citesteFormular: citesteFormular,
    completeazaFormular: completeazaFormular,
    convertesteFormular: convertesteFormular,
    afiseazaErori: afiseazaErori,
    arataEcran: arataEcran,
    JUDETE: JUDETE
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
