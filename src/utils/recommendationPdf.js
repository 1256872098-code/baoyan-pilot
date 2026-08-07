import { sanitizeRecommendationReportContent } from "./reportContent.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_BOTTOM = 58;

const COLORS = {
  navy: [0.055, 0.118, 0.235],
  blue: [0.086, 0.302, 0.745],
  blueDark: [0.055, 0.231, 0.596],
  bluePale: [0.925, 0.953, 1],
  blueSoft: [0.965, 0.976, 0.996],
  slate: [0.278, 0.337, 0.431],
  muted: [0.455, 0.51, 0.6],
  border: [0.827, 0.859, 0.91],
  borderLight: [0.902, 0.922, 0.949],
  white: [1, 1, 1],
};

const REPORT_TITLE = "保研院校梯度规划报告";
const REPORT_DISCLAIMER =
  "本报告由 AI 根据用户已确认的信息整理，仅供保研择校与申请规划参考，不承诺保研成功，不构成录取判断。各高校政策、报名时间、材料要求及考核方式可能变化，请以学校研究生院、学院官网和当年最新通知为准。";

function pdfColor(color) {
  return color.map((value) => Number(value).toFixed(3)).join(" ");
}

function isAscii(char) {
  const codePoint = char.codePointAt(0);
  return codePoint >= 0x20 && codePoint <= 0x7e;
}

