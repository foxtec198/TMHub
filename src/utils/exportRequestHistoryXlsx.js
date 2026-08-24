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

function cell(reference, value, style = 0) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t>${escapeXml(value)}</t></is></c>`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_LABELS = {
  approved: "APROVADO",
  reproved: "REPROVADO",
  updated: "ATUALIZADO",
  canceled: "CANCELADO",
  pending: "PENDENTE",
};

export function exportRequestHistoryXlsx(records) {
  const headers = [
    "Abertura", "Fechamento", "Ausente", "Reserva", "Local", "Departamento",
    "Supervisor", "Motivo", "Dias", "Observações", "Status",
  ];
  const rows = [
    `<row r="1" ht="28" customHeight="1">${headers.map((header, index) => cell(`${columnName(index + 1)}1`, header, 1)).join("")}</row>`,
  ];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const values = [
      formatDate(record.abertura), formatDate(record.fechamento), record.ausente,
      record.reserva, record.local, record.dpto, record.supervisor,
      record.motivo, record.dias || 1, record.obs, STATUS_LABELS[record.status] || record.status,
    ];
    rows.push(`<row r="${rowNumber}">${values.map((value, column) => cell(`${columnName(column + 1)}${rowNumber}`, value, index % 2 ? 3 : 2)).join("")}</row>`);
  });

  const lastRow = Math.max(1, records.length + 1);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="2" width="20" customWidth="1"/><col min="3" max="4" width="34" customWidth="1"/><col min="5" max="5" width="52" customWidth="1"/><col min="6" max="6" width="16" customWidth="1"/><col min="7" max="7" width="30" customWidth="1"/><col min="8" max="8" width="20" customWidth="1"/><col min="9" max="9" width="10" customWidth="1"/><col min="10" max="10" width="48" customWidth="1"/><col min="11" max="11" width="16" customWidth="1"/></cols>
  <sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:K${lastRow}"/>
</worksheet>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF087A42"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F8F4"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD9E7DD"/></left><right style="thin"><color rgb="FFD9E7DD"/></right><top style="thin"><color rgb="FFD9E7DD"/></top><bottom style="thin"><color rgb="FFD9E7DD"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Histórico" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
  };
  const blob = new Blob([zipSync(files, { level: 6 })], { type: MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `historico_reposicoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
