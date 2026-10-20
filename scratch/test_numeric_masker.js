import { maskNumericEntities, unmaskNumericEntities, maskBioEntities, unmaskBioEntities } from '../server/engine/entity_masker.js';

const sample = 'The sample was stored at -20 °C to -80 °C. The concentration was 3.2×10⁻⁵ M, while another had 10⁻⁴ with tolerance ±0.5 mg/L and p < 0.05. Also check -15.4% drop.';

console.log('Original:', sample);

const { maskedText, tokenMap } = maskBioEntities(sample);
console.log('Masked:', maskedText);
console.log('Tokens:', Array.from(tokenMap.entries()));

// Simulate LLM translation preserving tokens:
let simulatedTranslation = maskedText.replace('The sample was stored at', '样品保存在')
  .replace('The concentration was', '其浓度为')
  .replace('M, while another had', 'M，而另一个为')
  .replace('with tolerance', '公差为')
  .replace('and', '且')
  .replace('Also check', '另外检查')
  .replace('drop.', '下降。');

console.log('Simulated translation with tokens:', simulatedTranslation);
const restored = unmaskBioEntities(simulatedTranslation, tokenMap);
console.log('Restored:', restored);

if (restored === '样品保存在 -20 °C to -80 °C。其浓度为 3.2×10⁻⁵ M，而另一个为 10⁻⁴ 公差为 ±0.5 mg/L 且 p < 0.05。另外检查 -15.4% 下降。') {
  console.log('TEST PASSED 100%');
} else {
  console.log('TEST RESULT MISMATCH');
}
