import { writeFileSync } from "node:fs";
import { join } from "node:path";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

const BASE = join(import.meta.dirname, "..", "test-icloud-drive");

// ── 1. Word Document: Purchase Agreement ──

function createDocx() {
  // mammoth converts docx→html, but we need to CREATE a docx.
  // We'll use a minimal .docx approach — actually, let's just create a
  // simple text file with .docx-compatible content using the XLSX approach
  // for the spreadsheet and write raw content for docx.
  //
  // For a real test, we need an actual .docx. Let's use a hack:
  // Create a minimal valid .docx using raw ZIP + XML.

  // Actually, simpler: we'll create the test files that the bot can process.
  // For .docx we need a real docx. Let's use a different approach -
  // create them programmatically with a minimal docx library.

  // Since we don't have a docx creation library, let's install one quickly
  // or use a different approach. For now, let's create the spreadsheets
  // and a PDF, and handle docx separately.
  console.log("Skipping .docx (need creation library) — will create others");
}

// ── 2. Spreadsheet: Comparable Sales Analysis ──

function createCompSpreadsheet() {
  const wb = XLSX.utils.book_new();

  const compData = [
    ["Comparable Sales Analysis - 456 Oak Avenue, Austin TX"],
    ["Prepared by: Lapp Real Estate Group", "", "", "Date: February 15, 2026"],
    [],
    ["Address", "Sale Price", "Sq Ft", "$/Sq Ft", "Beds", "Baths", "Year Built", "Sale Date", "DOM"],
    ["456 Oak Ave (Subject)", "$525,000", "2,100", "$250", "4", "2.5", "1998", "Pending", "-"],
    ["412 Oak Ave", "$510,000", "2,050", "$249", "4", "2", "1995", "Jan 2026", "22"],
    ["501 Elm St", "$540,000", "2,200", "$245", "4", "3", "2001", "Dec 2025", "18"],
    ["789 Cedar Ln", "$498,000", "1,950", "$255", "3", "2.5", "1997", "Jan 2026", "31"],
    ["234 Birch Dr", "$535,000", "2,150", "$249", "4", "2.5", "2000", "Nov 2025", "14"],
    ["678 Maple Ct", "$555,000", "2,300", "$241", "4", "3", "2003", "Dec 2025", "9"],
    [],
    ["Summary Statistics"],
    ["Average Sale Price", "$527,600"],
    ["Average $/Sq Ft", "$248"],
    ["Average DOM", "18.8"],
    ["Suggested List Price", "$525,000 - $535,000"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(compData);
  XLSX.utils.book_append_sheet(wb, ws, "Comp Analysis");

  // Add a second sheet with adjustments
  const adjData = [
    ["Comparable Adjustments"],
    [],
    ["Feature", "412 Oak", "501 Elm", "789 Cedar", "234 Birch", "678 Maple"],
    ["Base Price", "$510,000", "$540,000", "$498,000", "$535,000", "$555,000"],
    ["Sq Ft Adj", "+$2,500", "-$5,000", "+$7,500", "-$2,500", "-$10,000"],
    ["Bed/Bath Adj", "-$5,000", "+$5,000", "-$10,000", "$0", "+$5,000"],
    ["Age Adj", "-$3,000", "+$3,000", "-$1,000", "+$2,000", "+$5,000"],
    ["Condition Adj", "$0", "-$5,000", "+$5,000", "+$3,000", "-$3,000"],
    ["Adjusted Price", "$504,500", "$538,000", "$499,500", "$537,500", "$552,000"],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(adjData);
  XLSX.utils.book_append_sheet(wb, ws2, "Adjustments");

  const filePath = join(BASE, "Comps", "oak-ave-comp-analysis.xlsx");
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(filePath, xlsxBuffer);
  console.log(`Created: ${filePath}`);
}

// ── 3. CSV: Closing Cost Estimate ──

function createClosingCostsCsv() {
  const csv = `Closing Cost Estimate - 456 Oak Avenue Austin TX 78745
Prepared for: John & Sarah Mitchell (Buyers)
Estimated Closing Date: March 15 2026

Category,Item,Amount,Paid By
Purchase Price,Contract Price,$525000.00,Buyer
,,,
Loan Costs,Loan Origination Fee (1%),$4200.00,Buyer
Loan Costs,Discount Points (0.5%),$2100.00,Buyer
Loan Costs,Appraisal Fee,$550.00,Buyer
Loan Costs,Credit Report,$65.00,Buyer
Loan Costs,Flood Certification,$25.00,Buyer
,,,
Title & Escrow,Title Insurance (Owner's Policy),$2890.00,Seller
Title & Escrow,Title Insurance (Lender's Policy),$1200.00,Buyer
Title & Escrow,Escrow Fee,$1500.00,Split
Title & Escrow,Title Search,$350.00,Buyer
Title & Escrow,Document Preparation,$250.00,Buyer
,,,
Government,Recording Fees,$125.00,Buyer
Government,Transfer Tax,$525.00,Seller
,,,
Prepaid Items,Homeowner's Insurance (12 mo),$2400.00,Buyer
Prepaid Items,Property Tax Proration,$3500.00,Buyer
Prepaid Items,Prepaid Interest (15 days),$1093.75,Buyer
,,,
Inspections,Home Inspection,$450.00,Buyer
Inspections,Termite Inspection,$125.00,Seller
Inspections,Survey,$500.00,Buyer
,,,
Other,HOA Transfer Fee,$250.00,Seller
Other,Home Warranty (1 year),$550.00,Seller
,,,
TOTALS,,,
,Buyer Total,$17108.75,
,Seller Total,$4765.00,
,Estimated Cash to Close,$109108.75,
,Down Payment (20%),$105000.00,
,Closing Costs,$17108.75,
,Less Earnest Money,$-13000.00,
`;

  const filePath = join(BASE, "123 Main St Transaction", "closing-costs-estimate.csv");
  writeFileSync(filePath, csv);
  console.log(`Created: ${filePath}`);
}

// ── 4. PDF: Seller Disclosure ──

async function createSellerDisclosurePdf(): Promise<void> {
  const filePath = join(BASE, "Oak Ave Listing", "seller-disclosure-456-oak.pdf");

  const doc = new PDFDocument({ size: "letter", margin: 72 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));

  doc.font("Helvetica-Bold").fontSize(16).text("SELLER'S DISCLOSURE NOTICE", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).text("Property: 456 Oak Avenue, Austin, TX 78745", { align: "center" });
  doc.text("Date: February 10, 2026", { align: "center" });
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(12).text("SELLER INFORMATION");
  doc.font("Helvetica").fontSize(10);
  doc.text("Seller(s): Robert & Linda Chen");
  doc.text("Seller has owned the property since: June 2015");
  doc.text("Property is: Owner-occupied single-family residence");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("STRUCTURAL");
  doc.font("Helvetica").fontSize(10);
  doc.text("Foundation type: Slab on grade");
  doc.text("Foundation issues: Minor settling crack in garage (repaired 2022, see attached invoice)");
  doc.text("Roof type: Composition shingle, installed 2019");
  doc.text("Roof leaks or repairs: New roof installed 2019 after hail damage (insurance claim)");
  doc.text("Exterior walls: Brick and HardiePlank siding");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("MECHANICAL SYSTEMS");
  doc.font("Helvetica").fontSize(10);
  doc.text("HVAC: Trane 3.5 ton system, installed 2020. Serviced annually.");
  doc.text("Water heater: 50-gallon Rheem tankless, installed 2021");
  doc.text("Plumbing: Copper supply lines, PVC drain. No known issues.");
  doc.text("Electrical: 200 amp panel, updated 2018. All GFCI in wet areas.");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("WATER & SEWER");
  doc.font("Helvetica").fontSize(10);
  doc.text("Water source: City of Austin municipal water");
  doc.text("Sewer: City sewer system");
  doc.text("Known issues: None");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("ENVIRONMENTAL");
  doc.font("Helvetica").fontSize(10);
  doc.text("Flood zone: Zone X (minimal flood hazard per FEMA map 48453C0345J)");
  doc.text("Previous flooding: None");
  doc.text("Asbestos: None known (built 1998, post-ban)");
  doc.text("Lead paint: N/A (built after 1978)");
  doc.text("Radon: Not tested");
  doc.text("Termite damage: Treated 2023, annual contract with ABC Pest Control");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("HOA INFORMATION");
  doc.font("Helvetica").fontSize(10);
  doc.text("HOA: Oak Avenue Homeowners Association");
  doc.text("Monthly dues: $175/month");
  doc.text("Special assessments: Pool renovation assessment ($1,200) paid in full 2025");
  doc.text("Pending litigation: None known");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("ADDITIONAL DISCLOSURES");
  doc.font("Helvetica").fontSize(10);
  doc.text("- Kitchen and master bath remodeled in 2021 (permits pulled, all inspections passed)");
  doc.text("- Backyard fence replaced 2023 (shared cost with neighbor at 458 Oak Ave)");
  doc.text("- Smart home system (Nest thermostat, Ring doorbell, Lutron lighting) included in sale");
  doc.text("- Garage door opener replaced 2024");
  doc.text("- Tree in front yard assessed by arborist 2025 — healthy, no root issues");
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(10).text("SELLER CERTIFICATION");
  doc.font("Helvetica").fontSize(9);
  doc.text("The above information is true and correct to the best of the Seller's knowledge as of the date signed.");
  doc.moveDown(0.5);
  doc.text("Seller Signature: Robert Chen ________________  Date: 02/10/2026");
  doc.text("Seller Signature: Linda Chen  ________________  Date: 02/10/2026");

  doc.end();
  await done;

  writeFileSync(filePath, Buffer.concat(chunks));
  console.log(`Created: ${filePath}`);
}

// ── 5. Word Document (using docx library workaround) ──
// Create a minimal valid .docx manually

async function createPurchaseAgreementDocx(): Promise<void> {
  // We'll create a plain text file as .txt for now, and also create
  // a real .docx using the JSZip approach
  const { default: JSZip } = await import("jszip").catch(() => ({ default: null }));

  const content = `RESIDENTIAL PURCHASE AGREEMENT

Property: 456 Oak Avenue, Austin, TX 78745
Legal Description: Lot 12, Block 3, Oak Avenue Estates, Travis County, Texas

PARTIES:
Buyer(s): John Mitchell and Sarah Mitchell
Seller(s): Robert Chen and Linda Chen

PURCHASE PRICE AND FINANCING:
Purchase Price: $525,000.00
Earnest Money Deposit: $13,000.00 (deposited with Capital Title of Texas)
Financing: Conventional loan, 80% LTV ($420,000.00)
Down Payment: $105,000.00 (20%)
Lender: First National Bank of Austin, Pre-approval dated February 1, 2026

IMPORTANT DATES:
Contract Execution Date: February 15, 2026
Option Period: 10 days (expires February 25, 2026)
Option Fee: $500.00 (credited to purchase price at closing)
Inspection Deadline: February 25, 2026
Financing Contingency Deadline: March 1, 2026
Appraisal Deadline: March 5, 2026
Title Commitment Delivery: February 22, 2026
Closing Date: March 15, 2026

CONTINGENCIES:
1. Financing Contingency: Buyer must obtain loan commitment by March 1, 2026
2. Inspection Contingency: Buyer may terminate during option period based on inspection results
3. Appraisal Contingency: Property must appraise at or above purchase price
4. Title Contingency: Clear and marketable title required

SPECIAL PROVISIONS:
- Seller to provide home warranty (American Home Shield, up to $550 value)
- Seller agrees to $5,000 credit toward buyer closing costs
- Washer, dryer, and refrigerator included in sale
- Ring doorbell and Nest thermostat remain with property
- Seller to complete professional carpet cleaning prior to closing
- Buyer accepts property in current as-is condition subject to inspection rights

PROPERTY CONDITION:
- Property sold subject to Seller's Disclosure dated February 10, 2026
- Survey to be provided by Seller (existing survey dated June 2015, buyer may request update)
- Property is in Oak Avenue HOA ($175/month dues)

LISTING INFORMATION:
Listing Agent: Patricia Vasquez, Lapp Real Estate Group (License #0654321)
Buyer's Agent: Michael Torres, Austin Homes Realty (License #0789012)
Listing Broker Commission: 2.5%
Buyer Broker Commission: 2.5%
Total Commission: 5% of purchase price ($26,250.00)

TITLE COMPANY:
Capital Title of Texas
1200 Congress Avenue, Suite 300
Austin, TX 78701

This agreement is binding upon execution by both parties.

Buyer: John Mitchell _________________ Date: 02/15/2026
Buyer: Sarah Mitchell _________________ Date: 02/15/2026
Seller: Robert Chen _________________ Date: 02/15/2026
Seller: Linda Chen _________________ Date: 02/15/2026`;

  // Save as .txt for reliable testing (bot can read this too)
  const txtPath = join(BASE, "123 Main St Transaction", "purchase-agreement-456-oak.txt");
  writeFileSync(txtPath, content);
  console.log(`Created: ${txtPath} (text version)`);

  // If jszip is available, create a real .docx
  if (JSZip) {
    const zip = new JSZip();

    // Minimal .docx structure
    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
    );

    zip.file("_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
    );

    // Convert plain text to Word XML paragraphs
    const paragraphs = content.split("\n").map(line => {
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (line.match(/^[A-Z][A-Z\s&:]+$/) || line.startsWith("RESIDENTIAL")) {
        // Bold headings
        return `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
      }
      return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    }).join("");

    zip.file("word/document.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + paragraphs + '</w:body></w:document>'
    );

    zip.file("word/_rels/document.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
    );

    const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const docxPath = join(BASE, "123 Main St Transaction", "purchase-agreement-456-oak.docx");
    writeFileSync(docxPath, docxBuffer);
    console.log(`Created: ${docxPath}`);
  } else {
    console.log("jszip not available — skipping .docx creation");
  }
}

// ── Run all ──

async function main() {
  console.log("Creating mock real estate files...\n");
  createCompSpreadsheet();
  createClosingCostsCsv();
  await createSellerDisclosurePdf();
  await createPurchaseAgreementDocx();
  console.log("\nDone! Files in:", BASE);
}

main().catch(console.error);
