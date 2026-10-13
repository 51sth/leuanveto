import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const badge = $("cloudBadge"), status = $("cloudStatus"), toggle = $("authToggle");
const panel = $("authPanel"), errorBox = $("authError"), importButton = $("cloudImport");
let user = null, ready = false, stopListening = null, auth, db, firestore;
let autoImportAttempted=false;
const USERNAME_DOMAIN="users.leuanveto.example.com";
const OWNER_KEY="leuanveto-local-import-owner-v1";
const importedKey=uid=>"leuanveto-local-imported-v1:"+uid;
function getLoginEmail(value) {
  const name=value.trim().toLowerCase();
  if(name.includes("@")) {
    if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(name)) throw new Error("Sähköpostiosoite on virheellinen");
    return name;
  }
  if(!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(name)) throw new Error("Käyttäjänimessä pitää olla 3–24 merkkiä: a–z, 0–9, _ tai -.");
  return name+"@"+USERNAME_DOMAIN;
}
function accountLabel(current) {
  const suffix="@"+USERNAME_DOMAIN;
  return current?.email?.endsWith(suffix) ? current.email.slice(0,-suffix.length) : "sähköpostitili";
}
function importedSet(uid) {
  try {
    const ids=JSON.parse(localStorage.getItem(importedKey(uid))||"[]");
    return new Set(Array.isArray(ids)?ids.filter(x=>typeof x==="string"):[]);
  } catch { return new Set() }
}
function localPending(uid) {
  const imported=importedSet(uid);
  return window.leuanvetoBridge.getLocal().filter(r=>validateEntry(r)&&!imported.has(r.id));
}
function refreshImportButton() {
  const pending=user?localPending(user.uid):[];
  importButton.hidden= !user || pending.length===0;
  importButton.disabled=!ready;
  if(user && pending.length>0) {
    importButton.textContent="↑ Siirrä "+pending.length+" paikallista sarjaa pilveen";
  }
}
function markImported(uid, entries) {
  const ids=importedSet(uid);
  for(const r of entries) ids.add(r.id);
  localStorage.setItem(importedKey(uid),JSON.stringify([...ids]));
  if(!localStorage.getItem(OWNER_KEY)) localStorage.setItem(OWNER_KEY,uid);
  refreshImportButton();
}
async function autoImportLocal(uid) {
  const pending=localPending(uid);
  if(!pending.length) { refreshImportButton();return }
  const owner=localStorage.getItem(OWNER_KEY);
  if(owner && owner!==uid) {
    note("Paikallisia sarjoja ei siirretty automaattisesti: ne on aiemmin yhdistetty toiseen tiliin.");
    refreshImportButton();
    return;
  }
  $("save").disabled=true;
  note("Siirretään "+pending.length+" aiempaa sarjaa automaattisesti pilveen…");
  try {
    await window.leuanvetoCloud.import(pending);
    markImported(uid,pending);
    note("Vanhat harjoitukset siirretty pilveen · synkronoitu");
  } catch(err) {
    note("Automaattinen siirto epäonnistui: "+err.message+" – voit yrittää uudelleen siirtopainikkeella.");
    refreshImportButton();
  } finally {
    $("save").disabled=!ready;
  }
}

