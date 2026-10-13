# Oma liikunta – Leuanveto ja Juoksu

Kehitysversio toimii osoitteessa:
https://51sth.github.io/leuanveto/liikunta-testi/

Tämä versio **ei korvaa vielä alkuperäistä Leuanveto-sovellusta**.

## Osat
- `index.html`: yhteinen etusivu, kirjautuminen ja kaksi harjoitusvalintaa
- `leuanveto/`: aiempi Leuanveto ja sen henkilökohtainen Firebase-synkronointi, sama `users/{uid}/sets`-data
- `juoksu/`: rappusjuoksu (nousut + kesto), Cooper (12 min + metrit), juoksu (km + kesto), historia ja tilastot. Tallennus `users/{uid}/runs`.
- `firebase-config.js`: Firebase-web-sovelluksen julkinen konfiguraatio

Sama Firebase-käyttäjätili toimii kaikissa osissa. Kirjautuminen on etusivulla. Aiempi paikallinen Leuanveto-historia löytyy edelleen selaimen tallennustilasta ja vanhan Leuanveto-sovelluksen pilvisarjat säilyvät.

## Firestore Rules – VAATII käyttäjän toimenpiteen ennen Juoksun tallennuksen testaamista

Avaa Firebase-projektissa Firestore Database → Rules. Korvaa nykyiset säännöt koko tiedoston `firestore.rules` sisällöllä ja paina **Publish**. Säännöt sallivat vain tunnistautuneen käyttäjän omien `sets`- ja `runs`-asiakirjojen lukemisen ja muokkaamisen. Älä korvaa alkuperäistä `sets`-sääntöä pelkällä `runs`-säännöllä: Leuanveto tarvitsee myös sen.

## Testaus ennen julkaisua

1. Kirjaudu tutulla käyttäjänimellä tai olemassa olevalla sähköpostitunnuksella.
2. Avaa Leuanveto, varmista vanhojen sarjojen näkyminen ja kokeile yksi uusi sarja.
3. Avaa Juoksu, valitse Rappusjuoksu ja tallenna lyhyt testiharjoitus.
4. Toista Juoksun tallennus Cooperilla ja tavallisella Juoksulla.
5. Tarkista että kaikki tallentuvat ja päivittyvät toisessa laitteessa.
6. Tarkista erillisellä käyttäjällä, etteivät toisen tilin tiedot näy.
7. Kun testit ovat onnistuneet, etusivun voi siirtää repositorion juureen pysyväksi osoitteeksi. Leuanveto ja Juoksu toimivat silloin omissa alihakemistoissaan.

HUOM: Käyttäjänimellä luoduilla sähköpostittomilla tileillä ei ole salasanan palautusta. Käytä omissa laitteissasi turvallisesti tallennettua salasanaa.
