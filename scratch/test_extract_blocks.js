const pageWidth = 612;
const pageHeight = 792;

const processedLines = [
  // Col 1
  { text: "For much of the past decade, the promise", x: 36, y: 650, w: 170, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 650, w: 170, h: 9.5 } },
  { text: "of distributed ledger technology in capital", x: 36, y: 638, w: 168, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 638, w: 168, h: 9.5 } },
  { text: "markets existed in a state of permanent", x: 36, y: 626, w: 165, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 626, w: 165, h: 9.5 } },
  { text: "anticipation. Industry-wide proofs of concept", x: 36, y: 614, w: 172, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 614, w: 172, h: 9.5 } },
  { text: "came and went. Consortiums formed and, in", x: 36, y: 602, w: 169, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 602, w: 169, h: 9.5 } },
  { text: "some cases, dissolved. The gap between the", x: 36, y: 590, w: 167, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 590, w: 167, h: 9.5 } },
  { text: "aspiration of programmable, always-on, atomic", x: 36, y: 578, w: 173, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 578, w: 173, h: 9.5 } },
  { text: "settlement and the operational reality of legacy", x: 36, y: 566, w: 170, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 566, w: 170, h: 9.5 } },
  { text: "infrastructure narrowed slowly—if at all.", x: 36, y: 554, w: 155, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 554, w: 155, h: 9.5 } },

  // Col 2
  { text: "legislation, notably the US GENIUS Act, has", x: 236, y: 650, w: 170, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 236, y: 650, w: 170, h: 9.5 } },
  { text: "begun to provide the regulatory clarity that", x: 236, y: 638, w: 168, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 236, y: 638, w: 168, h: 9.5 } },
  { text: "institutional market participants required before", x: 236, y: 626, w: 172, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 236, y: 626, w: 172, h: 9.5 } },
  { text: "committing resources at scale.", x: 236, y: 614, w: 110, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 236, y: 614, w: 110, h: 9.5 } }
];

    const topWideSpans = [];
    const bottomWideSpans = [];
    const columnLineCandidates = [];

    for (const line of processedLines) {
      if (line.w > pageWidth * 0.56) {
        if (line.y > pageHeight * 0.55) {
          topWideSpans.push(line);
        } else {
          bottomWideSpans.push(line);
        }
      } else {
        columnLineCandidates.push(line);
      }
    }

    const columns = [];
    const sortedCandidates = [...columnLineCandidates].sort((a, b) => a.x - b.x);

    for (const line of sortedCandidates) {
      let matchedCol = null;
      for (const col of columns) {
        const isLeftAligned = Math.abs(line.x - col.minX) < 40;
        const colOverlap = Math.min(col.maxX, line.x + line.w) - Math.max(col.minX, line.x);
        if (isLeftAligned || colOverlap > 12) {
          matchedCol = col;
          break;
        }
      }

      if (matchedCol) {
        matchedCol.lines.push(line);
        matchedCol.minX = Math.min(matchedCol.minX, line.x);
        matchedCol.maxX = Math.max(matchedCol.maxX, line.x + line.w);
      } else {
        columns.push({
          minX: line.x,
          maxX: line.x + line.w,
          lines: [line]
        });
      }
    }

    columns.sort((a, b) => a.minX - b.minX);
    for (const col of columns) {
      col.lines.sort((a, b) => b.y - a.y);
    }
    topWideSpans.sort((a, b) => b.y - a.y);
    bottomWideSpans.sort((a, b) => b.y - a.y);

    const orderedLines = [
      ...topWideSpans,
      ...columns.flatMap(col => col.lines),
      ...bottomWideSpans
    ];

console.log("Columns found:", columns.length);
columns.forEach((c, idx) => console.log(`Col ${idx+1}: minX=${c.minX}, maxX=${c.maxX}, lines=${c.lines.length}`));

let blocks = [];
let currentParagraphLines = [];

function flushParagraph() {
  if (currentParagraphLines.length === 0) return;
  const mergedText = currentParagraphLines.map(l => l.text).join(' ');
  blocks.push({
    text: mergedText,
    lineCount: currentParagraphLines.length,
    box: {
      x: Math.min(...currentParagraphLines.map(l => l.box.x)),
      y: Math.min(...currentParagraphLines.map(l => l.box.y)),
      w: Math.max(...currentParagraphLines.map(l => l.box.x + l.box.w)) - Math.min(...currentParagraphLines.map(l => l.box.x)),
      h: Math.max(...currentParagraphLines.map(l => l.box.y + l.box.h)) - Math.min(...currentParagraphLines.map(l => l.box.y)),
    }
  });
  currentParagraphLines = [];
}

    for (let i = 0; i < orderedLines.length; i++) {
      const lineObj = orderedLines[i];
      if (currentParagraphLines.length > 0) {
        const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
        const lineGap = prevLine.y - lineObj.y;
        const avgH = (prevLine.h + lineObj.h) / 2;
        const fontDiff = Math.abs(prevLine.fontSize - lineObj.fontSize);
        const xOffset = Math.abs(prevLine.x - lineObj.x);

        const prevText = prevLine.text.trim();
        const currText = lineObj.text.trim();

        const prevEndsWithTerminal = /[\.\?!。？！:：]$/.test(prevText);
        const prevEndsWithHyphen = /[-—]\s*$/.test(prevText);
        const currStartsWithLower = /^[a-z]/.test(currText);
        const currIsListItem = /^([-*•·]|(?:\d+|[a-zA-Z])[\.)])\s+/.test(currText);
        const isHeaderStyleChange = fontDiff > 2.2 || (prevLine.isBold !== lineObj.isBold && (prevText.length < 50 || currText.length < 50));
        const isColumnJump = (lineGap < -5) || (xOffset > 60);

        let shouldBreak = false;

        if (isColumnJump || isHeaderStyleChange || currIsListItem) {
          shouldBreak = true;
        } else if (prevEndsWithHyphen || currStartsWithLower) {
          shouldBreak = (lineGap > avgH * 3.2);
        } else if (!prevEndsWithTerminal) {
          shouldBreak = (lineGap > avgH * 2.4);
        } else {
          shouldBreak = (lineGap > avgH * 1.85) || (lineObj.x - prevLine.x > 14);
        }

        if (shouldBreak) {
          flushParagraph();
        }
      }

      currentParagraphLines.push(lineObj);
    }
flushParagraph();

console.log("Blocks produced:", blocks.length);
blocks.forEach((b, i) => console.log(`Block ${i+1} (${b.lineCount} lines, box=${JSON.stringify(b.box)}): ${b.text.slice(0, 60)}...`));