const hasConfig = ["apiKey", "authDomain", "projectId", "appId"].every(k => typeof firebaseConfig[k] === "string" && firebaseConfig[k].trim());
const note = message => { status.textContent = message };
const failure = message => { errorBox.textContent = message };
function setBusy(isBusy) {
  for (const id of ["loginButton", "signupButton", "resetButton", "cloudImport"]) {
    $(id).disabled = isBusy;
  }
}
function validateEntry(r) {
  return r && typeof r.id === "string" && r.id.length > 0 && r.id.length < 300 &&
    r.id !== "." && r.id !== ".." && !r.id.includes("/") &&
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Number.isInteger(r.reps) && r.reps >= 1 && r.reps <= 10000 &&
    typeof r.time === "string" && r.time.length <= 100 &&
    Number.isFinite(Number(r.weight || 0));
}
function normalize(r) {
  if (!validateEntry(r)) throw new Error("Virheellinen harjoitustieto");
  return {
    id:r.id, date:r.date, reps:r.reps,
    time:r.time,
    grip:r.grip === "myötäote" ? "myötäote" : "vastaote",
    weight:Math.max(0, Number(r.weight)||0)
  };
}
function requireAccount() {
  if (!user || !db || !ready) throw new Error("Kirjaudu ensin ja odota tietojen latautumista");
}
function drawAccount() {
  const active=Boolean(user);
  badge.textContent = active ? "Pilvi" : "Tämä laite";
  badge.className = active ? "pill-cloud" : "pill-local";
  toggle.textContent=active ? "Kirjaudu ulos" : "Kirjaudu";
  refreshImportButton();
}
window.leuanvetoCloud = {
  async save(record) {
    requireAccount();
    if (!navigator.onLine) throw new Error("Internet-yhteys puuttuu");
    const r=normalize(record);
    await firestore.setDoc(firestore.doc(db,"users",user.uid,"sets",r.id),r);
  },
  async remove(id) {
    requireAccount();
    if (!navigator.onLine) throw new Error("Internet-yhteys puuttuu");
    await firestore.deleteDoc(firestore.doc(db,"users",user.uid,"sets",id));
  },
  async import(entries) {
    requireAccount();
    if (!navigator.onLine) throw new Error("Internet-yhteys puuttuu");
    if (!Array.isArray(entries)) throw new Error("Varmuuskopion rakenne ei kelpaa");
    const normalized=entries.map(normalize);
    if (normalized.length > 10000) throw new Error("Varmuuskopio on liian suuri");
    importButton.disabled=true;
    try {
      for (let i=0;i<normalized.length;i+=300) {
        let batch=firestore.writeBatch(db);
        for (const r of normalized.slice(i,i+300)) {
          batch.set(firestore.doc(db,"users",user.uid,"sets",r.id),r);
        }
        note("Siirretään harjoituksia pilveen: "+Math.min(i+300,normalized.length)+"/"+normalized.length);
        await batch.commit();
      }
      note("Harjoitukset tallennettu pilveen");
    } finally { importButton.disabled=false }
  }
};
if (!hasConfig) {
  note("Pilvisynkronointi odottaa Firebase-asetuksia. Paikallinen tallennus toimii edelleen.");
} else {
  toggle.hidden=false;
  try {
    const [firebaseApp, firebaseAuth, firebaseFirestore]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js")
    ]);
    firestore=firebaseFirestore;
    const app=firebaseApp.initializeApp(firebaseConfig);
    auth=firebaseAuth.getAuth(app);
    db=firebaseFirestore.getFirestore(app);
    firebaseAuth.onAuthStateChanged(auth, currentUser => {
      if(stopListening){stopListening();stopListening=null}
      user=currentUser;ready=false;autoImportAttempted=false;
      window.leuanvetoBridge.setLocal();
      drawAccount();
      if (!currentUser) {
        $("save").disabled=false;
        note("Tallennus vain tähän selaimeen – kirjaudu sisään synkronointia varten");
        return;
      }
      $("save").disabled=true;
      panel.hidden=true;failure("");
      note("Ladataan harjoituksia pilvestä…");
      const uid=currentUser.uid;
      stopListening=firebaseFirestore.onSnapshot(
        firebaseFirestore.collection(db,"users",uid,"sets"),
        {includeMetadataChanges:true},
        snapshot => {
          if (!user || user.uid!==uid) return;
          const synced=snapshot.docs.map(doc=>doc.data()).filter(validateEntry);
          ready = navigator.onLine && !snapshot.metadata.fromCache;
          window.leuanvetoBridge.setCloud(synced);
          $("save").disabled=!ready;
          refreshImportButton();
          if(!ready) {
            note("Pilvitiedot välimuistista – odotetaan verkkoyhteyttä");
          } else if(!autoImportAttempted) {
            autoImportAttempted=true;
            void autoImportLocal(uid);
          } else if(!importButton.hidden && localStorage.getItem(OWNER_KEY) && localStorage.getItem(OWNER_KEY)!==uid) {
            note("Pilvi synkronoitu · toisen tilin paikalliset sarjat eivät siirry automaattisesti");
          } else {
            note(snapshot.metadata.hasPendingWrites ? "Tallennetaan pilveen…" :
              "Synkronoitu · "+accountLabel(currentUser)+" · tiedot näkyvät kirjautuneilla laitteilla");
          }
        },
        err => { ready=false;$("save").disabled=true;note("Pilven lataus epäonnistui: "+err.message) }
      );
    }, err=>note("Kirjautumisen tarkistus epäonnistui: "+err.message));
    toggle.addEventListener("click",async()=>{
      if(user){
        if(!confirm("Kirjaudutaanko ulos? Pilveen tallennetut harjoitukset säilyvät tililläsi."))return;
        try{await firebaseAuth.signOut(auth)}catch(err){failure("Uloskirjautuminen epäonnistui: "+err.message)}
      }else{ panel.hidden=!panel.hidden;failure("") }
    });
    $("loginForm").addEventListener("submit",async e=>{
      e.preventDefault();failure("");setBusy(true);
      try{
        await firebaseAuth.signInWithEmailAndPassword(auth,getLoginEmail($("loginEmail").value),$("loginPassword").value);
        $("loginPassword").value="";
      }catch(err){failure("Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana. ("+err.code+")")}
      finally{setBusy(false)}
    });
    $("signupButton").addEventListener("click",async()=>{
      if(!$("loginForm").reportValidity())return;
      failure("");setBusy(true);
      try{
        await firebaseAuth.createUserWithEmailAndPassword(auth,getLoginEmail($("loginEmail").value),$("loginPassword").value);
        $("loginPassword").value="";
      }catch(err){failure("Tunnuksen luonti epäonnistui: "+err.code)}
      finally{setBusy(false)}
    });
    $("resetButton").addEventListener("click",async()=>{
      if(!$("loginEmail").checkValidity())return $("loginEmail").reportValidity();
      failure("");setBusy(true);
      try{
        const email=getLoginEmail($("loginEmail").value);
        if(email.endsWith("@"+USERNAME_DOMAIN)) {
          failure("Käyttäjänimitilillä ei ole sähköpostipalautusta. Jos salasana katoaa, emme voi palauttaa sitä automaattisesti.");
          return;
        }
        await firebaseAuth.sendPasswordResetEmail(auth,email);
        failure("Jos osoitteelle on tili, salasanan palautusviesti lähetetään siihen.");
      }catch(err){failure("Palautuspyyntö epäonnistui: "+err.message)}
      finally{setBusy(false)}
    });
    importButton.addEventListener("click",async()=>{
      if(!user||!ready)return;
      const uid=user.uid,entries=localPending(uid);
      if(!entries.length)return;
      const priorOwner=localStorage.getItem(OWNER_KEY);
      const warning=priorOwner && priorOwner!==uid
        ? "HUOMIO: Tämä selaimen harjoitushistoria on aiemmin liitetty toiseen käyttäjätiliin. Haluatko varmasti kopioida "+entries.length+" sarjaa nyt kirjautuneelle tilille?"
        : "Siirretäänkö "+entries.length+" paikallista sarjaa pilveen? Jo tallennetut eri sarjat säilyvät.";
      if(!confirm(warning))return;
      try {
        await window.leuanvetoCloud.import(entries);
        markImported(uid,entries);
        alert("Paikalliset harjoitukset siirretty pilveen.");
      }catch(err){alert("Siirto epäonnistui: "+err.message)}
    });
  } catch(err) {
    toggle.hidden=true;
    note("Pilvipalvelua ei saatu ladattua. Paikallinen tallennus toimii edelleen.");
    console.error("Pilvitallennus:",err);
  }
}
