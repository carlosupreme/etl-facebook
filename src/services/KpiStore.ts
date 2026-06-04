import { Platform } from 'react-native'

export interface KpiCategory {
  id: string
  nameKey: string
  icon: string
  order: number
}

export interface KpiDefinition {
  id: string
  name: string
  nameKey: string
  description: string
  descKey: string
  goalKey: string
  icon: string
  formula: string
  goodValue: string
  query: string
  categoryId: string
  targetExpr: string
  createdAt: number
  updatedAt: number
  isCustom: boolean
}

export const DEFAULT_CATEGORIES: KpiCategory[] = [
  { id: 'paid_media', nameKey: 'kpi_builder.categories.paidMedia', icon: 'cash-outline', order: 0 },
  { id: 'health_retention', nameKey: 'kpi_builder.categories.healthRetention', icon: 'heart-outline', order: 1 },
  { id: 'content_community', nameKey: 'kpi_builder.categories.contentCommunity', icon: 'document-text-outline', order: 2 },
  { id: 'production', nameKey: 'kpi_builder.categories.production', icon: 'create-outline', order: 3 },
  { id: 'content', nameKey: 'kpi_builder.categories.content', icon: 'folder-outline', order: 4 },
]

export const DEFAULT_KPIS: KpiDefinition[] = [
  {
    id: 'roas', name: 'Retorno Publicitario', nameKey: 'kpi_catalog.kpis.roas.name',
    description: 'Por cada $1 invertido en anuncios, ¿cuánto recuperás? Menos de 2× significa que tus campañas cuestan más de lo que generan.',
    descKey: 'kpi_catalog.kpis.roas.description',
    goalKey: 'kpi_catalog.kpis.roas.businessGoal', icon: '📈',
    formula: 'Estimated Revenue / Total Spend', goodValue: '> 2.0 (2× return)',
    query: "SELECT ROUND(SUM(CASE c.objective WHEN 'conversions' THEN m.clicks * 5.0 WHEN 'brand_awareness' THEN m.impressions * 0.01 ELSE m.clicks * 2.0 END), 0) AS rev FROM ad_metrics m JOIN ad_campaigns c ON m.campaign_id = c.campaign_id",
    categoryId: 'paid_media', targetExpr: 'value >= 2', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'ctr', name: 'Efectividad del Anuncio', nameKey: 'kpi_catalog.kpis.ctr.name',
    description: '¿Tu anuncio convence a la gente de hacer clic? Menos del 1.5% indica que el mensaje o la imagen no está funcionando. Prueba nuevos creativos.',
    descKey: 'kpi_catalog.kpis.ctr.description',
    goalKey: 'kpi_catalog.kpis.ctr.businessGoal', icon: '🎯',
    formula: 'AVG(clicks × 100 / impressions)', goodValue: '≥ 1.5%',
    query: 'SELECT ROUND(AVG(clicks * 100.0 / NULLIF(impressions, 0)), 2) AS avg FROM ad_metrics WHERE impressions > 0',
    categoryId: 'paid_media', targetExpr: 'value >= 1.5', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'cpc', name: 'Costo por Visita', nameKey: 'kpi_catalog.kpis.cpc.name',
    description: '¿Cuánto pagas cada vez que alguien hace clic en tu anuncio? Si superas $0.50, estás pagando demasiado por tráfico. Revisa segmentación y creativos.',
    descKey: 'kpi_catalog.kpis.cpc.description',
    goalKey: 'kpi_catalog.kpis.cpc.businessGoal', icon: '💲',
    formula: 'SUM(spend) / SUM(clicks)', goodValue: '< $0.50',
    query: 'SELECT ROUND(SUM(spend) / NULLIF(SUM(clicks), 0), 2) AS avg FROM ad_metrics',
    categoryId: 'paid_media', targetExpr: 'value < 0.5', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'cpm', name: 'Costo de Visibilidad', nameKey: 'kpi_catalog.kpis.cpm.name',
    description: '¿Cuánto pagas para que 1,000 personas te vean? Más de $8 es señal de que tu segmentación o creativos necesitan ajuste urgente.',
    descKey: 'kpi_catalog.kpis.cpm.description',
    goalKey: 'kpi_catalog.kpis.cpm.businessGoal', icon: '📊',
    formula: 'AVG(spend × 1000 / impressions)', goodValue: '< $8.00',
    query: 'SELECT ROUND(AVG(spend * 1000.0 / NULLIF(impressions, 0)), 2) AS avg FROM ad_metrics WHERE impressions > 0',
    categoryId: 'paid_media', targetExpr: 'value < 8', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'churnRisk', name: 'Usuarios que se van', nameKey: 'kpi_catalog.kpis.churnRisk.name',
    description: '¿Qué porcentaje de tu audiencia dejó de interactuar en los últimos 6 meses? Más del 10% es crítico — algo está alejando a tu gente. Investiga y actúa.',
    descKey: 'kpi_catalog.kpis.churnRisk.description',
    goalKey: 'kpi_catalog.kpis.churnRisk.businessGoal', icon: '🚪',
    formula: 'Users NOT IN (active in last 6 months)', goodValue: '< 10% of total users',
    query: "SELECT COUNT(*) AS c FROM users WHERE user_id NOT IN (SELECT DISTINCT user_id FROM activity_log WHERE timestamp >= date('now', '-6 months', '+6 years'))",
    categoryId: 'health_retention', targetExpr: 'pct < 10', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'adFatigue', name: 'Anuncios Agotados', nameKey: 'kpi_catalog.kpis.adFatigue.name',
    description: 'Campañas que le mostraron el mismo anuncio demasiadas veces a las mismas personas. Renovalas ya o seguís quemando presupuesto sin resultados.',
    descKey: 'kpi_catalog.kpis.adFatigue.description',
    goalKey: 'kpi_catalog.kpis.adFatigue.businessGoal', icon: '😫',
    formula: 'Campaigns with frequency > 4x', goodValue: '0 campaigns affected',
    query: "SELECT COUNT(*) AS c FROM ad_metrics m CROSS JOIN (SELECT AVG(reach_count) AS r FROM posts WHERE reach_count > 0) p WHERE m.impressions > 0 AND (m.impressions / NULLIF(p.r, 0)) > 4",
    categoryId: 'health_retention', targetExpr: 'value === 0', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'frequency', name: 'Repetición de Anuncios', nameKey: 'kpi_catalog.kpis.frequency.name',
    description: '¿Cuántas veces ve el mismo usuario tu anuncio? Más de 4 veces y empiezan a ignorarlo o a ocultarlo. Es momento de rotar los creativos.',
    descKey: 'kpi_catalog.kpis.frequency.description',
    goalKey: 'kpi_catalog.kpis.frequency.businessGoal', icon: '🔄',
    formula: 'Impressions / Reach (estimated from posts)', goodValue: '< 4x per person',
    query: "SELECT ROUND(AVG(m.impressions / NULLIF(p.avg_reach, 0)), 2) AS freq FROM ad_metrics m CROSS JOIN (SELECT AVG(reach_count) AS avg_reach FROM posts WHERE reach_count > 0) p",
    categoryId: 'health_retention', targetExpr: 'value < 4', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'engagementRate', name: '¿Tu contenido engancha?', nameKey: 'kpi_catalog.kpis.engagementRate.name',
    description: 'De quienes ven tus posts, ¿cuántos reaccionan? Menos del 2% indica que el contenido no conecta con tu audiencia. Es hora de cambiar el enfoque.',
    descKey: 'kpi_catalog.kpis.engagementRate.description',
    goalKey: 'kpi_catalog.kpis.engagementRate.businessGoal', icon: '⚡',
    formula: 'AVG(interactions / reach × 100)', goodValue: '≥ 2%',
    query: "SELECT ROUND(AVG(er), 2) AS avg FROM (SELECT COUNT(i.interaction_id) * 100.0 / p.reach_count AS er FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id WHERE p.reach_count > 0 GROUP BY p.post_id)",
    categoryId: 'content_community', targetExpr: 'value >= 2', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'totalPosts', name: 'Volumen de Contenido', nameKey: 'kpi_catalog.kpis.totalPosts.name',
    description: '¿Qué tan activa está tu red? Más publicaciones significa más oportunidades de ser visto. Si el número no crece, tu presencia digital se estanca.',
    descKey: 'kpi_catalog.kpis.totalPosts.description',
    goalKey: 'kpi_catalog.kpis.totalPosts.businessGoal', icon: '📝',
    formula: 'SELECT COUNT(*) FROM posts', goodValue: 'Increasing trend month-over-month',
    query: 'SELECT COUNT(*) AS c FROM posts', categoryId: 'production',
    targetExpr: 'value > 0', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'postsPerYear', name: 'Ritmo de Publicación', nameKey: 'kpi_catalog.kpis.postsPerYear.name',
    description: '¿Publicas con suficiente consistencia? Menos de 12 publicaciones al año significa que tu audiencia te olvida entre post y post.',
    descKey: 'kpi_catalog.kpis.postsPerYear.description',
    goalKey: 'kpi_catalog.kpis.postsPerYear.businessGoal', icon: '📅',
    formula: 'COUNT(*) / (MAX(year) - MIN(year) + 1)', goodValue: '≥ 12 per year (weekly)',
    query: "SELECT CAST(strftime('%Y', MIN(timestamp)) AS INTEGER) AS min, CAST(strftime('%Y', MAX(timestamp)) AS INTEGER) AS max FROM posts WHERE timestamp IS NOT NULL",
    categoryId: 'production', targetExpr: 'value >= 12', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'avgReach', name: '¿A cuántos llegás?', nameKey: 'kpi_catalog.kpis.avgReach.name',
    description: 'Promedio de personas que ven cada publicación. Si este número baja, el algoritmo te está penalizando — mejora la calidad y publica en horarios de mayor actividad.',
    descKey: 'kpi_catalog.kpis.avgReach.description',
    goalKey: 'kpi_catalog.kpis.avgReach.businessGoal', icon: '👁️',
    formula: 'AVG(reach_count) FROM posts', goodValue: '≥ 5,000 per post',
    query: 'SELECT ROUND(AVG(reach_count), 0) AS avg FROM posts WHERE reach_count IS NOT NULL',
    categoryId: 'content', targetExpr: 'value >= 5000', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'topMedia', name: 'Formato Favorito', nameKey: 'kpi_catalog.kpis.topMedia.name',
    description: '¿El formato que más usas es el que mejor funciona? Si no coinciden, estás invirtiendo energía en el tipo de contenido equivocado.',
    descKey: 'kpi_catalog.kpis.topMedia.description',
    goalKey: 'kpi_catalog.kpis.topMedia.businessGoal', icon: '🎥',
    formula: 'SELECT media_type, COUNT(*) ... GROUP BY media_type ORDER BY count DESC', goodValue: 'Match between most-used and best-performing format',
    query: 'SELECT media_type, COUNT(*) AS c FROM posts WHERE media_type IS NOT NULL GROUP BY media_type ORDER BY c DESC LIMIT 1',
    categoryId: 'content', targetExpr: '', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'privacyLeader', name: 'Visibilidad del Contenido', nameKey: 'kpi_catalog.kpis.privacyLeader.name',
    description: '¿Cuánto de tu contenido es visible para todos? Si la mayoría no es público, estás limitando tu alcance orgánico y frenando el crecimiento de la página.',
    descKey: 'kpi_catalog.kpis.privacyLeader.description',
    goalKey: 'kpi_catalog.kpis.privacyLeader.businessGoal', icon: '🔒',
    formula: 'SELECT privacy, COUNT(*) ... GROUP BY privacy ORDER BY count DESC', goodValue: 'Majority "public" for maximum reach',
    query: 'SELECT privacy, COUNT(*) AS c FROM posts WHERE privacy IS NOT NULL GROUP BY privacy ORDER BY c DESC LIMIT 1',
    categoryId: 'content', targetExpr: '', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'dormantPages', name: 'Páginas sin Actividad', nameKey: 'kpi_catalog.kpis.dormantPages.name',
    description: 'Páginas que nunca han publicado nada. Son canales de distribución desperdiciados — actívalas o elimina las que no tienen ningún propósito.',
    descKey: 'kpi_catalog.kpis.dormantPages.description',
    goalKey: 'kpi_catalog.kpis.dormantPages.businessGoal', icon: '💤',
    formula: 'Pages without any posts', goodValue: '0 dormant pages',
    query: "SELECT COUNT(*) AS c FROM pages WHERE page_id NOT IN (SELECT DISTINCT page_id FROM posts WHERE page_id IS NOT NULL)",
    categoryId: 'content', targetExpr: 'value === 0', createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'totalFollowers', name: 'Red de Seguidores', nameKey: 'kpi_catalog.kpis.totalFollowers.name',
    description: 'Total de relaciones seguidor→seguido.',
    descKey: 'kpi_catalog.kpis.totalFollowers.description',
    goalKey: 'kpi_catalog.kpis.totalFollowers.businessGoal', icon: '👥',
    formula: 'COUNT(*) FROM followers', goodValue: 'Crecimiento positivo mes a mes',
    query: 'SELECT COUNT(*) AS avg FROM followers',
    categoryId: 'health_retention', targetExpr: 'value > 0',
    createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
  {
    id: 'orphanPosts', name: 'Contenido Sin Tipo', nameKey: 'kpi_catalog.kpis.orphanPosts.name',
    description: 'Posts con media_type=none.',
    descKey: 'kpi_catalog.kpis.orphanPosts.description',
    goalKey: 'kpi_catalog.kpis.orphanPosts.businessGoal', icon: '📭',
    formula: 'COUNT(*) WHERE media_type IS NULL OR none', goodValue: '< 5% del total',
    query: "SELECT COUNT(*) AS avg FROM posts WHERE media_type = 'none' OR media_type IS NULL",
    categoryId: 'content_community', targetExpr: 'value < 28500',
    createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
  },
]

class KpiStore {
  private kpis: KpiDefinition[] = []
  private categories: KpiCategory[] = []
  private listeners = new Set<() => void>()
  private progressListeners = new Set<(p: { current: number; total: number; message: string }) => void>()
  private _isInitialized = false
  private _isReloading = false

  get isInitialized() { return this._isInitialized }
  get isReloading() { return this._isReloading }

  onProgress(cb: (p: { current: number; total: number; message: string }) => void) {
    this.progressListeners.add(cb)
    return () => this.progressListeners.delete(cb)
  }

  private emitProgress(current: number, total: number, message: string) {
    this.progressListeners.forEach(cb => cb({ current, total, message }))
  }

  async init() {
    this._isInitialized = false
    this._isReloading = true
    const steps = [
      { message: 'Loading KPI definitions...', fn: () => this.loadFromWeb() },
      { message: 'Initializing categories...', fn: () => {} },
      { message: 'Finalizing...', fn: () => {} },
    ]

    for (let i = 0; i < steps.length; i++) {
      this.emitProgress(i + 1, steps.length, steps[i].message)
      steps[i].fn()
      await new Promise(r => setTimeout(r, 80))
    }

    this._isInitialized = true
    this._isReloading = false
    this.notifyListeners()
  }

  async reloadFromDb(db?: { queryAll: (sql: string) => Promise<Record<string, unknown>[]> }) {
    this._isReloading = true
    const steps = [
      { message: 'Clearing cache...', fn: () => { this.kpis = []; this.categories = [] } },
      { message: 'Loading from storage...', fn: () => {
        if (Platform.OS === 'web') { this.loadFromWeb() } else { void this.loadFromNative() }
      }},
      { message: `Loaded ${this.kpis.length} KPIs...`, fn: () => {} },
      { message: 'Refreshing UI...', fn: () => {} },
    ]

    for (let i = 0; i < steps.length; i++) {
      this.emitProgress(i + 1, steps.length, steps[i].message)
      steps[i].fn()
      await new Promise(r => setTimeout(r, 120))
    }

    this._isReloading = false
    this.notifyListeners()
  }

  private loadFromWeb() {
    try {
      const savedKpis = localStorage.getItem('fb_studio_kpis')
      const savedCats = localStorage.getItem('fb_studio_kpi_categories')

      if (savedKpis) {
        this.kpis = JSON.parse(savedKpis)
      } else {
        this.kpis = [...DEFAULT_KPIS]
      }

      if (savedCats) {
        this.categories = JSON.parse(savedCats)
      } else {
        this.categories = [...DEFAULT_CATEGORIES]
      }
    } catch {
      this.kpis = [...DEFAULT_KPIS]
      this.categories = [...DEFAULT_CATEGORIES]
    }
  }

  private persistWeb() {
    localStorage.setItem('fb_studio_kpis', JSON.stringify(this.kpis))
    localStorage.setItem('fb_studio_kpi_categories', JSON.stringify(this.categories))
  }

  private async loadFromNative() {
    try {
      const { readAsStringAsync, Paths } = await import('expo-file-system')
      const dir = `${Paths.document.uri}kpi_store/`
      const kpiUri = `${dir}kpis.json`
      const catUri = `${dir}categories.json`

      const kpiContent = await readAsStringAsync(kpiUri)
      this.kpis = JSON.parse(kpiContent)

      const catContent = await readAsStringAsync(catUri)
      this.categories = JSON.parse(catContent)
    } catch {
      this.kpis = [...DEFAULT_KPIS]
      this.categories = [...DEFAULT_CATEGORIES]
    }
  }

  private async persistNative() {
    try {
      const { writeAsStringAsync, Paths, makeDirectoryAsync } = await import('expo-file-system')
      const dir = `${Paths.document.uri}kpi_store/`
      try { await makeDirectoryAsync(dir, { intermediates: true }) } catch {}
      await writeAsStringAsync(`${dir}kpis.json`, JSON.stringify(this.kpis))
      await writeAsStringAsync(`${dir}categories.json`, JSON.stringify(this.categories))
    } catch {
    }
  }

  private async persist() {
    if (Platform.OS === 'web') {
      this.persistWeb()
    } else {
      await this.persistNative()
    }
    this.notifyListeners()
  }

  onChange(cb: () => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb())
  }

  getAllKpis(): KpiDefinition[] { return [...this.kpis] }
  getCategories(): KpiCategory[] { return [...this.categories].sort((a, b) => a.order - b.order) }

  getKpiById(id: string): KpiDefinition | undefined {
    return this.kpis.find(k => k.id === id)
  }

  getKpisByCategory(categoryId: string): KpiDefinition[] {
    return this.kpis.filter(k => k.categoryId === categoryId)
  }

  async addKpi(kpi: Omit<KpiDefinition, 'id' | 'createdAt' | 'updatedAt' | 'isCustom'>): Promise<KpiDefinition> {
    const newKpi: KpiDefinition = {
      ...kpi,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isCustom: true,
    }
    this.kpis.push(newKpi)
    await this.persist()
    return newKpi
  }

  async updateKpi(id: string, updates: Partial<KpiDefinition>): Promise<KpiDefinition | undefined> {
    const idx = this.kpis.findIndex(k => k.id === id)
    if (idx === -1) return undefined
    this.kpis[idx] = { ...this.kpis[idx], ...updates, updatedAt: Date.now() }
    await this.persist()
    return this.kpis[idx]
  }

  async deleteKpi(id: string): Promise<boolean> {
    const idx = this.kpis.findIndex(k => k.id === id)
    if (idx === -1) return false
    this.kpis.splice(idx, 1)
    await this.persist()
    return true
  }

  async moveKpiToCategory(kpiId: string, categoryId: string): Promise<boolean> {
    const kpi = this.kpis.find(k => k.id === kpiId)
    if (!kpi) return false
    kpi.categoryId = categoryId
    kpi.updatedAt = Date.now()
    await this.persist()
    return true
  }

  async addCategory(cat: Omit<KpiCategory, 'id' | 'order'>): Promise<KpiCategory> {
    const newCat: KpiCategory = {
      ...cat,
      id: `cat_${Date.now()}`,
      order: this.categories.length,
    }
    this.categories.push(newCat)
    await this.persist()
    return newCat
  }

  async updateCategory(id: string, updates: Partial<KpiCategory>): Promise<KpiCategory | undefined> {
    const idx = this.categories.findIndex(c => c.id === id)
    if (idx === -1) return undefined
    this.categories[idx] = { ...this.categories[idx], ...updates }
    await this.persist()
    return this.categories[idx]
  }

  async deleteCategory(id: string): Promise<boolean> {
    const idx = this.categories.findIndex(c => c.id === id)
    if (idx === -1) return false
    const defaultCat = this.categories[0]
    if (defaultCat) {
      this.kpis.filter(k => k.categoryId === id).forEach(k => { k.categoryId = defaultCat.id })
    }
    this.categories.splice(idx, 1)
    await this.persist()
    return true
  }

  async reorderCategories(ids: string[]): Promise<void> {
    const idSet = new Set(this.categories.map(c => c.id))
    for (const id of ids) {
      if (idSet.has(id)) {
        const cat = this.categories.find(c => c.id === id)
        if (cat) cat.order = ids.indexOf(id)
      }
    }
    await this.persist()
  }

  exportJson(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      categories: this.categories,
      kpis: this.kpis,
    }, null, 2)
  }
}

export const kpiStore = new KpiStore()
