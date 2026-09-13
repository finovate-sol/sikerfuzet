import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'sikerfuzet-test',
  firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync('../firestore.rules', 'utf8') },
});

const MARK='u-mark', ADAM='u-adam', ZSOLT='u-zsolt', JUNIOR='u-junior', OTHER='u-other', OUT='u-out';
const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const mark  = ctx(MARK,  'szecsimark@gmail.com');   // admin + mindenki felettese
const adam  = ctx(ADAM,  'adam@ovb.hu');            // vezető, Zsolt felettese
const zsolt = ctx(ZSOLT, 'zsolt@ovb.hu');           // munkatárs
const other = ctx(OTHER, 'other@ovb.hu');           // belépő, de senkihez nem tartozik
const junior= ctx(JUNIOR,'junior@ovb.hu');           // Zsolt beosztottja (Ádám a nagyfelettese)
const out   = ctx(OUT,   'idegen@gmail.com');       // NINCS az allowlistán
const anon  = env.unauthenticatedContext().firestore();

// --- alapadatok a szabályok megkerülésével ---
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  for (const e of ['szecsimark@gmail.com','adam@ovb.hu','zsolt@ovb.hu','junior@ovb.hu','other@ovb.hu'])
    await setDoc(doc(d,'allowed_users',e), { added: true });
  // lánc: Junior → Zsolt → Ádám → Márk. Ádám így Juniornak NEM-ADMIN nagyfelettese,
  // Márk pedig a csúcs (ő az admin is).
  await setDoc(doc(d,'config','access'), { [ADAM]: MARK, [ZSOLT]: ADAM, [JUNIOR]: ZSOLT });
  await setDoc(doc(d,'config','app'), { infoDates: [] });
  await setDoc(doc(d,'employees',ADAM), { name:'Siliga Ádám' });
  await setDoc(doc(d,'penzugyek',ZSOLT), { kezdo:{} });
  await setDoc(doc(d,'celok',ZSOLT), { vizio:{y1:'privát'}, goals:[] });
  await setDoc(doc(d,'structures',ZSOLT), { tree:{} });
  await setDoc(doc(d,'karrier_letra',ADAM), { done_base:true });
  await setDoc(doc(d,'havi_terv',`${ZSOLT}_2026_8`), { x:1 });
  await setDoc(doc(d,'eves_terv',`${ADAM}_2026`), { x:1 });
  await setDoc(doc(d,'activity_timers',`${ZSOLT}_10p_2026-09-13`), { seconds:120 });
  await setDoc(doc(d,'clients','c1'), { name:'Ügyfél', ownerUid: ZSOLT });
  await setDoc(doc(d,'kov_quarters','2026_Q3'), { x:1 });
  // Ádám PG-je Zsolttal + a belőle jövő akcióterv
  await setDoc(doc(d,'pg','pg1'),   { type:'szemelyes', leaderUid: ADAM, mtUid: ZSOLT, highlight:'TITKOS JEGYZET' });
  await setDoc(doc(d,'pg','pgm1'),  { type:'szemelyes', leaderUid: MARK, mtUid: ADAM, highlight:'Márk jegyzete' });
  // Zsolt PG-je a beosztottjával – Ádám a nagyfelettes, de NEM admin
  await setDoc(doc(d,'pg','pgz1'),  { type:'szemelyes', leaderUid: ZSOLT, mtUid: JUNIOR, highlight:'Zsolt jegyzete' });
  await setDoc(doc(d,'penzugyek',JUNIOR), { kezdo:{} });
  await setDoc(doc(d,'pg_akcio','ak1'), { mtUid: ZSOLT, leaderUid: ADAM, text:'Eredeti feladat', done:false, taskId:'', updated:'x' });
});

const out_ = [];
const T = async (name, p, expect) => {
  try { await (expect === 'ok' ? assertSucceeds(p) : assertFails(p)); out_.push('✓ ' + name); }
  catch (e) { out_.push('✗ ' + name + '  →  ' + String(e.message).split('\n')[0].slice(0,140)); }
};

