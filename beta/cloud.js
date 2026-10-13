import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const badge = $("cloudBadge"), status = $("cloudStatus"), toggle = $("authToggle");
const panel = $("authPanel"), errorBox = $("authError"), importButton = $("cloudImport");
let user = null, ready = false, stopListening = null, auth, db, firestore;
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
  importButton.hidden = !active || window.leuanvetoBridge.getLocal().length === 0;
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
      user=currentUser;ready=false;
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
          ready=true;
          window.leuanvetoBridge.setCloud(synced);
          $("save").disabled=false;
          note(!navigator.onLine || snapshot.metadata.fromCache ? "Ei verkkoyhteyttä – pilvitietojen välimuisti" :
            snapshot.metadata.hasPendingWrites ? "Tallennetaan pilveen…" : "Synkronoitu · tietosi näkyvät kaikilla kirjautuneilla laitteillasi");
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
        await firebaseAuth.signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);
        $("loginPassword").value="";
      }catch(err){failure("Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana. ("+err.code+")")}
      finally{setBusy(false)}
    });
    $("signupButton").addEventListener("click",async()=>{
      if(!$("loginForm").reportValidity())return;
      failure("");setBusy(true);
      try{
        await firebaseAuth.createUserWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);
        $("loginPassword").value="";
      }catch(err){failure("Tunnuksen luonti epäonnistui: "+err.code)}
      finally{setBusy(false)}
    });
    $("resetButton").addEventListener("click",async()=>{
      if(!$("loginEmail").checkValidity())return $("loginEmail").reportValidity();
      failure("");setBusy(true);
      try{
        await firebaseAuth.sendPasswordResetEmail(auth,$("loginEmail").value.trim());
        failure("Jos osoitteelle on tili, salasanan palautusviesti lähetetään siihen.");
      }catch(err){failure("Palautuspyyntö epäonnistui: "+err.code)}
      finally{setBusy(false)}
    });
    importButton.addEventListener("click",async()=>{
      const entries=window.leuanvetoBridge.getLocal();
      if(!entries.length)return;
      if(!confirm("Siirretäänkö tämän selaimen "+entries.length+" sarjaa pilveen? Pilvessä jo olevia eri sarjoja ei poisteta, eikä paikallista kopiota hävitetä."))return;
      try{await window.leuanvetoCloud.import(entries);alert("Paikalliset harjoitukset siirretty pilveen.")}catch(err){alert("Siirto epäonnistui: "+err.message)}
    });
  } catch(err) {
    toggle.hidden=true;
    note("Pilvipalvelua ei saatu ladattua. Paikallinen tallennus toimii edelleen.");
    console.error("Pilvitallennus:",err);
  }
}
