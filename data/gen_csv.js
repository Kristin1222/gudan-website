// 从 poems-data.js 生成 data/poems_50.csv（内容组填写底稿）
const fs = require("fs");
const path = require("path");
const { POEMS, GRADE_LABEL } = require("../frontend/js/poems-data.js");

const TEMPLATE_EXAMPLES = {
  "静夜思": "床前明月光，疑是地上霜。举头望明月，低头思故乡。|明月光:明亮的月光;疑:好像;思故乡:思念家乡|明亮的月光洒在床前，好像地上泛起一层白霜。抬头望天上的明月，低头思念远方的家乡。|以「月」寄托乡愁，语言浅白而情感深挚，是思乡诗的入门典范|借景抒情;月亮意象|举头望明月，低头思故乡",
  "望岳": "岱宗夫如何？齐鲁青未了。|造化钟神秀，阴阳割昏晓。|荡胸生曾云，决眦入归鸟。|会当凌绝顶，一览众山小。|岱宗:泰山别名;夫:语气助词;钟:聚集;割:分|泰山到底怎么样呢？青翠的山色绵延齐鲁大地没有尽头。大自然把神奇秀美都聚集在泰山，山南山北明暗分明。|层层云气升腾令人心胸激荡，睁大眼睛看归巢的飞鸟。终要登上泰山顶峰，俯瞰群山。|青年杜甫的豪情之作，「会当凌绝顶」成为志存高远的千古名句|设问开篇;虚实结合;炼字(钟/割)|会当凌绝顶，一览众山小"
};

const rows = [["诗名","作者","朝代","学段","主题","原文(句间用|分隔)","注释(词:释义;分隔)","译文","赏析(学段适配)","考点","名句(用于检索匹配)","微课"]];
for (const p of POEMS) {
  const tpl = TEMPLATE_EXAMPLES[p.title];
  rows.push([
    p.title, p.author, p.dynasty, GRADE_LABEL[p.grade], p.theme,
    tpl ? tpl.split("|").slice(0, 4).join("|") : p.lines.join("|"),
    tpl ? tpl.split("|")[4] : "待内容组补充",
    tpl ? tpl.split("|")[5] : "待内容组补充",
    tpl ? tpl.split("|")[6] : "待内容组补充",
    tpl ? tpl.split("|")[7] : "待内容组补充",
    p.famous,
    p.lesson ? "已有(二期)" : "规划中"
  ]);
}
const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
// BOM 便于 Excel 直接打开中文
fs.writeFileSync(path.join(__dirname, "poems_50.csv"), "\uFEFF" + csv, "utf-8");
console.log("poems_50.csv 生成完毕，共", rows.length - 1, "首");
