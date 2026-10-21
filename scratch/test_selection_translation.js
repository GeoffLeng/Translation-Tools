import http from 'http';
import { matchTerms } from '../src/term_matcher.js';

console.log('Testing matchTerms for selection context...');

// Test 1: exact and context match
const term1 = matchTerms('Western blot analysis was performed', 5, 'biochem');
console.log('Test 1 Western blot:', term1);

const term2 = matchTerms('expression of caspase-3 was measured', 5, 'biochem');
console.log('Test 2 caspase-3 & expression:', term2);

const term3 = matchTerms('Quantitative Easing', 5, 'economics');
console.log('Test 3 Economics:', term3);

console.log('All tests passed!');
