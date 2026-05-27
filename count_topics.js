const fs = require('fs');
const content = fs.readFileSync('src/domains/inspection/services/AnnualPlanService.ts', 'utf-8');

// Extract CURRICULUM object
const curriculumMatch = content.match(/const CURRICULUM.*?^}/ms);
if (!curriculumMatch) {
  console.error('Could not find CURRICULUM');
  process.exit(1);
}

const curriculum = curriculumMatch[0];

// Count topics per grade
[9, 10, 11, 12].forEach(grade => {
  const gradeMatch = curriculum.match(new RegExp(`${grade}:\s*\[(.*?)\]`, 's'));
  if (gradeMatch) {
    const topics = gradeMatch[1].match(/'[^']+'/g);
    console.log(`Grade ${grade}: ${topics ? topics.length : 0} topics`);
  }
});
