// 经济学、金融学与量化计量前沿权威学术词典 (Economics & Finance Lexicon)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const economicsTerms = [
  // ================= 1. 宏观经济与货币政策 (Macroeconomics & Monetary Policy) =================
  { en: "Gross domestic product", zh: "国内生产总值", abbr: "GDP", category: "宏观经济学/国民账户", otherLangs: { de: "Bruttoinlandsprodukt", fr: "produit intérieur brut" } },
  { en: "Gross national product", zh: "国民生产总值", abbr: "GNP", category: "宏观经济学/国民账户", otherLangs: { de: "Bruttosozialprodukt", fr: "produit national brut" } },
  { en: "Consumer price index", zh: "消费者价格指数", abbr: "CPI", category: "宏观经济学/通货膨胀", otherLangs: { de: "Verbraucherpreisindex", fr: "indice des prix à la consommation" } },
  { en: "Producer price index", zh: "生产者物价指数", abbr: "PPI", category: "宏观经济学/价格指数", otherLangs: { de: "Erzeugerpreisindex" } },
  { en: "Quantitative easing", zh: "量化宽松货币政策", abbr: "QE", category: "货币银行学/非常规货币政策", otherLangs: { de: "Quantitative Lockerung", fr: "assouplissement quantitatif" } },
  { en: "Quantitative tightening", zh: "量化紧缩 (缩表)", abbr: "QT", category: "货币银行学/货币政策", otherLangs: { de: "Quantitative Straffung" } },
  { en: "Liquidity trap", zh: "流动性陷阱 (凯恩斯流动性偏好陷阱)", abbr: "Liquidity Trap", category: "宏观经济学/货币理论", otherLangs: { de: "Liquiditätsfalle", fr: "trappe à liquidité" } },
  { en: "Phillips curve", zh: "菲利普斯曲线 (通胀率与失业率交替关系)", abbr: "Phillips Curve", category: "宏观经济学/通胀理论", otherLangs: { de: "Phillips-Kurve", fr: "courbe de Phillips" } },
  { en: "Stagflation", zh: "滞胀 (停滞性通货膨胀)", abbr: "Stagflation", category: "宏观经济学/经济周期", otherLangs: { de: "Stagflation", fr: "stagflation" } },
  { en: "Fiscal multiplier", zh: "财政乘数", abbr: "Fiscal Multiplier", category: "宏观经济学/财政政策", otherLangs: { de: "Fiskalmultiplikator", fr: "multiplicateur budgétaire" } },
  { en: "Open market operations", zh: "公开市场业务", abbr: "OMO", category: "中央银行学/货币工具", otherLangs: { de: "Offenmarktgeschäfte", fr: "opérations d'open market" } },
  { en: "Reserve requirement ratio", zh: "法定存款准备金率", abbr: "RRR", category: "货币金融学/货币政策", otherLangs: { de: "Mindestreservesatz" } },
  { en: "Purchasing power parity", zh: "购买力平价理论", abbr: "PPP", category: "国际金融学/汇率决定", otherLangs: { de: "Kaufkraftparität", fr: "parité de pouvoir d'achat" } },
  { en: "Interest rate parity", zh: "利率平价理论", abbr: "IRP", category: "国际金融学/汇率决定", otherLangs: { de: "Zinsparitätentheorie" } },
  { en: "Current account deficit", zh: "经常账户赤字", abbr: "CAD", category: "国际金融学/国际收支", otherLangs: { de: "Leistungsbilanzdefizit" } },
  { en: "Non-performing loan", zh: "不良贷款", abbr: "NPL", category: "商业银行学/信贷风险", otherLangs: { de: "Notleidender Kredit" } },

  // ================= 2. 微观经济与博弈论 (Microeconomics & Game Theory) =================
  { en: "Nash equilibrium", zh: "纳什均衡", abbr: "Nash Eq.", category: "博弈论/非合作博弈", otherLangs: { de: "Nash-Gleichgewicht", fr: "équilibre de Nash" } },
  { en: "Pareto optimality", zh: "帕累托最优 (帕累托效率)", abbr: "Pareto Efficiency", category: "福利经济学/资源配置", otherLangs: { de: "Pareto-Optimum", fr: "optimum de Pareto" } },
  { en: "Adverse selection", zh: "逆向选择 (事前信息不对称)", abbr: "Adverse Selection", category: "信息经济学/市场失灵", otherLangs: { de: "Adverse Selektion", fr: "sélection adverse" } },
  { en: "Moral hazard", zh: "道德风险 (事后信息不对称)", abbr: "Moral Hazard", category: "信息经济学/契约理论", otherLangs: { de: "Moralisches Risiko", fr: "aléa moral" } },
  { en: "Principal-agent problem", zh: "委托-代理问题", abbr: "Agency Problem", category: "契约理论与公司治理", otherLangs: { de: "Prinzipal-Agent-Problem" } },
  { en: "Deadweight loss", zh: "无谓损失 (社会净福利损失)", abbr: "DWL", category: "微观经济学/市场效率", otherLangs: { de: "Wohlfahrtsverlust", fr: "perte sèche" } },
  { en: "Marginal rate of substitution", zh: "边际替代率", abbr: "MRS", category: "消费者行为理论", otherLangs: { de: "Grenzrate der Substitution" } },
  { en: "Marginal cost", zh: "边际成本", abbr: "MC", category: "微观经济学/厂商理论", otherLangs: { de: "Grenzkosten", fr: "coût marginal" } },
  { en: "Marginal revenue", zh: "边际收益", abbr: "MR", category: "微观经济学/厂商理论", otherLangs: { de: "Grenzerlös", fr: "recette marginale" } },
  { en: "Opportunity cost", zh: "机会成本", abbr: "Opp. Cost", category: "经济学基础/资源权衡", otherLangs: { de: "Opportunitätskosten", fr: "coût d'opportunité" } },
  { en: "Externality", zh: "外部性 (正外部性与负外部性)", abbr: "Externality", category: "环境经济学/市场失灵", otherLangs: { de: "Externalität", fr: "externalité" } },
  { en: "Tragedy of the commons", zh: "公地悲剧", abbr: "Tragedy of Commons", category: "产权经济学/公共品", otherLangs: { de: "Tragik der Allmende" } },
  { en: "Prisoner's dilemma", zh: "囚徒困境", abbr: "Prisoner's Dilemma", category: "博弈论/经典模型", otherLangs: { de: "Gefangenendilemma", fr: "dilemme du prisonnier" } },

  // ================= 3. 资产定价与金融工程 (Asset Pricing & Financial Engineering) =================
  { en: "Capital asset pricing model", zh: "资本资产定价模型", abbr: "CAPM", category: "金融学/资产定价", otherLangs: { de: "Capital Asset Pricing Model" } },
  { en: "Black-Scholes model", zh: "布莱克-斯科尔斯期权定价模型", abbr: "B-S Model", category: "金融工程/衍生品定价", otherLangs: { de: "Black-Scholes-Modell" } },
  { en: "Arbitrage pricing theory", zh: "套利定价理论", abbr: "APT", category: "金融学/多因子定价", otherLangs: { de: "Arbitragepreistheorie" } },
  { en: "Efficient market hypothesis", zh: "有效市场假说 (弱式/半强式/强式有效)", abbr: "EMH", category: "金融学/市场微观结构", otherLangs: { de: "Markteffizienzhypothese" } },
  { en: "Discounted cash flow", zh: "现金流折现估值法", abbr: "DCF", category: "公司金融/企业估值", otherLangs: { de: "Discounted-Cash-Flow-Methode" } },
  { en: "Weighted average cost of capital", zh: "加权平均资本成本", abbr: "WACC", category: "公司金融/资本结构", otherLangs: { de: "Gewichtete durchschnittliche Kapitalkosten" } },
  { en: "Earnings before interest, taxes, depreciation, and amortization", zh: "息税折旧摊销前利润", abbr: "EBITDA", category: "财务分析/企业盈利能力", otherLangs: { de: "EBITDA" } },
  { en: "Value at risk", zh: "在险价值 (风险价值度量)", abbr: "VaR", category: "金融风险管理/市场风险", otherLangs: { de: "Value at Risk" } },
  { en: "Sharpe ratio", zh: "夏普比率 (超额收益对总风险比率)", abbr: "Sharpe Ratio", category: "投资组合管理/绩效评价", otherLangs: { de: "Sharpe-Quotient" } },
  { en: "Credit default swap", zh: "信用违约互换", abbr: "CDS", category: "金融衍生品/信用衍生品", otherLangs: { de: "Kreditausfall-Swap" } },
  { en: "Yield curve inversion", zh: "收益率曲线倒挂 (经典衰退前瞻预警指标)", abbr: "Yield Inversion", category: "固定收益证券/利率期限结构", otherLangs: { de: "Invertierte Zinskurve" } },
  { en: "Systemic risk", zh: "系统性风险", abbr: "Systemic Risk", category: "宏观审慎监管/金融稳定", otherLangs: { de: "Systemisches Risiko", fr: "risque systémique" } },
  { en: "Over-the-counter", zh: "场外交易 (柜台交易)", abbr: "OTC", category: "金融市场学/交易机制", otherLangs: { de: "Außerbörslicher Handel" } },
  { en: "High-frequency trading", zh: "高频交易", abbr: "HFT", category: "量化投资/算法交易", otherLangs: { de: "Hochfrequenzhandel" } },
  { en: "Free cash flow to firm", zh: "公司自由现金流", abbr: "FCFF", category: "公司金融/财务估值", otherLangs: { de: "Freier Cashflow für das Unternehmen" } },
  { en: "Free cash flow to equity", zh: "股权自由现金流", abbr: "FCFE", category: "公司金融/股权估值", otherLangs: { de: "Freier Cashflow zum Eigenkapital" } },

  // ================= 4. 计量经济学与实证分析 (Econometrics & Empirical Methods) =================
  { en: "Ordinary least squares", zh: "普通最小二乘法", abbr: "OLS", category: "计量经济学/参数估计", otherLangs: { de: "Methode der kleinsten Quadrate", fr: "moindres carrés ordinaires" } },
  { en: "Instrumental variable", zh: "工具变量法 (解决内生性问题)", abbr: "IV", category: "计量经济学/因果推断", otherLangs: { de: "Instrumentvariable", fr: "variable instrumentale" } },
  { en: "Difference-in-differences", zh: "双重差分法 (因果政策评估模型)", abbr: "DID", category: "实证经济学/政策评估", otherLangs: { de: "Differenz-von-Differenzen-Ansatz" } },
  { en: "Regression discontinuity design", zh: "断点回归设计", abbr: "RDD", category: "微观计量经济学/准实验设计", otherLangs: { de: "Regressions-Diskontinuitäts-Analyse" } },
  { en: "Vector autoregression", zh: "向量自回归模型", abbr: "VAR", category: "时间序列分析/宏观计量", otherLangs: { de: "Vektorautoregressives Modell" } },
  { en: "Generalized method of moments", zh: "广义矩估计", abbr: "GMM", category: "高级计量经济学/半参数估计", otherLangs: { de: "Verallgemeinerte Momentenmethode" } },
  { en: "Autoregressive conditional heteroskedasticity", zh: "自回归条件异方差模型", abbr: "ARCH / GARCH", category: "金融计量经济学/波动率建模", otherLangs: { de: "ARCH-Modell" } },
  { en: "Cointegration", zh: "协整关系 (长期均衡平稳关系)", abbr: "Cointegration", category: "时间序列分析/非平稳序列", otherLangs: { de: "Kointegration", fr: "cointégration" } },
  { en: "Heteroskedasticity", zh: "异方差性", abbr: "Heteroskedasticity", category: "计量经济学/假设检验", otherLangs: { de: "Heteroskedastizität", fr: "hétéroscédasticité" } },
  { en: "Endogeneity", zh: "内生性问题 (遗漏变量、反向因果与测量误差)", abbr: "Endogeneity", category: "计量经济学/因果识别", otherLangs: { de: "Endogenität", fr: "endogénéité" } },
  { en: "Stationarity", zh: "平稳性 (弱平稳与强平稳)", abbr: "Stationarity", category: "时间序列分析/基本性质", otherLangs: { de: "Stationarität", fr: "stationnarité" } }
];

const outputPath = path.join(__dirname, '../data/economics_terms.json');
const termsMap = {};
for (const t of economicsTerms) {
  termsMap[t.en.toLowerCase()] = t;
  if (t.abbr && t.abbr.length >= 2) {
    termsMap[t.abbr.toLowerCase()] = {
      en: t.abbr,
      zh: `${t.zh} (${t.en} 缩写)`,
      abbr: t.abbr,
      category: t.category,
      otherLangs: t.otherLangs || {}
    };
  }
}

const fullOutput = {
  description: "经济学、金融学与量化计量前沿权威学术术语知识库 (遵循 AER、JPE、QJE、Econometrica 顶刊规范)",
  version: "1.0.0",
  updatedAt: new Date().toISOString(),
  totalCount: Object.keys(termsMap).length,
  terms: termsMap
};

fs.writeFileSync(outputPath, JSON.stringify(fullOutput, null, 2), 'utf-8');
console.log(`经济学词库已构建，总词条数: ${Object.keys(termsMap).length}，写入至: ${outputPath}`);
