const dateStr = "2026-05-01";
const d = new Date(dateStr);
console.log(`Input: ${dateStr}`);
console.log(`Month (0-indexed): ${d.getMonth()}`);
console.log(`Year: ${d.getFullYear()}`);
console.log(`Full ISO: ${d.toISOString()}`);

const [y, m, day] = dateStr.split('-').map(Number);
console.log(`Manual Split -> Month: ${m-1}, Year: ${y}`);
