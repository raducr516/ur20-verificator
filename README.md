# Verificator UR20

Link public: https://raducr516.github.io/ur20-verificator/

Instrument de pre-evaluare pentru directorul de producție al unei fabrici alimentare care umple găleți de 5–15 kg. Introduceți datele liniei, primiți un verdict față de aplicația de referință PURATOS (celule de paletizare cu robot UR20, livrate de Tech-Con) și puteți solicita o evaluare tehnică.

## Cum testați, în trei pași

**Pasul 1.** Deschideți linkul pe telefon sau în browser. Ar trebui să vedeți titlul „Verificator UR20” și formularul „Linia dvs. de umplere”.

**Pasul 2, caz normal.** Apăsați „Exemplu: caz normal”. Ar trebui să vedeți verdictul „Potrivit pentru evaluare tehnică” și calculele: 37,44 t ridicate manual pe schimb, 8,18 paleți pe oră și 7,33 minute între două schimbări de palet.
Apoi apăsați „Solicită evaluarea tehnică”, „Completează cu date fictive” și „Trimite cererea”. Ar trebui să vedeți „Fișa de pre-evaluare” cu „Cerere relevantă” și o propunere de alocare către o locație Tech-Con.

**Pasul 3, date greșite.** Pe fișă apăsați „Verificare nouă”, apoi „Exemplu: date greșite”. Ar trebui să vedeți șase mesaje, fiecare sub câmpul lui: cinci erori (găleți pe palet, debit, schimburi, ore pe schimb, operatori) și un avertisment de capacitate sub greutatea găleții. Nu apare niciun verdict.
Corectați un câmp, de exemplu debitul: mesajul de sub el dispare. Verdictul apare abia după ce toate câmpurile sunt corecte și apăsați „Verifică linia”.

## Ce înseamnă verdictele

- **„Potrivit pentru evaluare tehnică”**: linia nu are niciun motiv de validare suplimentară. Puteți solicita evaluarea tehnică.
- **„Necesită validare suplimentară”**: greutatea este în afara intervalului testat (5–13 kg), debitul depășește valoarea testată, găleata nu are mâner, industria nu este cea alimentară sau spațiul la capătul liniei este „Nu” ori „Nu știu”.
- **„În afara aplicației de referință”**: găleata plus gripperul depășesc 20 kg, capacitatea nominală a UR20 din fișa Universal Robots. Greutatea gripperului (5 kg) este o ipoteză, pe care o puteți modifica în „Ipoteze de calcul”.

## Ce NU face

- Nu calculează economii salariale și nu calculează recuperarea investiției.
- Nu acoperă transportul paleților, înfolierea și expedierea.
- Valorile de referință (8,6 găleți/min la 5 kg, 7,4 găleți/min la 13 kg) sunt rezultate de test din aplicația PURATOS, nu garanții.
- Schimbarea paleților și amplasarea separatoarelor rămân manuale.

## Date

Este o demonstrație. Introduceți doar date fictive, nu date reale. Datele rămân în browserul dvs.; nimic nu se trimite nicăieri.

## Tehnic

- Site static, fără build: `index.html`, `style.css`, `logic.js`, `app.js`.
- `logic.js` conține regulile și calculele (funcții pure); `app.js` conține interfața.
- Teste automate în `test.html`. Aplicația se poate deschide și direct de pe disc, din `index.html`.

---

Prototip realizat pentru un concurs studențesc. Nu este un instrument oficial Tech-Con, PURATOS sau Universal Robots.
