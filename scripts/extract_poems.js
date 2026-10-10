// 把 poems-data.js 里的 POEMS 数组输出为 JSON
const path = require('path');
const fs = require('fs');

// 加载源文件（用 eval 在函数作用域里执行）
const src = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'js', 'poems-data.js'),
  'utf8'
);
// 把 module.exports 兼容写法剥离
const code = src
  .replace(/^const /m, 'global.POEMS_OBJ = ')
  .replace(/const GRADE_LABEL[\s\S]*$/m, '')
  .replace(/if \(typeof module[\s\S]*$/m, '');

eval(code);

const out = path.join(__dirname, '..', 'data', 'poems_raw.json');
fs.writeFileSync(out, JSON.stringify(global.POEMS_OBJ, null, 2), 'utf8');
console.log(`已导出 ${global.POEMS_OBJ.length} 首到 ${out}`);