// ---------- 1. Belépés-vezérlés ----------
await T('nem belépett user semmit nem lát', getDoc(doc(anon,'clients','c1')), 'fail');
await T('allowlistán KÍVÜLI fiók nem látja az ügyfeleket', getDoc(doc(out,'clients','c1')), 'fail');
await T('allowlistán kívüli fiók nem látja a munkatársakat', getDocs(collection(out,'employees')), 'fail');
await T('bárki lekérdezheti a SAJÁT allowlist-bejegyzését (belépés)', getDoc(doc(out,'allowed_users','idegen@gmail.com')), 'ok');
await T('más email allowlist-bejegyzése nem kérdezhető le', getDoc(doc(out,'allowed_users','adam@ovb.hu')), 'fail');
await T('az allowlistát csak az admin listázhatja', getDocs(collection(adam,'allowed_users')), 'fail');
await T('az admin listázhatja az allowlistát', getDocs(collection(mark,'allowed_users')), 'ok');
await T('az allowlistára csak az admin vehet fel', setDoc(doc(adam,'allowed_users','uj@ovb.hu'),{a:1}), 'fail');
await T('az admin felvehet az allowlistára', setDoc(doc(mark,'allowed_users','uj@ovb.hu'),{a:1}), 'ok');

// ---------- 2. employees / config ----------
await T('munkatárs látja a csapatot', getDocs(collection(zsolt,'employees')), 'ok');
await T('mindenki írja a SAJÁT profilját', setDoc(doc(zsolt,'employees',ZSOLT),{name:'Kovács Zsolt'},{merge:true}), 'ok');
await T('más profilját nem írhatja át', setDoc(doc(zsolt,'employees',ADAM),{name:'hekk'},{merge:true}), 'fail');
await T('mindenki olvassa a config/app-ot', getDoc(doc(zsolt,'config','app')), 'ok');
await T('a config/app-ot csak az admin írja', setDoc(doc(adam,'config','app'),{x:1},{merge:true}), 'fail');
await T('a hozzáférés-térképet csak az admin írja', setDoc(doc(adam,'config','access'),{[MARK]:ADAM}), 'fail');
await T('az admin írja a hozzáférés-térképet', setDoc(doc(mark,'config','access'),{[ADAM]:MARK,[ZSOLT]:ADAM,[JUNIOR]:ZSOLT}), 'ok');

