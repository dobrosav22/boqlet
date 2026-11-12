import { DEPLOYED, MAX_UPLOAD_MB } from "../api";
import { Section, SAMPLE_MODEL, type ContentProps } from "./guideParts";

/** The guide in English. Same sections and ids as guideSr.tsx; keep the two in step. */
export function GuideEn({ onOpenBoq, onLoadSample }: ContentProps) {
  const sample = (
    <>
      <button className="link" onClick={onLoadSample}>
        Load the sample model
      </button>{" "}
      (a two-storey duplex house, the same one the engine is tested against) or{" "}
      <a href={SAMPLE_MODEL.url} download={SAMPLE_MODEL.fileName}>
        download it
      </a>{" "}
      to drop it in yourself
    </>
  );

  return (
    <>
      <header className="guide-intro">
        <h1>How to use IFC to BoQ</h1>
        <p className="guide-lede">
          This tool turns a building model (an IFC file) into a bill of quantities. You choose how it measures, how it
          codes and groups the lines, and how it reads the names in the model. Every number can be traced back to the
          formula and the elements behind it.
        </p>
        <p className="muted">
          Written for engineers who have measured bills of quantities by hand from drawings. No knowledge of IFC or BIM
          is needed. Reading time: about 15 minutes. Each heading has a <b>#</b> link you can copy to send someone a
          single section.
        </p>
      </header>

      <Section id="guide-short" title="The short version">
        <ol className="guide-steps">
          <li>
            Drop your IFC file into the box at the top left. Look at the card that appears: does it contain what you
            expect? No file at hand? {sample}.
          </li>
          <li>
            Leave the defaults: <b>As modelled</b> under Rules, <b>ACME cost codes</b> under Classification,{" "}
            <b>Global seed dictionary</b> under Dictionaries.
          </li>
          <li>
            Press <b>Generate BoQ</b>.
          </li>
          <li>
            If it says <b>Needs input</b>, answer the questions and press <b>Apply answers and regenerate</b>.
          </li>
          <li>
            <b>Click lines</b> to see the formula and the elements behind each number. Use the <b>3D view</b> to see what
            was measured and what was left out.
          </li>
          <li>
            <b>Download Excel</b> and fill in rates.
          </li>
          <li>
            Later, use the <b>Library</b> to make the rules and codes match your own practice.
          </li>
        </ol>
        <p>The rest of this guide explains each step and every word you will see on screen.</p>
      </Section>

      <Section id="guide-idea" title="The idea, in terms you already know">
        <p>When you made a BoQ by hand you did three separate jobs, perhaps without thinking of them as separate:</p>
        <ol>
          <li>
            <b>You measured</b> from the drawings: wall lengths, slab areas, door counts. You followed a rulebook: "deduct
            openings over 0.5 m²", "masonry in m³", "formwork measured separately".
          </li>
          <li>
            <b>You coded and grouped</b> the lines into chapters ("Masonry works", "Concrete works") with position numbers.
          </li>
          <li>
            <b>You read the labels</b> on the drawings and knew what they meant: "C25/30" is concrete, "Z-25" is your office's
            25 cm block wall. That came from experience.
          </li>
        </ol>
        <p>This tool does the same three jobs on an IFC file instead of drawings, and keeps each job separate, so you can change one without touching the others:</p>
        <div className="guide-table">
          <table>
            <thead>
              <tr>
                <th>What you did by hand</th>
                <th>What the tool calls it</th>
                <th>Does it change the numbers?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>The measuring rulebook</td>
                <td>
                  <b>Rules</b> (a "rule set")
                </td>
                <td>
                  <b>Yes</b>
                </td>
              </tr>
              <tr>
                <td>Chapters and position numbers</td>
                <td>
                  <b>Classification</b>
                </td>
                <td>
                  <b>Never.</b> It only labels and sorts lines.
                </td>
              </tr>
              <tr>
                <td>Knowing what the labels mean</td>
                <td>
                  <b>Dictionary</b>
                </td>
                <td>Only indirectly, by telling the rules what a thing is</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Keep this table in mind. Everything else on screen hangs off it.</p>
      </Section>

      <Section id="guide-ifc" title="What an IFC file is">
        <p>
          An IFC file is not a drawing. It is a <b>list of building objects</b> (the tool calls them <i>elements</i>),
          exported from a modelling program such as Revit, ArchiCAD, Tekla or Allplan. Each element knows:
        </p>
        <ul>
          <li>
            <b>what kind of thing it is</b>, its <i>IFC class</i>: IfcWall, IfcSlab, IfcDoor, IfcWindow, IfcSpace (a
            room), and so on. This is the only part every program writes the same way;
          </li>
          <li>
            <b>its shape</b>, the 3D geometry;
          </li>
          <li>
            <b>its name and type</b>, free text typed by whoever modelled it, for example "Exterior - Brick on Block";
          </li>
          <li>
            <b>its material</b>, also free text;
          </li>
          <li>
            often <b>quantities the modelling program already worked out</b> (length, area, volume). These can be wrong,
            so the tool checks them against the geometry;
          </li>
          <li>
            <b>which storey</b> it is on.
          </li>
        </ul>
        <p>
          The tool reads that list, checks the numbers and applies your rulebook to it. It cannot guess the rulebook
          from the file: an IFC file holds geometry and properties, not measurement rules. That is why you choose one.
        </p>
      </Section>

      <Section id="guide-file" title="Step 1: give it your IFC file">
        <p>
          At the top left, under <b>Bill of quantities | Library | Guide</b>, is a box that says <b>Drop an IFC file here</b>.
          Drag your .ifc file onto it, or click it and choose the file.
          {MAX_UPLOAD_MB > 0 && <> This online demo accepts files up to {MAX_UPLOAD_MB} MB.</>}
        </p>
        <p>
          It says <b>Reading …</b> while it opens every element and checks its geometry. A small house takes seconds, a large
          building minutes. No file of your own? {sample}.
        </p>
        <p>When it is done, a card appears under the box. Read it: it tells you whether the file is any good.</p>
        <dl className="guide-dl">
          <dt>Schema</dt>
          <dd>The IFC version (IFC2X3, IFC4…). You can ignore it.</dd>
          <dt>Made with</dt>
          <dd>Which program exported the file.</dd>
          <dt>Contents</dt>
          <dd>
            How many elements, openings and spaces. <i>Openings</i> are the holes for doors and windows. <i>Spaces</i> are
            rooms: with 0 spaces, finishes room by room (floor tiles per room, skirting) cannot be measured.
          </dd>
          <dt>Storeys</dt>
          <dd>The floors the file has.</dd>
          <dt>Grey chips</dt>
          <dd>
            A quick count of what is inside, such as "Wall 57, Door 14, Window 21". If you expected walls and see none,
            the file is the problem, not the tool.
          </dd>
        </dl>
      </Section>

      <Section id="guide-choose" title="Step 2: choose rules, classification and dictionaries">
        <p>Below the file card are three boxes, matching the table above. For your first run, change nothing.</p>

        <h3>Rules (pick one)</h3>
        <p>The hint says "How quantities are measured. Changes the numbers."</p>
        <ul>
          <li>
            <b>As modelled (master template)</b>: the neutral rulebook. It measures everything as the model has it and
            makes no country-specific choices. Start with this one.
          </li>
          <li>
            The others (<b>Standard-style example</b>, <b>ACME Ltd house rules</b>, the two <b>Demo</b> sets) are
            examples that show how a different rulebook gives different numbers from the same file. "extends …" means
            "the same as that one, with a few answers changed", just as a firm's house rules are "the standard,
            except…".
          </li>
        </ul>

        <h3>Classification (tick one or more)</h3>
        <p>The hint says "Codes and grouping. Never changes numbers. The first one ticked groups the sheet."</p>
        <ul>
          <li>
            <b>ACME cost codes</b>: an example company code list (ticked by default).
          </li>
          <li>
            <b>Demo: trade sections</b>: chapters by trade (masonry, concrete, carpentry…), the way tenders are often
            grouped.
          </li>
          <li>
            <b>Uniclass 2015</b>: an official classification system. It may be greyed out when its code list is not
            installed.
          </li>
        </ul>
        <p>Tick several and each line gets a code from each of them. The sheet on screen is grouped by the first one ticked.</p>

        <h3>Dictionaries (tick one or more)</h3>
        <p>The hint says "How names in the model are understood". Each dictionary has a layer:</p>
        <ul>
          <li>
            <b>global</b>: names everyone uses, such as the default material names of the common modelling programs.{" "}
            <b>Global seed dictionary</b> is ticked by default; keep it on.
          </li>
          <li>
            <b>company</b>: one office's own names and abbreviations.
          </li>
          <li>
            <b>project</b>: names that mean something only in one project.
          </li>
        </ul>
        <p>When two dictionaries disagree, the more specific one wins: project before company, company before global.</p>
      </Section>

      <Section id="guide-generate" title="Step 3: generate">
        <p>
          Press <b>Generate BoQ</b> at the bottom of the left column. After a few seconds the right side fills with the
          bill.
          {DEPLOYED && <> The first run after a quiet spell can take 20 to 40 seconds while the online engine starts.</>}
        </p>
      </Section>

      <Section id="guide-sheet" title="Reading the bill">
        <h3>The header</h3>
        <ul>
          <li>
            <b>The file name</b> and a line such as "As modelled / ACME cost codes. 64 lines from 180 of 195 elements".
            It tells you which rules and codes were used and how many elements ended up in the bill. Here 15 were not
            measured; the Questions tab says why.
          </li>
          <li>
            <b>A status badge</b>. <b>Complete</b>: nothing is waiting for you. <b>Needs input: N questions</b>: the tool
            met things it cannot decide alone. It does not guess, it asks (see Questions below).
          </li>
          <li>
            Buttons: <b>3D view</b>, <b>Pin for comparison</b>, <b>Download Excel</b>.
          </li>
        </ul>

        <h3>The sheet</h3>
        <p>It is drawn like dimension paper: Ref | Description | Quantity | Unit.</p>
        <ul>
          <li>
            <b>Bold rows</b> are chapter headings from the classification, for example "D Walls".
          </li>
          <li>
            <b>Normal rows</b> are the BoQ lines: Ref (the code), Description, Quantity, Unit.
          </li>
          <li>
            A small <i>derived</i> tag means the number is not in the model but is calculated from other lines:
            formwork from concrete areas, reinforcement from concrete volume × kg/m³. The same rules of thumb you used,
            except here the factor is shown and can be changed.
          </li>
          <li>
            A small <i>manual</i> tag means a line with nothing in the model behind it: site setup, scaffolding, a
            provisional sum. You fill it in.
          </li>
          <li>
            <b>"to confirm"</b> instead of a number: the line exists but a value is missing. The tool never drops a line
            silently, because a missing line is the worst error in a bill. It stays visible, with the reason.
          </li>
        </ul>

        <h3>Click a line</h3>
        <p>This is the most important habit. A clicked line opens and shows:</p>
        <ul>
          <li>
            <b>Formula</b>: exactly how the number was worked out, for example the area of both faces minus openings
            larger than 0.5 m².
          </li>
          <li>
            <b>Parameters used</b>: the values from the rulebook that went into it (a deduction limit, a factor).
          </li>
          <li>
            <b>Codes</b>: which code the line got from each classification, and why.
          </li>
          <li>
            <b>A table of every element that contributed</b>: each wall or door, its own quantity, and a note on how it
            was measured (for example "area from volume ÷ thickness, matches the model's own value").
          </li>
          <li>
            <b>Show this line in the calculation log</b>: the full story of this line.
          </li>
        </ul>
        <p>
          That table is your take-off sheet. You can check any number back to the elements, the way you would tick off
          a dimension on a drawing.
        </p>
      </Section>

      <Section id="guide-3d" title="The 3D view">
        <p>
          With <b>3D view</b> on, the model sits to the right of the sheet.
        </p>
        <ul>
          <li>Click a BoQ line: its elements light up in the model.</li>
          <li>Click an element in the model: it lists the BoQ lines it is in, or says "Not in any BoQ line".</li>
          <li>
            <b>Colour by what the BoQ covers</b> (the list at the top of the view) is the one for checking: you see at a
            glance what was measured and what was left out. <b>Colour by code group</b> shows the chapters.
          </li>
          <li>
            Mouse: drag to turn, scroll to zoom, right-drag to move. <b>Fit all</b> brings everything back into view.
            Tick <b>Rooms</b> to see the spaces.
          </li>
        </ul>
      </Section>

      <Section id="guide-log" title="Calculation log and inputs">
        <p>
          <b>Calculation log</b> is a numbered diary of everything the tool did, in order: reading the file,
          understanding names, measuring, matching rules, derived lines, codes, your answers. The chips at the top
          filter by stage; the search box finds an element, a rule or a word. You will rarely read it from top to
          bottom. You come here when a number looks odd and you want to know why.
        </p>
        <p>
          <b>Inputs</b> shows which rulebook was used and the value of each of its settings (the tool calls them{" "}
          <i>slots</i>), for example "Wall opening size limit = 0.5 m²". It is the "basis of measurement" page you would
          put at the front of a bill.
        </p>
      </Section>

      <Section id="guide-questions" title="Questions: the tool asking you, as a junior would">
        <p>
          If the badge says <b>Needs input</b>, the <b>Questions</b> tab opens by itself. Each question is either{" "}
          <b>Blocking</b> (it must be answered for a complete bill) or <b>Optional</b> (it tells you what was left out;
          you can ignore it).
        </p>
        <div className="guide-table">
          <table>
            <thead>
              <tr>
                <th>On screen</th>
                <th>What it means</th>
                <th>What you answer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>unknown name</td>
                <td>"The material is called 'XYZ-3'. I do not know what that is."</td>
                <td>Pick its meaning from a list (concrete, brick, plasterboard…)</td>
              </tr>
              <tr>
                <td>unmatched</td>
                <td>"No rule measures this element."</td>
                <td>Pick a rule to measure it with, or Exclude from the BoQ</td>
              </tr>
              <tr>
                <td>missing data</td>
                <td>"I need a value the model does not have."</td>
                <td>Type the number</td>
              </tr>
              <tr>
                <td>unclassified</td>
                <td>"This line got no code."</td>
                <td>Pick a code from the list</td>
              </tr>
              <tr>
                <td>contradiction</td>
                <td>"The file disagrees with itself", for example the area it reports is not what the geometry gives</td>
                <td>Choose which one to trust</td>
              </tr>
              <tr>
                <td>double claim, overlap</td>
                <td>"Two rules, or two models, want the same element."</td>
                <td>Choose one, so it is not counted twice</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Fill in what you can and press <b>Apply answers and regenerate</b>. The bill is worked out again with your
          answers.
        </p>
        <p>
          Answers stay applied: the left column then says "N answers applied to this BoQ", with a <b>Clear</b> link.
          Questions are recognised by their content, so a revised model asks only about what is new.
          {DEPLOYED && <> In this online demo, answers are lost when you reload the page.</>}
        </p>
      </Section>

      <Section id="guide-excel" title="Downloading Excel">
        <p>
          <b>Download Excel</b> gives you a workbook with these sheets:
        </p>
        <ul>
          <li>
            <b>BoQ</b>: Ref, Description, Unit, Quantity, Rate (a yellow column for you), Amount, with a subtotal per
            chapter and a total. Amounts and totals are Excel formulas, so typing rates prices the bill. Yellow rows are
            the "to confirm" ones.
          </li>
          <li>
            <b>Calculation</b>: every line with its formula, then every element under it with its quantity. Your
            take-off, for checking or for a reviewer.
          </li>
          <li>
            <b>Lines</b>, <b>Log</b>, <b>Questions</b>, <b>Inputs</b>: the same as the tabs on screen. Lines has a column
            for each classification you ticked.
          </li>
        </ul>
      </Section>

      <Section id="guide-compare" title="Comparing two bills">
        <p>This is where you see what the tool is for.</p>
        <ol className="guide-steps">
          <li>
            With a bill on screen, press <b>Pin for comparison</b>. It keeps a copy of the current bill.
          </li>
          <li>
            On the left, choose another rule set, for example <b>Standard-style example</b>.
          </li>
          <li>
            Press <b>Generate BoQ</b>.
          </li>
          <li>
            Open the <b>Compare</b> tab: the pinned and the current bill side by side, with totals in m², m³, t and m.
          </li>
        </ol>
        <p>
          Same file, different rulebook, different numbers: what you see when two estimators measure the same drawings.
          Then try changing only the classification and compare again. The numbers stay the same; only the chapters
          move.
        </p>
      </Section>

      <Section id="guide-federation" title="Several models: architecture, structure, services">
        <p>
          Real projects come as several IFC files, one per discipline. Drop the second file into the same box (it now
          says "Add another IFC file"). Each file gets a checkbox (include it or not) and a <b>Discipline</b>:
          architecture, structure or mep (mechanical, electrical, plumbing).
        </p>
        <p>
          The tool combines them into one bill. Each element is taken from the discipline that owns it: a concrete column
          comes from the structural model, not from the architect's copy of it. The same element in two files is counted
          once, and anything the tool cannot decide becomes a question.
        </p>
      </Section>

      <Section id="guide-library" title="Library: making it measure your way">
        <p>
          <b>Library</b> (top left) is where you set up the three things from the table at the top so they match your
          practice. You do not need it for a first try.
        </p>
        <h3>Rule sets</h3>
        <p>
          Never start from scratch. <b>+ New rule set</b>, keep "Extend an existing rule set" and <b>As modelled</b>,{" "}
          <b>Create draft</b>. The <b>Settings</b> tab is then a list of the questions a measurement rulebook answers,
          grouped by section, for example:
        </p>
        <ul>
          <li>Which openings (windows, doors, voids) are deducted from walls? What is the size limit?</li>
          <li>In what unit are walls measured?</li>
          <li>Is formwork measured as its own item? How do you calculate it?</li>
          <li>Do you measure excavation for foundations? With how much working space?</li>
          <li>When the model has no reinforcement, do you estimate it from concrete volumes?</li>
          <li>Do you want separate BoQ lines for each storey?</li>
        </ul>
        <p>
          Answer as your rulebook does; a changed answer gets a <b>your answer</b> badge. Then <b>Check</b> (the engine
          says whether it accepts the rule set), <b>Save</b>, go back to <b>Bill of quantities</b>, pick your rule set
          and generate. Formulas show readable names in square brackets, such as [Length] × [Height]; the{" "}
          <b>Names</b> button lists what a formula can use.
        </p>
        <p>
          The <b>BoQ items</b> tab is for when no question covers what you need: a new item measured from the model, one
          calculated from other items, or one entered by hand ("Site setup, 1 item").
        </p>
        <h3>Classifications</h3>
        <p>
          <b>+ New classification</b>. On <b>Code list</b>, import your codes from Excel or CSV. On <b>Codes per line</b>,
          pick a code for each kind of BoQ line ("Walls → 03.01"). <b>Suggest codes</b> proposes matches for you to
          accept. A row can be split, so external walls get one code and internal walls another.
        </p>
        <h3>Dictionaries</h3>
        <p>
          Open a dictionary. <b>Names in the model</b> lists every material and type name in your loaded file and what
          the tool thinks each one means. Teach it your office's names there, in a company dictionary, never in the
          global one, so your habits do not affect anyone else.
        </p>
        <p className="muted">
          Shipped presets are never overwritten: if you change one, <b>Save as new…</b> keeps a copy under your name.
          {DEPLOYED && <> In this online demo saves are temporary; use <b>Download JSON</b> to keep your work.</>}
        </p>
      </Section>

      <Section id="guide-trust" title="Before you trust it on a real job">
        <ul>
          <li>
            The rule sets and code lists shipped here are <b>illustrative examples, not real national standards</b>.
            Licensed standards cannot be included. For a real tender, set up your own rulebook in the Library.
          </li>
          <li>
            The numbers have been checked closely against a hand-measured bill for the Duplex sample (they match
            exactly) and against the buildingSMART test files. Around 300 other public files run without errors, but
            their quantities were not checked by hand. On your own file, <b>spot-check a few lines</b> by clicking them,
            as you would check a colleague's take-off.
          </li>
          <li>
            The tool can only measure what was modelled. If the modeller left the skirting out, the tool will not invent
            it: it flags it, uses a rule of thumb you choose, or leaves it to a manual line.
          </li>
        </ul>
      </Section>

      {DEPLOYED && (
        <Section id="guide-demo" title="About this online demo">
          <ul>
            <li>IFC files up to {MAX_UPLOAD_MB || 4.4} MB. Larger models need the app run on your own computer.</li>
            <li>The first request after a quiet spell is slow (20 to 40 seconds) while the engine starts. Later ones take seconds.</li>
            <li>Answers to questions are lost when you reload the page.</li>
            <li>Library saves are temporary. Download what you want to keep: the Excel bill, or Download JSON for a rule set, classification or dictionary.</li>
            <li>Uniclass is not available online.</li>
          </ul>
        </Section>
      )}

      <Section id="guide-words" title="Words used on screen">
        <dl className="guide-dl">
          <dt>BoQ</dt>
          <dd>Bill of quantities.</dd>
          <dt>IFC</dt>
          <dd>The open file format for building models, readable by every major modelling program.</dd>
          <dt>Element</dt>
          <dd>One object in the model: a wall, a door, a slab, a pipe.</dd>
          <dt>IFC class</dt>
          <dd>The kind of element (IfcWall, IfcDoor…). The tool shows it without "Ifc".</dd>
          <dt>Type</dt>
          <dd>The modeller's name for a family of identical elements, such as "Exterior - Brick on Block".</dd>
          <dt>Space</dt>
          <dd>A room in the model. Needed for finishes measured room by room.</dd>
          <dt>Storey</dt>
          <dd>A floor level.</dd>
          <dt>Rule set</dt>
          <dd>Your measuring rulebook, as data: which elements become which lines, in which unit, what is deducted.</dd>
          <dt>Slot</dt>
          <dd>One setting in a rule set, such as an opening size limit or a formwork factor.</dd>
          <dt>Classification</dt>
          <dd>A code list plus the rules saying which line gets which code. Never changes a quantity.</dd>
          <dt>Dictionary</dt>
          <dd>Says what the free-text names in models mean, in global, company and project layers.</dd>
          <dt>Derived</dt>
          <dd>A quantity calculated from other lines (formwork, reinforcement estimates), with the formula shown.</dd>
          <dt>Manual</dt>
          <dd>A line with nothing in the model behind it: preliminaries, provisional sums, lump sums.</dd>
          <dt>To confirm</dt>
          <dd>A line whose quantity could not be determined. It stays in the bill with the reason.</dd>
          <dt>Federation</dt>
          <dd>Combining several models of one project (architecture, structure, services) into one bill.</dd>
        </dl>
        <p>
          <button className="button" onClick={onOpenBoq}>
            Open the bill of quantities
          </button>
        </p>
      </Section>
    </>
  );
}
