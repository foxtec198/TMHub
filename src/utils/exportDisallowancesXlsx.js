import { strToU8, zipSync } from "fflate";

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function inlineCell(reference, value, style = 0) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t>${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference, value, style = 0) {
  return `<c r="${reference}" s="${style}"><v>${Number(value || 0)}</v></c>`;
}

function moneyText(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function exportDisallowancesXlsx(records, summary) {
  const headers = [
    "Competência", "Data da falta", "Departamento", "Contrato", "Colaborador",
    "Matrícula", "Situação", "Dias apontados", "Dias cobertos", "Valor apontado",
    "Valor coberto", "Saldo descoberto", "Evidência",
  ];
  const coverageLabels = {
    em_analise: "Em análise",
    coberta: "Coberta",
    parcial: "Parcialmente coberta",
    descoberta: "Descoberta",
  };
  const rows = [];
  rows.push(`<row r="1" ht="28" customHeight="1">${inlineCell("A1", "CONTROLE DE GLOSAS", 1)}</row>`);
  rows.push('<row r="2"/>');

  const cards = [
    ["A", "REGISTROS", summary.total_registros, 2],
    ["D", "VALOR APONTADO", moneyText(summary.valor_total), 2],
    ["G", "VALOR COBERTO", moneyText(summary.valor_coberto), 2],
    ["J", "SALDO DESCOBERTO", moneyText(summary.valor_descoberto), 3],
    ["L", "EM ANÁLISE", moneyText(summary.valor_em_analise), 4],
  ];
  rows.push(`<row r="4" ht="20" customHeight="1">${cards.map(([column, label, , style]) => inlineCell(`${column}4`, label, style)).join("")}</row>`);
  rows.push(`<row r="5" ht="27" customHeight="1">${cards.map(([column, , value]) => inlineCell(`${column}5`, value, 5)).join("")}</row>`);
  rows.push('<row r="6"/>');
  rows.push('<row r="7"/>');
  rows.push(`<row r="8" ht="30" customHeight="1">${headers.map((label, index) => inlineCell(`${columnName(index + 1)}8`, label, 6)).join("")}</row>`);

  const hyperlinkRelationships = [];
  const hyperlinks = [];
  records.forEach((record, offset) => {
    const rowNumber = offset + 9;
    const bodyStyle = offset % 2 ? 8 : 7;
    const currencyStyle = offset % 2 ? 10 : 9;
    const values = [
      record.competencia,
      record.data_falta,
      record.departamento,
      record.contrato,
      record.colaborador,
      record.matricula,
      coverageLabels[record.cobertura] || record.cobertura,
    ];
    let cells = values.map((value, index) => inlineCell(`${columnName(index + 1)}${rowNumber}`, value, bodyStyle)).join("");
    cells += numberCell(`H${rowNumber}`, record.quantidade_dias, bodyStyle);
    cells += numberCell(`I${rowNumber}`, record.quantidade_coberta_dias, bodyStyle);
    cells += numberCell(`J${rowNumber}`, record.valor_total, currencyStyle);
    cells += numberCell(`K${rowNumber}`, record.valor_coberto, currencyStyle);
    cells += numberCell(`L${rowNumber}`, record.valor_descoberto, currencyStyle);
    if (record.evidencia_url) {
      const relationshipId = `rId${hyperlinkRelationships.length + 1}`;
      cells += inlineCell(`M${rowNumber}`, "Abrir evidência", 11);
      hyperlinks.push(`<hyperlink ref="M${rowNumber}" r:id="${relationshipId}"/>`);
      hyperlinkRelationships.push(`<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(record.evidencia_url)}" TargetMode="External"/>`);
    } else {
      cells += inlineCell(`M${rowNumber}`, "", bodyStyle);
    }
    rows.push(`<row r="${rowNumber}">${cells}</row>`);
  });

  const lastRow = Math.max(8, records.length + 8);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="3" width="16" customWidth="1"/><col min="4" max="4" width="42" customWidth="1"/>
    <col min="5" max="5" width="34" customWidth="1"/><col min="6" max="6" width="15" customWidth="1"/>
    <col min="7" max="7" width="22" customWidth="1"/><col min="8" max="9" width="16" customWidth="1"/>
    <col min="10" max="12" width="19" customWidth="1"/><col min="13" max="13" width="22" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A8:M${lastRow}"/>
  <mergeCells count="11"><mergeCell ref="A1:M2"/><mergeCell ref="A4:C4"/><mergeCell ref="A5:C6"/><mergeCell ref="D4:F4"/><mergeCell ref="D5:F6"/><mergeCell ref="G4:I4"/><mergeCell ref="G5:I6"/><mergeCell ref="J4:K4"/><mergeCell ref="J5:K6"/><mergeCell ref="L4:M4"/><mergeCell ref="L5:M6"/></mergeCells>
  ${hyperlinks.length ? `<hyperlinks>${hyperlinks.join("")}</hyperlinks>` : ""}
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="R$ #,##0.00"/></numFmts>
  <fonts count="5">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FF20A65A"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FFD64545"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FFD99000"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173925"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF6EF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F9F7"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFDDE7E1"/></left><right style="thin"><color rgb="FFDDE7E1"/></right><top style="thin"><color rgb="FFDDE7E1"/></top><bottom style="thin"><color rgb="FFDDE7E1"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Controle de Glosas</dc:title><dc:creator>TMHUB</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>TMHUB</Application></Properties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Controle de Glosas" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
  };
  if (hyperlinkRelationships.length) {
    files["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinkRelationships.join("")}</Relationships>`);
  }

  const archive = zipSync(files, { level: 6 });
  const blob = new Blob([archive], { type: MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `controle_glosas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
