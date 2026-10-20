// 模块 8: 分析化学、色谱分离与高分辨质谱 (Analytical Chemistry, Chromatography & Mass Spectrometry)
export const analyticalMassSpecTerms = [
  {
    en: "High-performance liquid chromatography",
    zh: "高效液相色谱法",
    abbr: "HPLC",
    category: "分析化学/色谱分离",
    otherLangs: { de: "Hochleistungsflüssigkeitschromatographie", fr: "chromatographie en phase liquide à haute performance" }
  },
  {
    en: "Ultra-high-performance liquid chromatography",
    zh: "超高效液相色谱法",
    abbr: "UHPLC",
    category: "分析化学/超高压色谱",
    otherLangs: { de: "Ultrahochleistungs-Flüssigkeitschromatographie" }
  },
  {
    en: "Reversed-phase chromatography",
    zh: "反相色谱法 (疏水性固定相 C18/C8 分离法)",
    abbr: "RPC",
    category: "分析化学/色谱分离",
    otherLangs: { de: "Umkehrphasenchromatographie", fr: "chromatographie en phase inverse" }
  },
  {
    en: "Hydrophilic interaction liquid chromatography",
    zh: "亲水作用色谱法 (极性化合物保留分离法)",
    abbr: "HILIC",
    category: "分析化学/色谱分离",
    otherLangs: { de: "Hydrophile Interaktionsflüssigkeitschromatographie" }
  },
  {
    en: "Size-exclusion chromatography",
    zh: "体积排阻色谱法 (凝胶过滤/凝胶渗透色谱)",
    abbr: "SEC",
    category: "生物化学分析/大分子纯化",
    otherLangs: { de: "Größenausschlusschromatographie", fr: "chromatographie d'exclusion stérique" }
  },
  {
    en: "Ion-exchange chromatography",
    zh: "离子交换色谱法 (阴离子/阳离子交换)",
    abbr: "IEX",
    category: "生物大分子分离/蛋白质纯化",
    otherLangs: { de: "Ionenaustauschchromatographie", fr: "chromatographie échangeuse d'ions" }
  },
  {
    en: "Immobilized metal affinity chromatography",
    zh: "固定化金属亲和色谱法 (组氨酸标签 His-tag 纯化法)",
    abbr: "IMAC",
    category: "生物化学纯化/重组蛋白",
    otherLangs: { de: "Immobilisierte Metallionen-Affinitätschromatographie" }
  },
  {
    en: "Gas chromatography-mass spectrometry",
    zh: "气相色谱-质谱联用仪",
    abbr: "GC-MS",
    category: "仪器分析/联用技术",
    otherLangs: { de: "Gaschromatographie mit Massenspektrometrie-Kopplung" }
  },
  {
    en: "Liquid chromatography-tandem mass spectrometry",
    zh: "液相色谱-串联质谱联用仪",
    abbr: "LC-MS/MS",
    category: "现代分析/痕量定量",
    otherLangs: { de: "Flüssigchromatographie mit Tandem-Massenspektrometrie" }
  },
  {
    en: "Mass-to-charge ratio",
    zh: "质荷比 (m/z)",
    abbr: "m/z",
    category: "质谱学/基础物理量",
    otherLangs: { de: "Masse-zu-Ladung-Verhältnis", fr: "rapport masse sur charge" }
  },
  {
    en: "Electrospray ionization",
    zh: "电喷雾电离技术 (软电离源)",
    abbr: "ESI",
    category: "质谱技术/离子源",
    otherLangs: { de: "Elektrospray-Ionisation", fr: "ionisation par électronébuliseur" }
  },
  {
    en: "Matrix-assisted laser desorption/ionization",
    zh: "基质辅助激光解吸电离 (软电离源 MALDI)",
    abbr: "MALDI",
    category: "质谱技术/生物大分子质谱",
    otherLangs: { de: "Matrix-unterstützte Laser-Desorption/Ionisation" }
  },
  {
    en: "Time-of-flight mass spectrometry",
    zh: "飞行时间质谱分析仪",
    abbr: "TOF-MS",
    category: "质谱技术/质量分析器",
    otherLangs: { de: "Flugzeitmassenspektrometer", fr: "spectrométrie de masse à temps de vol" }
  },
  {
    en: "Orbitrap mass analyzer",
    zh: "静电场轨道阱质量分析器 (超高分辨轨道阱)",
    abbr: "Orbitrap",
    category: "高分辨质谱/蛋白质组学核心",
    otherLangs: { de: "Orbitrap-Massenanalysator" }
  },
  {
    en: "Fourier transform ion cyclotron resonance",
    zh: "傅里叶变换离子回旋共振质谱 (极限分辨质谱)",
    abbr: "FT-ICR",
    category: "极限高分辨质谱/超高磁场",
    otherLangs: { de: "Fourier-Transformations-Ionenzyklotronresonanz" }
  },
  {
    en: "Triple quadrupole mass spectrometer",
    zh: "三重四极杆质谱仪 (定量金标准仪器)",
    abbr: "QQQ",
    category: "定量质谱/小分子药物定量",
    otherLangs: { de: "Tripel-Quadrupol-Massenspektrometer" }
  },
  {
    en: "Selected reaction monitoring",
    zh: "选择反应监测 (靶向定量扫描模式)",
    abbr: "SRM",
    category: "质谱分析/靶向定量",
    otherLangs: { de: "Selected Reaction Monitoring" }
  },
  {
    en: "Multiple reaction monitoring",
    zh: "多反应监测 (高灵敏串联质谱定量模式)",
    abbr: "MRM",
    category: "药代动力学分析/临床生物分析",
    otherLangs: { de: "Multiple Reaction Monitoring" }
  },
  {
    en: "Parallel reaction monitoring",
    zh: "平行反应监测 (高分辨靶向蛋白质组学定量)",
    abbr: "PRM",
    category: "靶向蛋白质组学/高分辨扫描",
    otherLangs: { de: "Parallel Reaction Monitoring" }
  },
  {
    en: "Data-dependent acquisition",
    zh: "数据依赖性采集 (非靶向打碎 DDA)",
    abbr: "DDA",
    category: "蛋白质组学/发现模式",
    otherLangs: { de: "Datenabhängige Erfassung" }
  },
  {
    en: "Data-independent acquisition",
    zh: "数据非依赖性采集 (全景式打碎 DIA)",
    abbr: "DIA",
    category: "蛋白质组学/全景扫描",
    otherLangs: { de: "Datenunabhängige Erfassung" }
  },
  {
    en: "Tandem mass tag",
    zh: "串联质谱标签 (同量异位化学标记定量技术 TMT)",
    abbr: "TMT",
    category: "定量蛋白质组学/多标技术",
    otherLangs: { de: "Tandem Mass Tag" }
  },
  {
    en: "Stable isotope labeling by amino acids in cell culture",
    zh: "细胞培养中氨基酸稳定同位素标记 (SILAC)",
    abbr: "SILAC",
    category: "蛋白质组学/体内定量",
    otherLangs: { de: "Stabile Isotopenmarkierung durch Aminosäuren" }
  },
  {
    en: "Limit of detection",
    zh: "检出限 (信噪比 S/N=3 下的最低检测浓度)",
    abbr: "LOD",
    category: "分析方法学验证/灵敏度",
    otherLangs: { de: "Nachweisgrenze", fr: "limite de détection" }
  },
  {
    en: "Limit of quantitation",
    zh: "定量限 (信噪比 S/N=10 下可精确定量的最低浓度)",
    abbr: "LOQ",
    category: "分析方法学验证/精密度",
    otherLangs: { de: "Bestimmungsgrenze", fr: "limite de quantification" }
  },
  {
    en: "Internal standard",
    zh: "内标物 (如同位素标记稳定内标 SIL-IS)",
    abbr: "IS",
    category: "定量分析/校正体系",
    otherLangs: { de: "Interner Standard", fr: "étalon interne" }
  },
  {
    en: "Matrix effect",
    zh: "基质效应 (生物基质共流出物对离子化的离子抑制/增强)",
    abbr: "ME",
    category: "生物分析方法验证/质谱干扰",
    otherLangs: { de: "Matrixeffekt", fr: "effet de matrice" }
  },
  {
    en: "Signal-to-noise ratio",
    zh: "信噪比 (S/N比值)",
    abbr: "S/N",
    category: "分析仪器/信号品质",
    otherLangs: { de: "Signal-Rausch-Verhältnis", fr: "rapport signal sur bruit" }
  },
  {
    en: "Capillary electrophoresis",
    zh: "毛细管电泳",
    abbr: "CE",
    category: "分析化学/微分离技术",
    otherLangs: { de: "Kapillarelektrophorese", fr: "électrophorèse capillaire" }
  },
  {
    en: "Inductively coupled plasma mass spectrometry",
    zh: "电感耦合等离子体质谱仪 (超痕量重金属元素分析)",
    abbr: "ICP-MS",
    category: "无机分析化学/元素痕量分析",
    otherLangs: { de: "Massenspektrometrie mit induktiv gekoppeltem Plasma" }
  }
];
