import { loadAllTerms, addCustomTerm } from '../server/engine/term_matcher.js';

console.log('Testing server term matcher...');
const biochemTerms = loadAllTerms('biochem');
console.log('Total biochem terms count:', Object.keys(biochemTerms).length);
console.log('Western blot entry:', biochemTerms['western blot']);
console.log('expression entry:', biochemTerms['expression']);

const econTerms = loadAllTerms('economics');
console.log('Total economics terms count:', Object.keys(econTerms).length);
console.log('Quantitative Easing entry:', econTerms['quantitative easing']);
