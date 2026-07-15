const pageWidth = 595.28;
const pageHeight = 841.89;
const marginX = 52;
const marginTop = 58;
const marginBottom = 52;

function isCjk(char) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
}

function charUnits(char) {
  if (char === " ") return 0.35;
  if (/[\t|]/.test(char)) return 0.55;
  if (isCjk(char)) return 1;
  return 0.58;
}

function wrapText(text, maxUnits) {
  const value = String(text || "").trim();
  if (!value) return [""];

  const lines = [];
  let current = "";
  let units = 0;

  for (const char of value) {
    const nextUnits = charUnits(char);
    if (current && units + nextUnits > maxUnits) {
      lines.push(current);
      current = char;
      units = nextUnits;
    } else {
      current += char;
      units += nextUnits;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function normalizeMarkdownLine(rawLine) {
  const raw = String(rawLine || "");
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(raw)) {
    return null;
  }

  const heading = raw.match(/^\s*(#{1,6})\s+(.*)$/);
  if (heading) {
    return {
      text: heading[2].replace(/\*\*/g, "").trim(),
      size: heading[1].length <= 1 ? 16 : heading[1].length === 2 ? 13 : 12,
      gapBefore: heading[1].length <= 2 ? 8 : 5,
    };
  }

  let text = raw
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1（$2）")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/, "- ")
    .replace(/^\s*>\s?/, "")
    .trim();

  if (/^\|.*\|$/.test(text)) {
    text = text
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join("  |  ");
  }

  return {
    text,
    size: 10.5,
    gapBefore: text ? 2 : 7,
  };
}

function buildBlocks(content, title) {
  const dateText = new Date().toLocaleDateString("zh-CN");
  const blocks = [
    { text: "BaoyanPilot 保研院校梯度规划报告", size: 17, gapBefore: 0 },
    { text: `报告标题：${title || "AI 院校推荐报告"}`, size: 10.5, gapBefore: 6 },
    { text: `导出日期：${dateText}`, size: 10.5, gapBefore: 1 },
    {
      text: "说明：本报告由 AI 根据用户已提供信息整理，仅供规划参考。具体政策、报名时间、材料要求和考核方式以学校官网最新通知为准。",
      size: 10,
      gapBefore: 6,
    },
    { text: "", size: 10.5, gapBefore: 7 },
  ];

  String(content || "")
    .split(/\r?\n/)
    .map(normalizeMarkdownLine)
    .filter((line) => line !== null)
    .forEach((line) => blocks.push(line));

  return blocks;
}

function utf16Hex(text) {
  let hex = "FEFF";
  for (let index = 0; index < text.length; index += 1) {
    hex += text.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

function createTextCommand(text, x, y, size) {
  return `BT /F1 ${size.toFixed(1)} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${utf16Hex(text)} Tj ET\n`;
}

function paginateBlocks(blocks) {
  const pages = [[]];
  let y = pageHeight - marginTop;

  blocks.forEach((block) => {
    const size = block.size || 10.5;
    const lineHeight = Math.max(15, size + 6);
    const maxUnits = Math.max(18, Math.floor((pageWidth - marginX * 2) / (size * 0.95)));
    const wrappedLines = wrapText(block.text, maxUnits);

    wrappedLines.forEach((line, lineIndex) => {
      const gapBefore = lineIndex === 0 ? block.gapBefore || 0 : 0;
      if (y - gapBefore - lineHeight < marginBottom) {
        pages.push([]);
        y = pageHeight - marginTop;
      }

      y -= gapBefore;
      pages[pages.length - 1].push({ text: line, x: marginX, y, size });
      y -= lineHeight;
    });
  });

  return pages;
}

function encodePdfObjects(objects) {
  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n% BaoyanPilot\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets[index + 1] = encoder.encode(pdf).length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function createPdfBlob(content, title) {
  const pages = paginateBlocks(buildBlocks(content, title));
  const contentStartId = 6;
  const pageStartId = contentStartId + pages.length;
  const pageIds = pages.map((_, index) => pageStartId + index);

  const objects = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>";
  objects[3] =
    "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>";
  objects[4] =
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 5 >> /FontDescriptor 4 0 R /DW 1000 >>";

  pages.forEach((pageLines, index) => {
    const stream = pageLines.map((line) => createTextCommand(line.text, line.x, line.y, line.size)).join("");
    const streamLength = new TextEncoder().encode(stream).length;
    objects[contentStartId - 1 + index] = `<< /Length ${streamLength} >>\nstream\n${stream}endstream`;
  });

  pages.forEach((_, index) => {
    const contentId = contentStartId + index;
    objects[pageStartId - 1 + index] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  return new Blob([encodePdfObjects(objects)], { type: "application/pdf" });
}

function sanitizeFileName(value) {
  return String(value || "BaoyanPilot保研院校推荐报告")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 48);
}

export function isRecommendationReportContent(content) {
  const value = String(content || "");
  const hasReportFrame = value.includes("保研院校梯度规划报告") || value.includes("当前保研画像");
  const hasTiers =
    (value.includes("冲刺院校") || value.includes("（冲）")) &&
    (value.includes("稳妥院校") || value.includes("（稳）")) &&
    (value.includes("保底院校") || value.includes("（保）"));
  const hasRiskNotice = value.includes("仅供规划参考") || value.includes("官网最新通知") || value.includes("风险说明");
  return hasReportFrame && hasTiers && hasRiskNotice;
}

export function downloadRecommendationPdf({ content, title }) {
  const blob = createPdfBlob(content, title);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(title)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
