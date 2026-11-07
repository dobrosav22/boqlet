import { DEPLOYED, MAX_UPLOAD_MB } from "../api";
import { Section, SAMPLE_MODEL, type ContentProps } from "./guideParts";

/**
 * The guide in Serbian (Latin script). Same sections and ids as guideEn.tsx; keep the two in step.
 * Everything the app shows on screen (buttons, tabs, preset names, hints) is quoted in English, as it appears.
 */
export function GuideSr({ onOpenBoq, onLoadSample }: ContentProps) {
  const sample = (
    <>
      <button className="link" onClick={onLoadSample}>
        Učitajte primer modela
      </button>{" "}
      (dvoetažna kuća u nizu, ista na kojoj se alat testira) ili ga{" "}
      <a href={SAMPLE_MODEL.url} download={SAMPLE_MODEL.fileName}>
        preuzmite
      </a>{" "}
      i ubacite sami
    </>
  );

  return (
    <>
      <header className="guide-intro">
        <h1>Kako se koristi IFC to BoQ</h1>
        <p className="guide-lede">
          Ovaj alat od modela zgrade (IFC fajla) pravi predmer radova (eng. <i>bill of quantities</i>, BoQ). Vi birate kako
          se meri, kako se pozicije šifriraju i grupišu i kako se čitaju nazivi u modelu. Svaki broj može da se isprati
          unazad, do formule i elemenata od kojih je nastao.
        </p>
        <p className="muted">
          Namenjeno inženjerima koji su predmere radili ručno, sa crteža. Nije potrebno nikakvo znanje o IFC-u ili BIM-u.
          Čitanje traje oko 15 minuta. Natpisi na ekranu su na engleskom i ovde su navedeni tačno onako kako ih vidite.
          Svaki naslov ima link <b>#</b> koji možete kopirati i nekome poslati samo taj deo.
        </p>
      </header>

      <Section id="guide-short" title="Ukratko">
        <ol className="guide-steps">
          <li>
            Prevucite svoj IFC fajl u polje gore levo. Pogledajte karticu koja se pojavi: da li model sadrži ono što
            očekujete? Nemate fajl pri ruci? {sample}.
          </li>
          <li>
            Ostavite podrazumevana podešavanja: <b>As modelled</b> pod Rules, <b>ACME cost codes</b> pod Classification,{" "}
            <b>Global seed dictionary</b> pod Dictionaries.
          </li>
          <li>
            Pritisnite <b>Generate BoQ</b>.
          </li>
          <li>
            Ako piše <b>Needs input</b>, odgovorite na pitanja i pritisnite <b>Apply answers and regenerate</b>.
          </li>
          <li>
            <b>Kliknite na pozicije</b> da vidite formulu i elemente iza svakog broja. U <b>3D view</b> vidite šta je
            izmereno, a šta je ostalo van predmera.
          </li>
          <li>
            Pritisnite <b>Download Excel</b> i upišite jedinične cene.
          </li>
          <li>
            Kasnije, u delu <b>Library</b>, prilagodite pravila i šifre svojoj praksi.
          </li>
        </ol>
        <p>Ostatak uputstva objašnjava svaki korak i svaku reč koju ćete videti na ekranu.</p>
      </Section>

      <Section id="guide-idea" title="Osnovna ideja, rečima koje već znate">
        <p>Kada ste ručno radili predmer, obavljali ste tri odvojena posla, možda i ne razmišljajući o njima kao odvojenim:</p>
        <ol>
          <li>
            <b>Merili ste</b> sa crteža: dužine zidova, površine ploča, broj vrata. Pratili ste pravila obračuna: „otvori
            veći od 0,5 m² se odbijaju", „“, „“.
          </li>
          <li>
            <b>Šifrirali ste i grupisali</b> pozicije u grupe radova („“, „Betonski i armiranobetonski
            radovi") sa brojevima pozicija.
          </li>
          <li>
            <b>Čitali ste oznake</b> na crtežima i znali šta znače: „“ je beton, „“ je zid od blokova 25 cm u vašoj
            kancelariji. To ste znali iz iskustva.
          </li>
        </ol>
        <p>
          Alat radi ista tri posla, ali nad IFC fajlom umesto nad crtežima, i drži ih odvojeno, pa jedan možete da menjate
          a da ne dirate ostala dva:
        </p>
        <div className="guide-table">
          <table>
            <thead>
              <tr>
                <th>Šta ste radili ručno</th>
                <th>Kako se to zove u alatu</th>
                <th>Da li menja brojeve?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pravila obračuna</td>
                <td>
                  <b>Rules</b> (skup pravila, <i>rule set</i>)
                </td>
                <td>
                  <b>Da</b>
                </td>
              </tr>
              <tr>
                <td>Grupe radova i brojevi pozicija</td>
                <td>
                  <b>Classification</b>
                </td>
                <td>
                  <b>Nikada.</b> Samo označava i sortira pozicije.
                </td>
              </tr>
              <tr>
                <td>Znanje šta oznake znače</td>
                <td>
                  <b>Dictionary</b> (rečnik)
                </td>
                <td>Samo posredno, tako što pravilima kaže šta je nešto</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Zapamtite ovu tabelu. Sve ostalo na ekranu se oslanja na nju.</p>
      </Section>

      <Section id="guide-ifc" title="Šta je IFC fajl">
        <p>
          IFC fajl nije crtež. To je <b>spisak objekata zgrade</b> (alat ih zove <i>elementi</i>), izvezen iz programa za
          modelovanje kao što su Revit, ArchiCAD, Tekla ili Allplan. Svaki element zna:
        </p>
        <ul>
          <li>
            <b>koja je vrsta stvari</b>, tj. svoju <i>IFC klasu</i>: IfcWall (zid), IfcSlab (ploča), IfcDoor (vrata),
            IfcWindow (prozor), IfcSpace (prostorija) i tako dalje. To je jedini deo koji svi programi zapisuju na isti
            način;
          </li>
          <li>
            <b>svoj oblik</b>, tj. 3D geometriju;
          </li>
          <li>
            <b>svoj naziv i tip</b>, slobodan tekst koji je upisao onaj ko je modelovao, na primer „Exterior - Brick on
            Block";
          </li>
          <li>
            <b>svoj materijal</b>, takođe slobodan tekst;
          </li>
          <li>
            često i <b>količine koje je program za modelovanje već izračunao</b> (dužinu, površinu, zapreminu). One mogu biti
            pogrešne, pa ih alat proverava prema geometriji;
          </li>
          <li>
            <b>na kojoj je etaži</b>.
          </li>
        </ul>
        <p>
          Alat čita taj spisak, proverava brojeve i na njega primenjuje vaša pravila obračuna. Pravila ne može da pogodi iz
          fajla: IFC fajl sadrži geometriju i svojstva, a ne pravila obračuna. Zato ih vi birate.
        </p>
      </Section>

      <Section id="guide-file" title="Korak 1: učitajte IFC fajl">
        <p>
          Gore levo, ispod dugmadi <b>Bill of quantities | Library | Guide</b>, nalazi se polje sa natpisom{" "}
          <b>Drop an IFC file here</b>. Prevucite .ifc fajl na njega, ili kliknite i izaberite fajl.
          {MAX_UPLOAD_MB > 0 && <> Ovaj online demo prima fajlove do {MAX_UPLOAD_MB.toString().replace(".", ",")} MB.</>}
        </p>
        <p>
          Dok otvara svaki element i proverava njegovu geometriju, piše <b>Reading …</b>. Mala kuća traje nekoliko sekundi,
          velika zgrada nekoliko minuta. Nemate svoj fajl? {sample}.
        </p>
        <p>Kada završi, ispod polja se pojavi kartica. Pročitajte je: ona vam govori da li je fajl uopšte upotrebljiv.</p>
        <dl className="guide-dl">
          <dt>Schema</dt>
          <dd>Verzija IFC-a (IFC2X3, IFC4…). Možete je zanemariti.</dd>
          <dt>Made with</dt>
          <dd>Iz kog programa je fajl izvezen.</dd>
          <dt>Contents</dt>
          <dd>
            Broj elemenata (elements), otvora (openings) i prostorija (spaces). <i>Otvori</i> su rupe za vrata i prozore.{" "}
            <i>Spaces</i> su prostorije: ako ih je 0, završni radovi po prostorijama (podne pločice po sobi, sokla) ne mogu
            da se izmere.
          </dd>
          <dt>Storeys</dt>
          <dd>Etaže koje fajl ima.</dd>
          <dt>Sive oznake</dt>
          <dd>
            Brz pregled šta je unutra, na primer „“. Ako ste očekivali zidove a ne vidite
            nijedan, problem je u fajlu, ne u alatu.
          </dd>
        </dl>
      </Section>

      <Section id="guide-choose" title="Korak 2: izaberite pravila, klasifikaciju i rečnike">
        <p>Ispod kartice fajla su tri polja, ista kao u tabeli iznad. Za prvi put ne menjajte ništa.</p>

        <h3>Rules (birate jedno)</h3>
        <p>Napomena kaže „“ (Kako se količine mere. Menja brojeve.)</p>
        <ul>
          <li>
            <b>As modelled (master template)</b>: neutralna pravila. Meri sve onako kako je u modelu i ne pravi izbore
            vezane za neku zemlju. Počnite sa ovim.
          </li>
          <li>
            Ostali (<b>Standard-style example</b>, <b>ACME Ltd house rules</b>, dva <b>Demo</b> skupa) su primeri koji
            pokazuju kako drugačija pravila daju drugačije brojeve iz istog fajla. „“ znači „isto kao taj skup, sa
            nekoliko promenjenih odgovora", kao što su interna pravila neke firme „“.
          </li>
        </ul>

        <h3>Classification (štiklirate jednu ili više)</h3>
        <p>
          Napomena kaže „“ (Šifre i
          grupisanje. Nikada ne menja brojeve. Prva štiklirana grupiše predmer.)
        </p>
        <ul>
          <li>
            <b>ACME cost codes</b>: primer šifarnika jedne firme (štiklirano unapred).
          </li>
          <li>
            <b>Demo: trade sections</b>: grupe po vrstama radova (zidarski, betonski, tesarski…), kako se tenderi često
            grupišu.
          </li>
          <li>
            <b>Uniclass 2015</b>: zvaničan sistem klasifikacije. Može biti posivljen ako njegov šifarnik nije instaliran.
          </li>
        </ul>
        <p>Ako štiklirate više njih, svaka pozicija dobija šifru iz svake. Predmer na ekranu je grupisan po prvoj štikliranoj.</p>

        <h3>Dictionaries (štiklirate jedan ili više)</h3>
        <p>Napomena kaže „“ (kako se razumeju nazivi u modelu). Svaki rečnik ima nivo (layer):</p>
        <ul>
          <li>
            <b>global</b>: nazivi koje svi koriste, na primer podrazumevani nazivi materijala u uobičajenim programima za
            modelovanje. <b>Global seed dictionary</b> je štikliran unapred; ostavite ga uključenog.
          </li>
          <li>
            <b>company</b>: nazivi i skraćenice jedne kancelarije.
          </li>
          <li>
            <b>project</b>: nazivi koji nešto znače samo u jednom projektu.
          </li>
        </ul>
        <p>Kada se dva rečnika ne slažu, pobeđuje konkretniji: project pre company, company pre global.</p>
      </Section>

      <Section id="guide-generate" title="Korak 3: napravite predmer">
        <p>
          Pritisnite <b>Generate BoQ</b> na dnu leve kolone. Posle nekoliko sekundi desna strana se popuni predmerom.
          {DEPLOYED && <> Prvo pokretanje posle pauze može da traje 20 do 40 sekundi, dok se online mašina ne pokrene.</>}
        </p>
      </Section>

      <Section id="guide-sheet" title="Čitanje predmera">
        <h3>Zaglavlje</h3>
        <ul>
          <li>
            <b>Naziv fajla</b> i red poput „“ (64 pozicije
            od 180 od ukupno 195 elemenata). Govori koja su pravila i šifre korišćeni i koliko je elemenata ušlo u predmer.
            Ovde 15 nije izmereno; kartica Questions kaže zašto.
          </li>
          <li>
            <b>Oznaka statusa</b>. <b>Complete</b>: ništa ne čeka na vas. <b>Needs input: N questions</b>: alat je naišao na
            nešto što ne može sam da odluči. Ne pogađa, nego pita (vidi Pitanja niže).
          </li>
          <li>
            Dugmad: <b>3D view</b>, <b>Pin for comparison</b>, <b>Download Excel</b>.
          </li>
        </ul>

        <h3>Predmer</h3>
        <p>Izgleda kao klasičan obrazac predmera: Ref | Description | Quantity | Unit (šifra, opis, količina, jedinica mere).</p>
        <ul>
          <li>
            <b>Podebljani redovi</b> su naslovi grupa iz klasifikacije, na primer „“.
          </li>
          <li>
            <b>Obični redovi</b> su pozicije predmera: Ref (šifra), Description (opis), Quantity (količina), Unit (jedinica).
          </li>
          <li>
            Mala oznaka <i>derived</i> znači da broj nije u modelu, već je izračunat iz drugih pozicija: oplata iz površina
            betona, armatura iz zapremine betona × kg/m³. Isto ono iskustveno pravilo koje ste i sami koristili, samo što je
            ovde koeficijent prikazan i može da se menja.
          </li>
          <li>
            Mala oznaka <i>manual</i> znači poziciju iza koje u modelu nema ničega: organizacija gradilišta, skela,
            paušalna stavka. Nju popunjavate vi.
          </li>
          <li>
            <b>„“</b> umesto broja: pozicija postoji, ali nedostaje neka vrednost. Alat nikada ne izbacuje
            poziciju bez traga, jer je pozicija koja nedostaje najgora greška u predmeru. Ostaje vidljiva, sa razlogom.
          </li>
        </ul>

        <h3>Kliknite na poziciju</h3>
        <p>To je najvažnija navika. Otvorena pozicija pokazuje:</p>
        <ul>
          <li>
            <b>Formula</b>: tačno kako je broj dobijen, na primer površina obe strane zida minus otvori veći od 0,5 m².
          </li>
          <li>
            <b>Parameters used</b>: vrednosti iz pravila koje su ušle u račun (granica za odbijanje otvora, koeficijent).
          </li>
          <li>
            <b>Codes</b>: koju šifru je pozicija dobila iz svake klasifikacije i zašto.
          </li>
          <li>
            <b>Tabelu svih elemenata koji su doprineli</b>: svaki zid ili vrata, njegova količina i napomena kako je
            izmeren (na primer „“).
          </li>
          <li>
            <b>Show this line in the calculation log</b>: cela priča ove pozicije.
          </li>
        </ul>
        <p>
          Ta tabela je vaša dokaznica mera. Svaki broj možete da proverite do elemenata, kao što biste štiklirali meru na
          crtežu.
        </p>
      </Section>

      <Section id="guide-3d" title="3D prikaz">
        <p>
          Kada je <b>3D view</b> uključen, model stoji desno od predmera.
        </p>
        <ul>
          <li>Kliknite na poziciju: njeni elementi zasvetle u modelu.</li>
          <li>Kliknite na element u modelu: vidite u kojim je pozicijama, ili piše „“ (nije ni u jednoj).</li>
          <li>
            <b>Colour by what the BoQ covers</b> (lista na vrhu prikaza) je opcija za proveru: na prvi pogled vidite šta je
            izmereno, a šta je ostalo van predmera. <b>Colour by code group</b> boji po grupama radova.
          </li>
          <li>
            Miš: prevlačenje okreće model, točkić zumira, prevlačenje desnim tasterom pomera. <b>Fit all</b> vraća ceo model
            u kadar. Štiklirajte <b>Rooms</b> da vidite prostorije.
          </li>
        </ul>
      </Section>

      <Section id="guide-log" title="Dnevnik proračuna i ulazni podaci">
        <p>
          <b>Calculation log</b> je numerisan dnevnik svega što je alat uradio, redom: čitanje fajla, razumevanje naziva,
          merenje, povezivanje sa pravilima, izvedene pozicije, šifre, vaši odgovori. Oznake na vrhu filtriraju po fazi, a
          polje za pretragu nalazi element, pravilo ili reč. Retko ćete ga čitati od početka do kraja. Ovde dolazite kada
          vam neki broj izgleda čudno i želite da znate zašto.
        </p>
        <p>
          <b>Inputs</b> pokazuje koja su pravila korišćena i vrednost svakog njihovog podešavanja (alat ih zove{" "}
          <i>slots</i>), na primer „“. To je ona strana „“ koju biste stavili
          na početak predmera.
        </p>
      </Section>

      <Section id="guide-questions" title="Pitanja: alat vas pita, kao mlađi kolega">
        <p>
          Ako oznaka kaže <b>Needs input</b>, kartica <b>Questions</b> se sama otvori. Svako pitanje je ili{" "}
          <b>Blocking</b> (mora da se odgovori da bi predmer bio potpun) ili <b>Optional</b> (govori šta je ostalo van
          predmera; možete ga zanemariti).
        </p>
        <div className="guide-table">
          <table>
            <thead>
              <tr>
                <th>Na ekranu</th>
                <th>Šta znači</th>
                <th>Šta odgovarate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>unknown name</td>
                <td>„“</td>
                <td>Izaberete značenje sa liste (beton, opeka, gips-karton…)</td>
              </tr>
              <tr>
                <td>unmatched</td>
                <td>„“</td>
                <td>Izaberete pravilo po kome se meri, ili Exclude from the BoQ (izostavi iz predmera)</td>
              </tr>
              <tr>
                <td>missing data</td>
                <td>„“</td>
                <td>Upišete broj</td>
              </tr>
              <tr>
                <td>unclassified</td>
                <td>„“</td>
                <td>Izaberete šifru sa liste</td>
              </tr>
              <tr>
                <td>contradiction</td>
                <td>„“, na primer prijavljena površina nije ona koju daje geometrija</td>
                <td>Izaberete čemu verujete</td>
              </tr>
              <tr>
                <td>double claim, overlap</td>
                <td>„“</td>
                <td>Izaberete jedno, da se ne računa dvaput</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Popunite šta možete i pritisnite <b>Apply answers and regenerate</b>. Predmer se ponovo izračuna sa vašim
          odgovorima.
        </p>
        <p>
          Odgovori ostaju primenjeni: leva kolona tada kaže „“, sa linkom <b>Clear</b> (obriši).
          Pitanja se prepoznaju po sadržaju, pa revidirani model pita samo za ono što je novo.
          {DEPLOYED && <> U ovom online demu odgovori se gube kada osvežite stranicu.</>}
        </p>
      </Section>

      <Section id="guide-excel" title="Preuzimanje u Excel">
        <p>
          <b>Download Excel</b> daje radnu svesku sa ovim listovima:
        </p>
        <ul>
          <li>
            <b>BoQ</b>: Ref, Description, Unit, Quantity, Rate (žuta kolona za jedinične cene), Amount (iznos), sa
            međuzbirom po grupi i ukupnim zbirom. Iznosi i zbirovi su Excel formule, pa upisivanjem cena dobijate predračun.
            Žuti redovi su oni sa „“.
          </li>
          <li>
            <b>Calculation</b>: svaka pozicija sa formulom, a ispod nje svaki element sa svojom količinom. Vaša dokaznica
            mera, za proveru ili za revizora.
          </li>
          <li>
            <b>Lines</b>, <b>Log</b>, <b>Questions</b>, <b>Inputs</b>: isto što i kartice na ekranu. Lines ima kolonu za
            svaku štikliranu klasifikaciju.
          </li>
        </ul>
      </Section>

      <Section id="guide-compare" title="Poređenje dva predmera">
        <p>Ovde se vidi čemu alat služi.</p>
        <ol className="guide-steps">
          <li>
            Dok je predmer na ekranu, pritisnite <b>Pin for comparison</b>. Alat zadrži kopiju trenutnog predmera.
          </li>
          <li>
            Levo izaberite drugi skup pravila, na primer <b>Standard-style example</b>.
          </li>
          <li>
            Pritisnite <b>Generate BoQ</b>.
          </li>
          <li>
            Otvorite karticu <b>Compare</b>: zadržani i trenutni predmer jedan pored drugog, sa zbirovima u m², m³, t i m.
          </li>
        </ol>
        <p>
          Isti fajl, druga pravila, drugi brojevi: ono što vidite kada dva predmerivača mere iste crteže. Zatim promenite
          samo klasifikaciju i ponovo uporedite. Brojevi ostaju isti; pomeraju se samo grupe.
        </p>
      </Section>

      <Section id="guide-federation" title="Više modela: arhitektura, konstrukcija, instalacije">
        <p>
          Pravi projekti dolaze kao više IFC fajlova, po jedan za svaku struku. Drugi fajl prevucite u isto polje (sada piše
          „“). Svaki fajl dobija polje za štikliranje (uključen ili ne) i <b>Discipline</b> (struku):
          architecture (arhitektura), structure (konstrukcija) ili mep (mašinske, elektro i vodovodne instalacije).
        </p>
        <p>
          Alat ih spaja u jedan predmer. Svaki element se uzima iz struke kojoj pripada: betonski stub iz modela
          konstrukcije, a ne iz arhitektove kopije. Isti element u dva fajla se računa jednom, a sve što alat ne može da
          odluči postaje pitanje.
        </p>
      </Section>

      <Section id="guide-library" title="Library: da meri na vaš način">
        <p>
          <b>Library</b> (gore levo) je mesto gde tri stvari iz tabele na početku podešavate prema svojoj praksi. Za prvi
          put vam ne treba.
        </p>
        <h3>Skupovi pravila (rule sets)</h3>
        <p>
          Nikada ne počinjete od nule. <b>+ New rule set</b>, ostavite „“ i <b>As modelled</b>,
          pa <b>Create draft</b>. Kartica <b>Settings</b> je tada spisak pitanja na koja odgovaraju pravila obračuna,
          grupisan po oblastima, na primer:
        </p>
        <ul>
          <li>Koji otvori (prozori, vrata, prodori) se odbijaju od zidova? Koja je granična veličina?</li>
          <li>U kojoj jedinici se mere zidovi?</li>
          <li>Da li se oplata obračunava kao posebna pozicija? Kako se računa?</li>
          <li>Da li se meri iskop za temelje? Sa koliko radnog prostora?</li>
          <li>Kada model nema armaturu, da li se ona procenjuje iz zapremine betona?</li>
          <li>Da li želite posebne pozicije za svaku etažu?</li>
        </ul>
        <p>
          (Na ekranu su ova pitanja na engleskom.) Odgovorite onako kako kažu vaša pravila; promenjen odgovor dobija oznaku{" "}
          <b>your answer</b>. Zatim <b>Check</b> (mašina kaže da li prihvata pravila), <b>Save</b>, vratite se na{" "}
          <b>Bill of quantities</b>, izaberite svoja pravila i napravite predmer. Formule prikazuju čitljive nazive u
          uglastim zagradama, na primer [Length] × [Height]; dugme <b>Names</b> izlistava sve što formula može da koristi.
        </p>
        <p>
          Kartica <b>BoQ items</b> služi kada nijedno pitanje ne pokriva ono što vam treba: nova pozicija merena iz modela,
          izračunata iz drugih pozicija, ili uneta ručno („“).
        </p>
        <h3>Klasifikacije</h3>
        <p>
          <b>+ New classification</b>. Na kartici <b>Code list</b> uvezite svoje šifre iz Excela ili CSV-a. Na kartici{" "}
          <b>Codes per line</b> izaberite šifru za svaku vrstu pozicije („“). <b>Suggest codes</b> predlaže
          poklapanja koja vi prihvatate. Red može da se podeli, pa spoljni zidovi dobijaju jednu šifru, a unutrašnji drugu.
        </p>
        <h3>Rečnici</h3>
        <p>
          Otvorite rečnik. Kartica <b>Names in the model</b> izlistava svaki naziv materijala i tipa u učitanom fajlu i šta
          alat misli da on znači. Tu ga naučite nazivima vaše kancelarije, u rečniku nivoa company, nikako u globalnom, da
          vaše navike ne utiču na druge.
        </p>
        <p className="muted">
          Isporučena podešavanja se nikada ne prepisuju: ako jedno promenite, <b>Save as new…</b> čuva kopiju pod vašim
          nazivom.
          {DEPLOYED && <> U ovom online demu sačuvano je privremeno; preko <b>Download JSON</b> sačuvajte svoj rad.</>}
        </p>
      </Section>

      <Section id="guide-trust" title="Pre nego što mu poverujete na pravom poslu">
        <ul>
          <li>
            Skupovi pravila i šifarnici isporučeni ovde su <b>ilustrativni primeri, a ne pravi nacionalni standardi</b>.
            Licencirani standardi ne smeju da se uključe. Za pravi tender napravite svoja pravila u delu Library.
          </li>
          <li>
            Brojevi su detaljno provereni prema ručno rađenom predmeru za primer Duplex (poklapaju se tačno) i prema test
            fajlovima organizacije buildingSMART. Oko 300 drugih javnih fajlova prolazi bez grešaka, ali njihove količine
            niko nije ručno proverio. Na svom fajlu <b>proverite nekoliko pozicija</b> klikom na njih, kao što biste
            proverili tuđu dokaznicu mera.
          </li>
          <li>
            Alat može da izmeri samo ono što je modelovano. Ako modelar nije modelovao soklu, alat je neće izmisliti:
            označiće je, upotrebiće iskustveno pravilo koje vi izaberete, ili će je prepustiti ručnoj poziciji.
          </li>
        </ul>
      </Section>

      {DEPLOYED && (
        <Section id="guide-demo" title="O ovom online demu">
          <ul>
            <li>
              IFC fajlovi do {(MAX_UPLOAD_MB || 4.4).toString().replace(".", ",")} MB. Za veće modele aplikacija mora da se
              pokrene na vašem računaru.
            </li>
            <li>Prvi zahtev posle pauze je spor (20 do 40 sekundi) dok se mašina ne pokrene. Sledeći traju nekoliko sekundi.</li>
            <li>Odgovori na pitanja se gube kada osvežite stranicu.</li>
            <li>
              Ono što sačuvate u delu Library je privremeno. Preuzmite ono što želite da zadržite: predmer u Excelu, ili
              Download JSON za pravila, klasifikaciju ili rečnik.
            </li>
            <li>Uniclass nije dostupan online.</li>
          </ul>
        </Section>
      )}

      <Section id="guide-words" title="Pojmovi sa ekrana">
        <dl className="guide-dl">
          <dt>BoQ</dt>
          <dd>Bill of quantities, predmer radova.</dd>
          <dt>IFC</dt>
          <dd>Otvoren format fajla za modele zgrada, koji čitaju svi veći programi za modelovanje.</dd>
          <dt>Element</dt>
          <dd>Jedan objekat u modelu: zid, vrata, ploča, cev.</dd>
          <dt>IFC klasa</dt>
          <dd>Vrsta elementa (IfcWall, IfcDoor…). Alat je prikazuje bez „“.</dd>
          <dt>Type</dt>
          <dd>Modelarev naziv za grupu istih elemenata, na primer „“.</dd>
          <dt>Space</dt>
          <dd>Prostorija u modelu. Potrebna za završne radove merene po prostorijama.</dd>
          <dt>Storey</dt>
          <dd>Etaža.</dd>
          <dt>Rule set</dt>
          <dd>Vaša pravila obračuna, zapisana kao podaci: koji elementi postaju koje pozicije, u kojoj jedinici, šta se odbija.</dd>
          <dt>Slot</dt>
          <dd>Jedno podešavanje u skupu pravila, na primer granica za odbijanje otvora ili koeficijent oplate.</dd>
          <dt>Classification</dt>
          <dd>Šifarnik i pravila koja kažu koja pozicija dobija koju šifru. Nikada ne menja količinu.</dd>
          <dt>Dictionary</dt>
          <dd>Rečnik: kaže šta znače slobodno upisani nazivi u modelima, na nivoima global, company i project.</dd>
          <dt>Derived</dt>
          <dd>Količina izračunata iz drugih pozicija (oplata, procena armature), sa prikazanom formulom.</dd>
          <dt>Manual</dt>
          <dd>Pozicija iza koje u modelu nema ničega: pripremni radovi, nepredviđeni radovi, paušalne stavke.</dd>
          <dt>To confirm</dt>
          <dd>Pozicija čija količina nije mogla da se odredi. Ostaje u predmeru, sa razlogom.</dd>
          <dt>Federation</dt>
          <dd>Spajanje više modela jednog projekta (arhitektura, konstrukcija, instalacije) u jedan predmer.</dd>
        </dl>
        <p>
          <button className="button" onClick={onOpenBoq}>
            Otvori Bill of quantities
          </button>
        </p>
      </Section>
    </>
  );
}
