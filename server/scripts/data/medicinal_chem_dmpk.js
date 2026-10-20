// 模块 7: 药物化学、成药性与药代动力学 (Medicinal Chemistry, PROTAC & DMPK)
export const medicinalChemDmpkTerms = [
  {
    en: "Structure-activity relationship",
    zh: "构效关系",
    abbr: "SAR",
    category: "药物化学/先导化合物优化",
    otherLangs: { de: "Struktur-Wirkungs-Beziehung", fr: "relation structure-activité" }
  },
  {
    en: "Quantitative structure-activity relationship",
    zh: "定量构效关系",
    abbr: "QSAR",
    category: "药物化学/计算化学",
    otherLangs: { de: "Quantitative Struktur-Wirkungs-Beziehung" }
  },
  {
    en: "Pharmacophore",
    zh: "药效团 (产生活性的关键三维电子拓扑结构)",
    abbr: "Pharmacophore",
    category: "药物设计/计算模拟",
    otherLangs: { de: "Pharmakophor", fr: "pharmacophore" }
  },
  {
    en: "Bioisostere",
    zh: "生物电子等排体 (如四唑替代羧酸、氟原子替代氢)",
    abbr: "Bioisostere",
    category: "药物化学/分子改造",
    otherLangs: { de: "Bioisoster", fr: "bioisostère" }
  },
  {
    en: "Lipinski's rule of five",
    zh: "利平斯基五规则 (口服小分子药物类药性规则)",
    abbr: "Ro5",
    category: "药物化学/成药性评估",
    otherLangs: { de: "Lipinski-Regel" }
  },
  {
    en: "Ligand efficiency",
    zh: "配体效率 (每个重原子结合自由能贡献)",
    abbr: "LE",
    category: "药物设计/先导化合物筛选",
    otherLangs: { de: "Liganden-Effizienz" }
  },
  {
    en: "Lipophilic ligand efficiency",
    zh: "亲脂性配体效率",
    abbr: "LLE",
    category: "药物设计/优化指数",
    otherLangs: { de: "Lipophile Liganden-Effizienz" }
  },
  {
    en: "Partition coefficient",
    zh: "油水分配系数 (正辛醇/水中中性分子分配比 logP)",
    abbr: "logP",
    category: "药物化学/物理化学常数",
    otherLangs: { de: "Verteilungskoeffizient", fr: "coefficient de partage" }
  },
  {
    en: "Distribution coefficient",
    zh: "表观油水分布系数 (特定pH下离子与中性分子总分配比 logD)",
    abbr: "logD",
    category: "物理化学/酸碱平衡",
    otherLangs: { de: "Distributionskoeffizient" }
  },
  {
    en: "Topological polar surface area",
    zh: "拓扑极性表面积 (膜通透性预测参数)",
    abbr: "tPSA",
    category: "药物化学/成药性参数",
    otherLangs: { de: "Topologische polare Oberfläche" }
  },
  {
    en: "Absorption, distribution, metabolism, excretion, and toxicity",
    zh: "吸收、分布、代谢、排泄与毒性 (成药性五要素)",
    abbr: "ADMET",
    category: "药理学与药物开发/临床前评价",
    otherLangs: { de: "ADMET-Eigenschaften" }
  },
  {
    en: "Bioavailability",
    zh: "生物利用度 (口服进入体循环的活性药物比例 F)",
    abbr: "F (%)",
    category: "药代动力学/吸收指标",
    otherLangs: { de: "Bioverfügbarkeit", fr: "biodisponibilité" }
  },
  {
    en: "Clearance",
    zh: "清除率 (单位时间内机体清除药物的血浆容积 CL)",
    abbr: "CL",
    category: "药代动力学/消除指标",
    otherLangs: { de: "Clearance", fr: "clairance" }
  },
  {
    en: "Volume of distribution",
    zh: "表观分布容积 (反映组织摄取深度的假想容积 Vd)",
    abbr: "Vd",
    category: "药代动力学/分布指标",
    otherLangs: { de: "Verteilungsvolumen", fr: "volume de distribution" }
  },
  {
    en: "Half-life",
    zh: "消除半衰期 (血药浓度下降一半所需时间 t1/2)",
    abbr: "t1/2",
    category: "药代动力学/关键参数",
    otherLangs: { de: "Halbwertszeit", fr: "demi-vie" }
  },
  {
    en: "Area under the curve",
    zh: "血药浓度-时间曲线下面积 (总全身药物暴露量 AUC)",
    abbr: "AUC",
    category: "药代动力学/暴露量测定",
    otherLangs: { de: "Fläche unter der Kurve", fr: "aire sous la courbe" }
  },
  {
    en: "Maximum plasma concentration",
    zh: "峰浓度 (最高血药浓度 Cmax)",
    abbr: "Cmax",
    category: "药代动力学/浓度参数",
    otherLangs: { de: "Maximale Plasmakonzentration" }
  },
  {
    en: "Time to maximum concentration",
    zh: "达峰时间 (达到峰浓度所需时间 Tmax)",
    abbr: "Tmax",
    category: "药代动力学/吸收速度",
    otherLangs: { de: "Zeit bis zur Maximalkonzentration" }
  },
  {
    en: "Cytochrome P450",
    zh: "细胞色素P450酶系 (肝脏微粒体核心药物代谢单加氧酶)",
    abbr: "CYP450",
    category: "药物代谢动力学/I相代谢",
    otherLangs: { de: "Cytochrom P450" }
  },
  {
    en: "P-glycoprotein",
    zh: "P-糖蛋白 (ATP依赖性药物外排泵，多药耐药主因)",
    abbr: "P-gp",
    category: "跨膜转运体/血脑屏障",
    otherLangs: { de: "P-Glykoprotein" }
  },
  {
    en: "Human ether-a-go-go related gene",
    zh: "hERG钾离子通道 (心脏QT间期延长与心律失常致死靶点)",
    abbr: "hERG",
    category: "心脏电生理/早期心脏毒性评价",
    otherLangs: { de: "hERG-Kaliumkanal" }
  },
  {
    en: "Proteolysis-targeting chimera",
    zh: "蛋白降解靶向嵌合体 (双功能小分子降解剂 PROTAC)",
    abbr: "PROTAC",
    category: "靶向蛋白降解/前沿药物化学生物学",
    otherLangs: { de: "Proteolyse-zielende Chimäre" }
  },
  {
    en: "Molecular glue",
    zh: "分子胶 (诱导泛素连接酶新形态降解底物的小分子)",
    abbr: "Molecular Glue",
    category: "靶向蛋白降解/分子胶技术",
    otherLangs: { de: "Molekularer Klebstoff" }
  },
  {
    en: "E3 ubiquitin ligase",
    zh: "E3泛素连接酶 (如CRBN, VHL, MDM2, c-IAP)",
    abbr: "E3 Ligase",
    category: "泛素降解系统/药物靶向载体",
    otherLangs: { de: "E3-Ubiquitin-Ligase" }
  },
  {
    en: "Von Hippel-Lindau protein",
    zh: "VHL肿瘤抑制蛋白 (PROTAC招募常用E3连接酶底物受体)",
    abbr: "VHL",
    category: "泛素化系统/PROTAC靶标",
    otherLangs: { de: "Von-Hippel-Lindau-Protein" }
  },
  {
    en: "Cereblon",
    zh: "沙利度胺结合蛋白 (沙利度胺及其类似物靶向的E3适配器)",
    abbr: "CRBN",
    category: "免疫调节药物靶标/分子胶中枢",
    otherLangs: { de: "Cereblon" }
  },
  {
    en: "Ternary complex",
    zh: "三元复合物 (靶蛋白-小分子-E3连接酶空间交联复合物)",
    abbr: "Ternary Complex",
    category: "化学生物学/PROTAC动力学",
    otherLangs: { de: "Ternärer Komplex" }
  },
  {
    en: "Hook effect",
    zh: "钩状效应 (双功能PROTAC高浓度下二元抑制自竞争现象)",
    abbr: "Hook Effect",
    category: "药效动力学/双相反应",
    otherLangs: { de: "Hook-Effekt" }
  },
  {
    en: "Half maximal inhibitory concentration",
    zh: "半数抑制浓度 (IC50)",
    abbr: "IC50",
    category: "药效动力学/体外活性定量",
    otherLangs: { de: "Mittlere inhibitorische Konzentration", fr: "concentration inhibitrice semi-maximale" }
  },
  {
    en: "Half maximal effective concentration",
    zh: "半数有效浓度 (EC50)",
    abbr: "EC50",
    category: "药效动力学/效应强度",
    otherLangs: { de: "Mittlere effektive Konzentration", fr: "concentration efficace médiane" }
  }
];
