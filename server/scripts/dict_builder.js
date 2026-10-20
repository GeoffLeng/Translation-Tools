// 博士级生化多学科多语种术语知识库构建器
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入或内建专业学术词汇
// 每个学科模块覆盖本领域博士/前沿顶刊（Nature/Science/Cell/JACS/Angewandte/Chem Rev/ACS Nano 等）核心高频术语