// ---------- 3. Személyes adatok + a felettes-lánc ----------
await T('saját pénzügyeit olvassa', getDoc(doc(zsolt,'penzugyek',ZSOLT)), 'ok');
await T('a KÖZVETLEN felettes olvassa (Ádám → Zsolt)', getDoc(doc(adam,'penzugyek',ZSOLT)), 'ok');
await T('a felettes felettese is olvassa (Márk → Ádám → Zsolt)', getDoc(doc(mark,'penzugyek',ZSOLT)), 'ok');
await T('idegen munkatárs NEM olvassa', getDoc(doc(other,'penzugyek',ZSOLT)), 'fail');
await T('a BEOSZTOTT nem olvassa a felettese pénzügyeit', getDoc(doc(zsolt,'penzugyek',MARK)), 'fail');
await T('a felettes ránézésben szerkeszthet is', setDoc(doc(adam,'structures',ZSOLT),{tree:{a:1}}), 'ok');
await T('célok: saját olvasható', getDoc(doc(zsolt,'celok',ZSOLT)), 'ok');
await T('célok: a felettes is olvassa', getDoc(doc(adam,'celok',ZSOLT)), 'ok');
await T('célok: IDEGEN munkatárs NEM olvassa', getDoc(doc(other,'celok',ZSOLT)), 'fail');
await T('célok: a beosztott nem olvassa a felettesét', getDoc(doc(zsolt,'celok',ADAM)), 'fail');
await T('célok: a felettes ránézésben szerkeszthet', setDoc(doc(adam,'celok',ZSOLT),{vizio:{y1:'x'}},{merge:true}), 'ok');
await T('célok: idegen nem írhat', setDoc(doc(other,'celok',ZSOLT),{vizio:{}},{merge:true}), 'fail');
await T('idegen nem szerkesztheti a struktúrát', setDoc(doc(other,'structures',ZSOLT),{tree:{}}), 'fail');
await T('karrier-létra: saját', setDoc(doc(adam,'karrier_letra',ADAM),{miert:{pozicio:'x'}},{merge:true}), 'ok');
await T('karrier-létra: idegen tiltva', getDoc(doc(other,'karrier_letra',ADAM)), 'fail');
await T('havi terv: a kulcsból jól olvassuk ki a gazdát (felettes)', getDoc(doc(adam,'havi_terv',`${ZSOLT}_2026_8`)), 'ok');
await T('havi terv: idegen tiltva', getDoc(doc(other,'havi_terv',`${ZSOLT}_2026_8`)), 'fail');
await T('éves terv: saját', getDoc(doc(adam,'eves_terv',`${ADAM}_2026`)), 'ok');
await T('éves terv: beosztott nem látja a felettesét', getDoc(doc(zsolt,'eves_terv',`${ADAM}_2026`)), 'fail');
await T('számláló: a felettes olvassa', getDoc(doc(adam,'activity_timers',`${ZSOLT}_10p_2026-09-13`)), 'ok');
await T('számláló: más nevében nem írható', setDoc(doc(adam,'activity_timers',`${ZSOLT}_10p_2026-09-14`),{seconds:1}), 'fail');
await T('számláló: sajátot ír', setDoc(doc(zsolt,'activity_timers',`${ZSOLT}_10p_2026-09-14`),{seconds:1}), 'ok');

// ---------- 4. Csapatszintű ----------
await T('ügyféllista: teljes listázás minden munkatársnak megy', getDocs(collection(zsolt,'clients')), 'ok');
await T('ügyfél: a gazdája írja', setDoc(doc(zsolt,'clients','c1'),{name:'Új név'},{merge:true}), 'ok');
await T('ügyfél: idegen nem írja', setDoc(doc(other,'clients','c1'),{name:'hekk'},{merge:true}), 'fail');
await T('ügyfél: a felettes írja', setDoc(doc(adam,'clients','c1'),{name:'Vezető átírta'},{merge:true}), 'ok');
await T('ügyfél: átadás a csapaton belül megy', setDoc(doc(adam,'clients','c1'),{ownerUid:ADAM},{merge:true}), 'ok');
await T('ügyfél: kívülre nem adható át', setDoc(doc(adam,'clients','c1'),{ownerUid:OTHER},{merge:true}), 'fail');
await T('ügyfél: idegen nevére nem hozható létre', setDoc(doc(zsolt,'clients','c9'),{ownerUid:OTHER}), 'fail');
await T('ügyfél: sajátot létrehoz', setDoc(doc(zsolt,'clients','c9'),{ownerUid:ZSOLT}), 'ok');
await T('Ki lesz a következő: közös', setDoc(doc(zsolt,'kov_quarters','2026_Q3'),{x:2},{merge:true}), 'ok');

