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

  /* Forma corectă a substantivului după număr: „1 schimb”, „2 schimburi”. */
  function cuNumar(n, singular, plural) {
    return fmt(n) + ' ' + (fmt(n) === '1' ? singular : plural);
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

  /* Conversia și validarea se fac în logic.js (UR20Logic.valideaza); aici doar adaptăm rezultatul. */
  function convertesteFormular(raw) {
    var v = L.valideaza(raw);
    return { input: v.valori, erori: v.erori, avertismente: v.avertismente, valid: v.ok };
  }

  /* Ordinea câmpurilor în pagină (pentru focus pe primul câmp greșit). */
  var ORDINE = L.CAMPURI_FORMULAR.map(function (c) { return c.id; });

  var ICO_EROARE = '<svg class="ico-mesaj" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.5" fill="#fff"/></svg>';
  var ICO_ATENTIE = '<svg class="ico-mesaj" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L23 21.5H1z" fill="currentColor"/><path d="M12 8.5v6.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18" r="1.5" fill="#fff"/></svg>';

  function campuriRadio(id) { return document.querySelectorAll('input[name="' + id + '"]'); }

  /* Pune / șterge mesajul unui câmp. tip: 'eroare', 'avertisment' sau null. */
  function seteazaMesaj(id, tip, mesaj) {
    var el = $('err-' + id);
    if (!el) return;
    if (!tip) {
      el.innerHTML = '';
      el.className = 'eroare';
    } else {
      el.className = tip === 'eroare' ? 'eroare' : 'eroare avertisment';
      el.innerHTML = (tip === 'eroare' ? ICO_EROARE : ICO_ATENTIE + '<strong>Atenție:</strong> ') + '<span>' + esc(mesaj) + '</span>';
    }
    var grup = el.parentElement;
    if (grup) grup.classList.toggle('are-eroare', tip === 'eroare');
    var campuri = $(id) ? [$(id)] : Array.prototype.slice.call(campuriRadio(id));
    campuri.forEach(function (c) {
      if (tip === 'eroare') c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    });
  }

  function actualizeazaRezumat() {
    var n = ORDINE.filter(function (id) { var el = $('err-' + id); return el && el.innerHTML && !el.classList.contains('avertisment'); }).length;
    var text = n ? 'Corectați ' + (n === 1 ? '1 câmp' : n + ' câmpuri') + ' pentru a vedea rezultatul.' : '';
    $('rezumat-erori').innerHTML = n ? ICO_EROARE + '<span>' + text + '</span>' : '';
    $('rezumat-erori').hidden = !n;
    $('err-form').textContent = text;
    return n;
  }

  /* Singurul loc în care se afișează erorile și avertismentele pe câmp. */
  function afiseazaErori(erori, avertismente) {
    erori = erori || {};
    avertismente = avertismente || {};
    ORDINE.forEach(function (id) {
      if (erori[id]) seteazaMesaj(id, 'eroare', erori[id]);
      else if (avertismente[id]) seteazaMesaj(id, 'avertisment', avertismente[id]);
      else seteazaMesaj(id, null);
    });
    var n = actualizeazaRezumat();
    if (erori.gripper) $('ipoteze').open = true;
    if (n) {
      var primul = ORDINE.filter(function (id) { return erori[id]; })[0];
      var tinta = $(primul) || campuriRadio(primul)[0];
      var grup = $('err-' + primul) && $('err-' + primul).parentElement;
      if (grup && grup.scrollIntoView) grup.scrollIntoView({ block: 'center' });
      if (tinta) { try { tinta.focus({ preventScroll: true }); } catch (e) { tinta.focus(); } }
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
      card(fmt(c.paletiPeOra), fmt(c.paletiPeOra) === '1' ? 'palet/oră' : 'paleți/oră', 'paleți compleți pe oră'),
      card(fmt(c.minuteIntrePaleti), 'min', 'între două schimbări de palet (manuale)'),
      card(fmt(c.sarcinaTotalaKg) + ' / ' + fmt(c.capacitateKg), 'kg', 'sarcina totală (găleată + gripper ' + fmt(input.greutateGripperKg) + ' kg, ipoteză) față de capacitatea nominală UR20', true, bara(c.sarcinaTotalaKg, c.capacitateKg)),
      card(fmt(input.debitGaletiMin) + ' / ' + fmt(c.debitReferinta), 'găleți/min', (c.formatTestatExact
        ? 'debitul liniei dvs. față de valoarea testată la PURATOS pentru găleata de ' + fmt(c.formatReferintaKg) + ' kg (rezultat de test, nu garanție)'
        : 'debitul liniei dvs. față de reperul testat la PURATOS pentru găleata de ' + fmt(c.formatReferintaKg) + ' kg, nu pentru formatul dvs. (rezultat de test, nu garanție)'), true, bara(input.debitGaletiMin, c.debitReferinta))
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
    if (ev) ev.preventDefault();
    var raw = citesteFormular();
    scrieStocare(CHEIE_FORMULAR, raw);
    var conv = convertesteFormular(raw);
    afiseazaErori(conv.erori, conv.avertismente);
    if (!conv.valid) { stare.input = null; stare.rezultat = null; return; }
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

  /* Tipul cererii: 'relevanta', 'incompleta' sau 'validare_separata' (cererile vechi nu au „tip”). */
  function tipCerere(k) { return k.tip || (k.relevanta ? 'relevanta' : 'incompleta'); }

  function htmlFisa(cerere) {
    var i = cerere.input, r = cerere.rezultat, c = r.calcule, k = cerere.calificare, ct = cerere.contact;
    var dataText = new Date(cerere.data).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var icoOk = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var icoAtentie = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L23 21.5H1z" fill="currentColor"/><path d="M12 8.5v6.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18" r="1.5" fill="#fff"/></svg>';
    var icoInfo = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="6.8" r="1.6" fill="#fff"/><path d="M12 10.5v7.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';
    var tip = tipCerere(k);
    var stil = { relevanta: ['calificare-relevanta', icoOk], incompleta: ['calificare-incompleta', icoAtentie], validare_separata: ['calificare-separata', icoInfo] }[tip];
    var calif = '<div id="calificare" class="calificare ' + stil[0] + '" data-relevanta="' + k.relevanta + '" data-tip="' + tip + '">' +
      '<p class="titlu">' + stil[1] + '<span id="eticheta-cerere">' + esc(k.eticheta) + '</span></p>' +
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
        rand('Debitul liniei', cuNumar(i.debitGaletiMin, 'găleată/min', 'găleți/min')) +
        rand('Program', cuNumar(i.schimburiPeZi, 'schimb', 'schimburi') + ' × ' + fmt(i.orePeSchimb) + ' h') +
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
        rand('Debit linie / valoare testată', fmt(i.debitGaletiMin) + ' / ' + fmt(c.debitReferinta) + ' găleți/min (testat la PURATOS pentru găleata de ' + fmt(c.formatReferintaKg) + ' kg' + (c.formatTestatExact ? '' : ', nu pentru formatul dvs.') + ')') +
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
    var salvata = scrieStocare(CHEIE_CERERI, cereri.slice(-50));
    stare.ultimaCerere = cerere;
    $('fisa').innerHTML = htmlFisa(cerere);
    var nota = $('nota-stocare');
    if (nota) {
      nota.innerHTML = salvata ? '' : ICO_ATENTIE + '<span>Cererea nu a putut fi salvată în acest browser. Fișa rămâne vizibilă până închideți pagina.</span>';
      nota.hidden = salvata;
    }
    $('btn-completeaza').hidden = tipCerere(cerere.calificare) !== 'incompleta';
    arataEcran('confirmare');
  }

  function laCompleteaza() {
    if (stare.ultimaCerere) stare.ultimaCerere.inCompletare = true;
    var lipsuri = stare.ultimaCerere ? stare.ultimaCerere.calificare.lipsuri : [];
    var doarContact = lipsuri.every(function (l) { return /firma|rolul|județul|validează separat|în afara aplicației/.test(l); });
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

  /* ---------- exemple pentru demonstrație (date fictive) ---------- */
  var EXEMPLE = {
    normal: {
      industrie: 'alimentar', greutate: '13', 'galeti-palet': '44', debit: '6', schimburi: '3', ore: '8',
      operatori: '2', maner: 'da', separator: 'da', spatiu: 'da', gripper: '5'
    },
    gresit: {
      industrie: 'alimentar', greutate: '25', 'galeti-palet': '0', debit: 'repede', schimburi: '4', ore: '',
      operatori: '-2', maner: 'da', separator: 'da', spatiu: 'da', gripper: '5'
    }
  };

  function ruleazaExemplu(nume) {
    stare.ultimaCerere = null;
    completeazaFormular(EXEMPLE[nume]);
    laVerifica(null);
  }

  function completeazaContactFictiv() {
    $('firma').value = 'Fabrica Demo SRL';
    $('rol').value = 'Director de producție / de fabrică';
    $('judet').value = 'Ilfov';
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

    $('btn-exemplu-normal').addEventListener('click', function () { ruleazaExemplu('normal'); });
    $('btn-exemplu-gresit').addEventListener('click', function () { ruleazaExemplu('gresit'); });
    $('btn-date-fictive').addEventListener('click', completeazaContactFictiv);

    /* Ștergem mesajul unui câmp de îndată ce utilizatorul îl modifică; rezumatul se actualizează. */
    function laModificare(ev) {
      var t = ev.target, id = t.type === 'radio' ? t.name : t.id;
      var el = $('err-' + id);
      if (el && el.innerHTML) { seteazaMesaj(id, null); actualizeazaRezumat(); }
    }
    $('form-linie').addEventListener('input', laModificare);
    $('form-linie').addEventListener('change', laModificare);
  }

  /* Punct de extindere pentru pasul următor (exemple, validări detaliate). */
  window.UR20App = {
    citesteFormular: citesteFormular,
    completeazaFormular: completeazaFormular,
    convertesteFormular: convertesteFormular,
    afiseazaErori: afiseazaErori,
    arataEcran: arataEcran,
    ruleazaExemplu: ruleazaExemplu,
    EXEMPLE: EXEMPLE,
    JUDETE: JUDETE
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
