# Leuanveto — kirjautuminen ja synkronointi

Tämä on **kehityshaara**. Nykyinen `main`-versio jatkaa normaalisti toimintaa, kunnes pilviyhteys on asetettu ja testattu.

## Mikä muuttuu?

- Harjoitustietojen tallennus henkilökohtaiselle Firebase-tilille.
- Sama sähköposti ja salasana toimii sekä tietokoneella että Android-selaimessa, **ilman sähköpostin vahvistusviestiä**.
- Firestoren reaaliaikainen päivitys: kirjautuneet laitteet näkevät saman tietokannan.
- Vanha paikallinen harjoitushistoria säilyy ja sen voi siirtää pilveen erillisellä toiminnolla.
- Kirjautumatta sovellus käyttää edelleen selaimen vanhaa paikallista tallennusta.
- Varmuuskopion palautus yhdistää sarjat pilveen eikä poista muulla laitteella tallennettuja sarjoja.

## Firebase-projektin käyttöönotto

1. Avaa https://console.firebase.google.com/ ja luo oma Firebase-projekti.
2. Lisää projektiin **Web app** (</>), kopioi sen julkinen `firebaseConfig`-olio. Näissä tulee olla vähintään `apiKey`, `authDomain`, `projectId`, `appId`. Älä kopioi *service account* -avaimia!
3. Avaa **Authentication → Sign-in method** ja ota käyttöön **Email/Password**. Sähköpostin vahvistamista ei tarvitse ottaa käyttöön. Oikea sähköpostiosoite on silti suositeltava salasanan palautusta varten.
4. Avaa **Firestore Database → Create database**. Valitse halutessasi EU-alue ja aluksi **Production mode**.
5. Avaa **Firestore Database → Rules**, liitä täsmälleen tiedoston [firestore.rules](firestore.rules) säännöt ja paina **Publish**. Tämä on välttämätöntä yksityisyydelle: vain kirjautunut käyttäjä saa lukea ja muokata omia sarjojaan. Älä jätä tietokantaa testitilan avoimille säännöille.
6. Lisää tarvittaessa Firebase Authenticationin **Settings → Authorized domains** -kohtaan `51sth.github.io` (etenkin salasanan palautuksen osalta).
7. Korvaa [firebase-config.js](firebase-config.js)-tiedoston tyhjät kentät Firebase-projektin **julkisilla** web-asetuksilla. API-avain on Firebase-verkkosovelluksen julkinen tunniste, **ei** salainen palvelinavain.
8. Testaa kirjautuminen, yhden sarjan tallennus, saman sarjan näkymisen varmistus toisella laitteella ja pääsyn rajaus eri tunnuksella. Julkaise vasta tämän jälkeen `main`-haaraan.

Firebase voi pyytää maksutilin tai rajoittaa maksuttomia palveluja projektin asetuksista riippuen. Tarkista käytössä oleva hinnoittelu Firebase Consolesta ennen kuin hyväksyt maksullisia palveluja.

## Vanhojen treenien siirtäminen

- Kirjaudu sovellukseen samassa selaimessa, jolla olet aikaisemmin kirjannut harjoitukset. Sovellus näyttää **Siirrä tämän selaimen harjoitukset pilveen** -painikkeen, jos paikallisia treenejä on.
- Jos harjoitukset ovat vanhassa Netlify-osoitteessa, lataa sieltä JSON-varmuuskopio ja palauta se uudessa osoitteessa kirjautumisen jälkeen. Eri verkkotunnusten localStorage-tiedot eivät siirry automaattisesti.
- Älä poista alkuperäisiä harjoituksia tai varmuuskopioita ennen kuin olet varmistanut pilvisynkronoinnin toimivan.
- Jos kahdella eri laitteella on samoilla tunnisteilla eri sisältöä, viimeksi tuotu sarja korvaa saman tunnisteen aiemman. Normaalit uudella UUID:llä tallennetut sarjat eivät törmää toisiinsa.

## Käyttö ja rajaukset

Verkkoyhteys tarvitaan pilviharjoitusten kirjoittamiseen. Sovellus kertoo, jos yhteys katkeaa; paikallisia vanhoja tietoja ei pyyhitä pois. Älä tallenna salasanoja tähän repositorioon tai jaa niitä ChatGPT:ssä.