function asciiWidthRatio(char, bold = false) {
  if (char === " ") return 0.278;
  if (/[ilI.,'`!:;|]/.test(char)) return 0.278;
  if (/[mwMW@%&#]/.test(char)) return bold ? 0.91 : 0.87;
  if (/[A-Z]/.test(char)) return bold ? 0.69 : 0.667;
  if (/[a-z]/.test(char)) return bold ? 0.53 : 0.5;
  if (/[0-9]/.test(char)) return 0.556;
  if (/[-+*/=<>_()[\]{}]/.test(char)) return 0.5;
  return 0.556;
}

function glyphWidth(char, size, bold = false) {
  return (isAscii(char) ? asciiWidthRatio(char, bold) : 1) * size;
}

function measureText(text, size, bold = false) {
  return Array.from(String(text || "")).reduce(
    (width, char) => width + glyphWidth(char, size, bold),
    0,
  );
}

function wrapText(text, maxWidth, size, bold = false) {
  const value = String(text || "").trim();
  if (!value) return [""];

  const lines = [];
  let current = "";
  let currentWidth = 0;

  Array.from(value).forEach((char) => {
    const charWidth = glyphWidth(char, size, bold);
    if (current && currentWidth + charWidth > maxWidth) {
      const lastSpace = current.lastIndexOf(" ");
      const textBeforeSpace = lastSpace > 0 ? current.slice(0, lastSpace) : "";

      if (
        textBeforeSpace &&
        measureText(textBeforeSpace, size, bold) > maxWidth * 0.45
      ) {
        lines.push(textBeforeSpace.trimEnd());
        current = `${current.slice(lastSpace + 1)}${char}`.trimStart();
      } else {
        lines.push(current.trimEnd());
        current = char.trimStart();
      }
      currentWidth = measureText(current, size, bold);
      return;
    }

    current += char;
    currentWidth += charWidth;
  });

  if (current) lines.push(current.trimEnd());
  return lines.length ? lines : [""];
}

function utf16Hex(text) {
  let hex = "";
  for (let index = 0; index < text.length; index += 1) {
    hex += text.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

function asciiHex(text) {
  return `<${Array.from(text)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")}>`;
}

function splitFontRuns(text) {
  const runs = [];

  Array.from(String(text || "")).forEach((char) => {
    const fontType = isAscii(char) ? "latin" : "cjk";
    const previous = runs[runs.length - 1];
    if (previous?.fontType === fontType) {
      previous.text += char;
    } else {
      runs.push({ fontType, text: char });
    }
  });

  return runs;
}

function createTextCommand(
  text,
  x,
  y,
  { size = 10.5, bold = false, color = COLORS.navy } = {},
) {
  let cursorX = x;
  const fill = pdfColor(color);

  return splitFontRuns(text)
    .map((run) => {
      const latin = run.fontType === "latin";
      const font = latin ? (bold ? "F3" : "F2") : "F1";
      const encoded = latin ? asciiHex(run.text) : utf16Hex(run.text);
      const renderMode = bold && !latin ? "2" : "0";
      const command =
        `q ${fill} rg ${fill} RG 0.18 w ` +
        `BT /${font} ${size.toFixed(2)} Tf ${renderMode} Tr ` +
        `1 0 0 1 ${cursorX.toFixed(2)} ${y.toFixed(2)} Tm ${encoded} Tj ET Q\n`;
      cursorX += measureText(run.text, size, bold);
      return command;
    })
    .join("");
}

function createFilledRect(x, y, width, height, color) {
  return `q ${pdfColor(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q\n`;
}

function createStrokedRect(x, y, width, height, color, lineWidth = 0.6) {
  return `q ${pdfColor(color)} RG ${lineWidth.toFixed(2)} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q\n`;
}

function createLine(x1, y1, x2, y2, color, lineWidth = 0.6) {
  return `q ${pdfColor(color)} RG ${lineWidth.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q\n`;
}

function cleanInlineMarkdown(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1（$2）")
    .replace(/<((?:https?:\/\/)[^>]+)>/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([#>*_`|\-])/g, "$1")
    .trim();
}

function isTableSeparator(line) {
  const value = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!value.includes("|")) return false;
  return value
    .split("|")
    .every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function parseTableRow(line) {
  let value = String(line || "").trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cleanInlineMarkdown(cell));
}

function startsSpecialBlock(lines, index) {
  const line = String(lines[index] || "").trim();
  const next = String(lines[index + 1] || "").trim();
  return (
    !line ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^(?:[-*+]\s+|\d+[.)]\s+)/.test(line) ||
    /^(?:-{3,}|\*{3,}|_{3,})$/.test(line) ||
    (/\|/.test(line) && isTableSeparator(next)) ||
    /^<!--.*-->$/.test(line)
  );
}

function joinParagraphLines(lines) {
  return lines.reduce((result, line) => {
    const value = cleanInlineMarkdown(line);
    if (!result) return value;
    const needsSpace = /[A-Za-z0-9),.;:]$/.test(result) && /^[A-Za-z0-9(]/.test(value);
    return `${result}${needsSpace ? " " : ""}${value}`;
  }, "");
}

function isRepeatedDisclaimer(text) {
  const value = String(text || "");
  return (
    value.includes("本报告仅供保研规划参考") ||
    (value.includes("不承诺保研成功") && value.includes("官网"))
  );
}

function parseMarkdown(content) {
  const lines = sanitizeRecommendationReportContent(content)
    .replace(/<!--\s*baoyanpilot-report\s*-->/gi, "")
    .split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = String(lines[index] || "");
    const line = raw.trim();

    if (!line) {
      if (blocks.length && blocks[blocks.length - 1].type !== "space") {
        blocks.push({ type: "space" });
      }
      continue;
    }

    if (/^<!--.*-->$/.test(line)) continue;

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const title = cleanInlineMarkdown(heading[2]);
      if (heading[1].length === 1 && /保研院校梯度规划报告/.test(title)) {
        continue;
      }
      blocks.push({ type: "heading", level: heading[1].length, text: title });
      continue;
    }

    const nextLine = String(lines[index + 1] || "").trim();
    if (/\|/.test(line) && isTableSeparator(nextLine)) {
      const header = parseTableRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && /\|/.test(String(lines[index] || ""))) {
        const tableLine = String(lines[index] || "").trim();
        if (!tableLine || isTableSeparator(tableLine)) break;
        rows.push(parseTableRow(tableLine));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      let quoteIndex = index;
      while (quoteIndex < lines.length && /^\s*>\s?/.test(lines[quoteIndex])) {
        quoteLines.push(String(lines[quoteIndex]).replace(/^\s*>\s?/, ""));
        quoteIndex += 1;
      }
      index = quoteIndex - 1;
      const quote = joinParagraphLines(quoteLines);
      if (!isRepeatedDisclaimer(quote)) {
        blocks.push({ type: "quote", text: quote });
      }
      continue;
    }

    const list = line.match(/^(?:([-*+])|(\d+[.)]))\s+(.+)$/);
    if (list) {
      blocks.push({
        type: "listItem",
        ordered: Boolean(list[2]),
        marker: list[2] || "",
        text: cleanInlineMarkdown(list[3]),
      });
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: "rule" });
      continue;
    }

    const paragraphLines = [raw];
    while (index + 1 < lines.length && !startsSpecialBlock(lines, index + 1)) {
      paragraphLines.push(lines[index + 1]);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: joinParagraphLines(paragraphLines) });
  }

  return blocks.filter(
    (block, index) =>
      block.type !== "space" ||
      (index > 0 && index < blocks.length - 1 && blocks[index - 1].type !== "space"),
  );
}

function formatChineseDate(input) {
  const date = input instanceof Date ? input : new Date(input || Date.now());
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${validDate.getFullYear()}年${validDate.getMonth() + 1}月${validDate.getDate()}日`;
}

function createReportPages(content, generatedAt) {
  const blocks = parseMarkdown(content);
  const pages = [];
  let page = [];
  let cursorY = PAGE_HEIGHT - 42;

  const add = (command) => {
    page.push(command);
  };

  const addText = (text, x, y, options) => {
    add(createTextCommand(text, x, y, options));
  };

  const startPage = (firstPage = false) => {
    page = [];
    pages.push(page);
    cursorY = PAGE_HEIGHT - 42;

    if (!firstPage) {
      addText("BAOYAN PILOT", MARGIN_X, cursorY, {
        size: 8.5,
        bold: true,
        color: COLORS.blue,
      });
      const headerText = REPORT_TITLE;
      addText(
        headerText,
        PAGE_WIDTH - MARGIN_X - measureText(headerText, 8.5),
        cursorY,
        { size: 8.5, color: COLORS.muted },
      );
      add(createLine(MARGIN_X, cursorY - 11, PAGE_WIDTH - MARGIN_X, cursorY - 11, COLORS.border));
      cursorY -= 31;
    }
  };

  const ensureSpace = (height) => {
    if (cursorY - height >= CONTENT_BOTTOM) return false;
    startPage(false);
    return true;
  };

  const renderWrappedLines = (
    lines,
    { x = MARGIN_X, size = 10.4, lineHeight = 16.8, bold = false, color = COLORS.navy } = {},
  ) => {
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      addText(line, x, cursorY - size, { size, bold, color });
      cursorY -= lineHeight;
    });
  };

  const renderParagraph = (text) => {
    const size = 10.4;
    const lineHeight = 17.2;
    const lines = wrapText(text, CONTENT_WIDTH, size);
    ensureSpace(Math.min(lines.length, 2) * lineHeight + 2);
    renderWrappedLines(lines, { size, lineHeight, color: COLORS.navy });
    cursorY -= 4;
  };

  const renderHeading = (block) => {
    if (block.level <= 2) {
      const boxHeight = 30;
      ensureSpace(boxHeight + 15);
      cursorY -= 10;
      const bottom = cursorY - boxHeight;
      add(createFilledRect(MARGIN_X, bottom, CONTENT_WIDTH, boxHeight, COLORS.bluePale));
      add(createFilledRect(MARGIN_X, bottom, 4, boxHeight, COLORS.blue));
      addText(block.text, MARGIN_X + 15, bottom + 9, {
        size: 13.4,
        bold: true,
        color: COLORS.blueDark,
      });
      cursorY = bottom - 7;
      return;
    }

    const size = block.level === 3 ? 11.8 : 10.8;
    const headingLines = wrapText(block.text, CONTENT_WIDTH - 16, size, true);
    ensureSpace(Math.min(headingLines.length, 2) * 17 + 13);
    cursorY -= 7;
    headingLines.forEach((line, lineIndex) => {
      ensureSpace(17);
      if (lineIndex === 0) {
        add(createFilledRect(MARGIN_X, cursorY - size + 3, 4, 9, COLORS.blue));
      }
      addText(line, MARGIN_X + 13, cursorY - size, {
        size,
        bold: true,
        color: COLORS.blueDark,
      });
      cursorY -= 17;
    });
    cursorY -= 2;
  };

  const renderListItem = (block) => {
    const size = 10.2;
    const lineHeight = 16.5;
    const markerWidth = block.ordered ? 25 : 15;
    const textX = MARGIN_X + markerWidth;
    const lines = wrapText(block.text, CONTENT_WIDTH - markerWidth, size);
    ensureSpace(Math.min(lines.length, 2) * lineHeight + 1);

    lines.forEach((line, lineIndex) => {
      ensureSpace(lineHeight);
      const baseline = cursorY - size;
      if (lineIndex === 0) {
        if (block.ordered) {
          addText(block.marker, MARGIN_X + 1, baseline, {
            size: 9.8,
            bold: true,
            color: COLORS.blue,
          });
        } else {
          add(createFilledRect(MARGIN_X + 4, baseline + 3.2, 3.8, 3.8, COLORS.blue));
        }
      }
      addText(line, textX, baseline, { size, color: COLORS.navy });
      cursorY -= lineHeight;
    });
    cursorY -= 2;
  };

  const renderQuote = (text) => {
    const size = 9.7;
    const lineHeight = 15.2;
    const inset = 15;
    const lines = wrapText(text, CONTENT_WIDTH - inset * 2, size);
    const height = lines.length * lineHeight + 18;

    if (height > PAGE_HEIGHT - 150) {
      renderParagraph(text);
      return;
    }

    ensureSpace(height + 7);
    cursorY -= 4;
    const bottom = cursorY - height;
    add(createFilledRect(MARGIN_X, bottom, CONTENT_WIDTH, height, COLORS.blueSoft));
    add(createFilledRect(MARGIN_X, bottom, 3.5, height, COLORS.blue));
    let textY = cursorY - 9 - size;
    lines.forEach((line) => {
      addText(line, MARGIN_X + inset, textY, {
        size,
        color: COLORS.slate,
      });
      textY -= lineHeight;
    });
    cursorY = bottom - 8;
  };

  const getColumnWidths = (columnCount) => {
    if (columnCount <= 1) return [CONTENT_WIDTH];
    if (columnCount === 2) return [CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.72];
    if (columnCount === 3) {
      return [CONTENT_WIDTH * 0.24, CONTENT_WIDTH * 0.38, CONTENT_WIDTH * 0.38];
    }
    return Array.from({ length: columnCount }, () => CONTENT_WIDTH / columnCount);
  };

  const renderTable = (block) => {
    const columnCount = Math.max(
      block.header.length,
      ...block.rows.map((row) => row.length),
      1,
    );
    const widths = getColumnWidths(columnCount);
    const fontSize = columnCount >= 4 ? 8.1 : 8.8;
    const lineHeight = columnCount >= 4 ? 11.4 : 12.4;
    const paddingX = 5.5;
    const paddingY = 5;

    const prepareRow = (row, bold = false) => {
      const cells = Array.from({ length: columnCount }, (_, index) =>
        wrapText(row[index] || "", widths[index] - paddingX * 2, fontSize, bold),
      );
      return {
        cells,
        height: Math.max(...cells.map((cell) => cell.length), 1) * lineHeight + paddingY * 2,
      };
    };

    const header = prepareRow(block.header, true);
    const rows = block.rows.map((row) => prepareRow(row));

    const drawRow = (row, { headerRow = false, alternate = false } = {}) => {
      const rowBottom = cursorY - row.height;
      let x = MARGIN_X;

      row.cells.forEach((cellLines, cellIndex) => {
        if (headerRow) {
          add(createFilledRect(x, rowBottom, widths[cellIndex], row.height, COLORS.bluePale));
        } else if (alternate) {
          add(createFilledRect(x, rowBottom, widths[cellIndex], row.height, COLORS.blueSoft));
        }
        add(createStrokedRect(x, rowBottom, widths[cellIndex], row.height, COLORS.border, 0.55));

        let textY = cursorY - paddingY - fontSize;
        cellLines.forEach((line) => {
          addText(line, x + paddingX, textY, {
            size: fontSize,
            bold: headerRow,
            color: headerRow ? COLORS.blueDark : COLORS.navy,
          });
          textY -= lineHeight;
        });
        x += widths[cellIndex];
      });

      cursorY = rowBottom;
    };

    ensureSpace(header.height + (rows[0]?.height || 0) + 8);
    drawRow(header, { headerRow: true });

    rows.forEach((row, rowIndex) => {
      if (cursorY - row.height < CONTENT_BOTTOM) {
        startPage(false);
        drawRow(header, { headerRow: true });
      }
      drawRow(row, { alternate: rowIndex % 2 === 1 });
    });
    cursorY -= 10;
  };

  startPage(true);

  addText("BAOYAN PILOT", MARGIN_X, cursorY, {
    size: 9,
    bold: true,
    color: COLORS.blue,
  });
  const mastheadRight = "AI 院校推荐 · 正式规划报告";
  addText(
    mastheadRight,
    PAGE_WIDTH - MARGIN_X - measureText(mastheadRight, 8.6),
    cursorY,
    { size: 8.6, color: COLORS.muted },
  );
  add(createLine(MARGIN_X, cursorY - 12, PAGE_WIDTH - MARGIN_X, cursorY - 12, COLORS.border));

  cursorY -= 59;
  const titleWidth = measureText(REPORT_TITLE, 22, true);
  addText(REPORT_TITLE, (PAGE_WIDTH - titleWidth) / 2, cursorY, {
    size: 22,
    bold: true,
    color: COLORS.navy,
  });
  cursorY -= 26;
  const subtitle = "个性化保研择校与申请路径建议";
  addText(subtitle, (PAGE_WIDTH - measureText(subtitle, 10.2)) / 2, cursorY, {
    size: 10.2,
    color: COLORS.muted,
  });

  cursorY -= 35;
  const dateText = `导出日期  ${formatChineseDate(generatedAt)}`;
  const useText = "报告用途  保研择校规划参考";
  addText(dateText, MARGIN_X + 10, cursorY, { size: 9.4, color: COLORS.slate });
  addText(
    useText,
    PAGE_WIDTH - MARGIN_X - 10 - measureText(useText, 9.4),
    cursorY,
    { size: 9.4, color: COLORS.slate },
  );

  cursorY -= 24;
  const disclaimerSize = 9.2;
  const disclaimerLineHeight = 14.4;
  const disclaimerLines = wrapText(
    REPORT_DISCLAIMER,
    CONTENT_WIDTH - 30,
    disclaimerSize,
  );
  const disclaimerHeight = disclaimerLines.length * disclaimerLineHeight + 19;
  const disclaimerBottom = cursorY - disclaimerHeight;
  add(createFilledRect(MARGIN_X, disclaimerBottom, CONTENT_WIDTH, disclaimerHeight, COLORS.blueSoft));
  add(createFilledRect(MARGIN_X, disclaimerBottom, 3.5, disclaimerHeight, COLORS.blue));
  let disclaimerY = cursorY - 10 - disclaimerSize;
  disclaimerLines.forEach((line) => {
    addText(line, MARGIN_X + 15, disclaimerY, {
      size: disclaimerSize,
      color: COLORS.slate,
    });
    disclaimerY -= disclaimerLineHeight;
  });
  cursorY = disclaimerBottom - 12;

  blocks.forEach((block) => {
    switch (block.type) {
      case "heading":
        renderHeading(block);
        break;
      case "paragraph":
        renderParagraph(block.text);
        break;
      case "listItem":
        renderListItem(block);
        break;
      case "quote":
        renderQuote(block.text);
        break;
      case "table":
        renderTable(block);
        break;
      case "rule":
        ensureSpace(14);
        cursorY -= 6;
        add(createLine(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY, COLORS.borderLight));
        cursorY -= 8;
        break;
      case "space":
        cursorY -= 3;
        break;
      default:
        break;
    }
  });

  const totalPages = pages.length;
  pages.forEach((pageCommands, index) => {
    pageCommands.push(
      createLine(MARGIN_X, 43, PAGE_WIDTH - MARGIN_X, 43, COLORS.borderLight, 0.5),
    );
    pageCommands.push(
      createTextCommand("BAOYAN PILOT · 保研规划参考", MARGIN_X, 25, {
        size: 8,
        color: COLORS.muted,
      }),
    );
    const pageNumber = `第 ${index + 1} / ${totalPages} 页`;
    pageCommands.push(
      createTextCommand(
        pageNumber,
        PAGE_WIDTH - MARGIN_X - measureText(pageNumber, 8),
        25,
        { size: 8, color: COLORS.muted },
      ),
    );
  });

  return pages.map((commands) => commands.join(""));
}

function encodePdfObjects(objects) {
  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n% BaoyanPilot formal report\n";
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

export function createRecommendationPdfBlob({ content, generatedAt } = {}) {
  const sanitizedContent = sanitizeRecommendationReportContent(content);
  const pages = createReportPages(sanitizedContent, generatedAt);
  const contentStartId = 8;
  const pageStartId = contentStartId + pages.length;
  const pageIds = pages.map((_, index) => pageStartId + index);
  const objects = [];

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[2] =
    "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>";
  objects[3] =
    "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>";
  objects[4] =
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 5 >> /FontDescriptor 4 0 R /DW 1000 >>";
  objects[5] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[6] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  pages.forEach((stream, index) => {
    const streamLength = new TextEncoder().encode(stream).length;
    objects[contentStartId - 1 + index] =
      `<< /Length ${streamLength} >>\nstream\n${stream}endstream`;
  });

  pages.forEach((_, index) => {
    const contentId = contentStartId + index;
    objects[pageStartId - 1 + index] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /ProcSet [/PDF /Text] /Font << /F1 3 0 R /F2 6 0 R /F3 7 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`;
  });

  return new Blob([encodePdfObjects(objects)], { type: "application/pdf" });
}

function sanitizeFileName(value) {
  return String(value || "BaoyanPilot 保研院校梯度规划报告")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 48);
}

export function isRecommendationReportContent(content) {
  const value = sanitizeRecommendationReportContent(content);
  const hasReportFrame =
    value.includes("保研院校梯度规划报告") ||
    value.includes("当前保研画像") ||
    value.includes("用户信息核验摘要");
  const hasTiers =
    (value.includes("冲：") || value.includes("冲刺院校") || value.includes("冲刺")) &&
    (value.includes("稳：") || value.includes("稳妥") || value.includes("匹配院校")) &&
    (value.includes("保：") || value.includes("保底") || value.includes("保障院校"));
  const hasRiskNotice =
    value.includes("仅供规划参考") ||
    value.includes("官网最新通知") ||
    value.includes("风险说明");
  return hasReportFrame && hasTiers && hasRiskNotice;
}

export function downloadRecommendationPdf({ content, title }) {
  const blob = createRecommendationPdfBlob({ content });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${sanitizeFileName(title)}-${dateStamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