// ---------- 5. PG: a jegyzet a vezetőé ----------
await T('A MUNKATÁRS NEM OLVASHATJA A RÓLA SZÓLÓ PG-JEGYZETET', getDoc(doc(zsolt,'pg','pg1')), 'fail');
await T('a PG-t a vezetője olvassa', getDoc(doc(adam,'pg','pg1')), 'ok');
await T('idegen vezető sem olvassa', getDoc(doc(other,'pg','pg1')), 'fail');
await T('a nem-admin nagyfelettes SEM olvassa más PG-jegyzetét', getDoc(doc(adam,'pg','pgz1')), 'fail');
await T('a nagyfelettes viszont a pénzügyeket látja (2 szint mélyen is)', getDoc(doc(adam,'penzugyek',JUNIOR)), 'ok');
await T('az admin mindent lát (a saját Firebase-projektje)', getDoc(doc(mark,'pg','pg1')), 'ok');
await T('szűrt listázás (leaderUid) megy', getDocs(query(collection(adam,'pg'), where('leaderUid','==',ADAM))), 'ok');
await T('SZŰRETLEN listázás tiltott', getDocs(collection(adam,'pg')), 'fail');
await T('más nevére nem hozható létre PG', setDoc(doc(zsolt,'pg','pgX'),{leaderUid:ADAM,mtUid:ZSOLT}), 'fail');
await T('saját nevére létrehozható', setDoc(doc(adam,'pg','pgX'),{leaderUid:ADAM,mtUid:ZSOLT}), 'ok');
await T('a munkatárs nem törölheti a róla szóló PG-t', deleteDoc(doc(zsolt,'pg','pg1')), 'fail');

// ---------- 6. Akciótervek ----------
await T('a munkatárs látja a rá bízott akciótervet', getDoc(doc(zsolt,'pg_akcio','ak1')), 'ok');
await T('a kiadó vezető is látja', getDoc(doc(adam,'pg_akcio','ak1')), 'ok');
await T('idegen nem látja', getDoc(doc(other,'pg_akcio','ak1')), 'fail');
await T('szűrt listázás mtUid-ra megy', getDocs(query(collection(zsolt,'pg_akcio'), where('mtUid','==',ZSOLT))), 'ok');
await T('szűrt listázás leaderUid-ra megy', getDocs(query(collection(adam,'pg_akcio'), where('leaderUid','==',ADAM))), 'ok');
await T('szűretlen listázás tiltott', getDocs(collection(zsolt,'pg_akcio')), 'fail');
await T('a munkatárs pipálhat', updateDoc(doc(zsolt,'pg_akcio','ak1'),{done:true,doneAt:'2026-09-13',updated:'y'}), 'ok');
await T('a munkatárs beírhatja a Google Task azonosítót', updateDoc(doc(zsolt,'pg_akcio','ak1'),{taskId:'gt1',updated:'z'}), 'ok');
await T('A MUNKATÁRS NEM ÍRHATJA ÁT A FELADAT SZÖVEGÉT', updateDoc(doc(zsolt,'pg_akcio','ak1'),{text:'átírva'}), 'fail');
await T('a munkatárs nem írhatja át a határidőt', updateDoc(doc(zsolt,'pg_akcio','ak1'),{due:'2030-01-01'}), 'fail');
await T('a vezető bármit átírhat', updateDoc(doc(adam,'pg_akcio','ak1'),{text:'új szöveg',due:'2026-10-01'}), 'ok');
await T('a munkatárs nem törölheti a rá bízott feladatot', deleteDoc(doc(zsolt,'pg_akcio','ak1')), 'fail');
await T('a vezető törölheti', deleteDoc(doc(adam,'pg_akcio','ak1')), 'ok');
await T('saját akcióterv felvétele (Csendes PG)', setDoc(doc(zsolt,'pg_akcio','ak9'),{mtUid:ZSOLT,leaderUid:ZSOLT,text:'sajat'}), 'ok');
await T('más nevében nem adható ki akcióterv', setDoc(doc(zsolt,'pg_akcio','ak8'),{mtUid:ADAM,leaderUid:ADAM,text:'hamis'}), 'fail');

// ---------- 7. ismeretlen kollekció ----------
await T('ismeretlen kollekció tiltott', setDoc(doc(mark,'valami_mas','x'),{a:1}), 'fail');

await env.cleanup();
console.log(out_.join('\n'));
const bad = out_.filter(l => l.startsWith('✗'));
console.log(`\n${out_.length - bad.length}/${out_.length} teszt zöld` + (bad.length ? ' — BUKÓ VAN' : ''));
process.exit(bad.length ? 1 : 0);
