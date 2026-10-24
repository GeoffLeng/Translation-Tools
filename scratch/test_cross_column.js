const col1LastLine = {
  text: "have moved tokenization strategies from pilot to production. Simultaneously, stablecoin",
  x: 36, y: 554, w: 170, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 36, y: 554, w: 170, h: 9.5 }
};

const col2FirstLine = {
  text: "legislation, notably the US GENIUS Act, has begun to provide the regulatory clarity",
  x: 236, y: 650, w: 170, h: 9.5, fontSize: 9.5, isBold: false, box: { x: 236, y: 650, w: 170, h: 9.5 }
};

const prevText = col1LastLine.text.trim();
const currText = col2FirstLine.text.trim();

const prevEndsWithTerminal = /[\.\?!。？！:：]$/.test(prevText);
const currStartsWithLower = /^[a-z]/.test(currText);
const prevEndsWithHyphen = /[-—]\s*$/.test(prevText);

console.log("prevEndsWithTerminal:", prevEndsWithTerminal); // false
console.log("currStartsWithLower:", currStartsWithLower);   // true

const isCrossColumnContinuation = !prevEndsWithTerminal && (currStartsWithLower || prevEndsWithHyphen);
console.log("isCrossColumnContinuation:", isCrossColumnContinuation); // true!
