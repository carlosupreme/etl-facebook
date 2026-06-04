import { Platform } from 'react-native'

export interface KpiExportItem {
  id: string
  icon: string
  name: string
  description: string
  formula: string
  target: string
  categoryId: string
  currentValue: string | number | null
  status: 'good' | 'ok' | 'bad' | null
}

const STATUS_COLOR: Record<string, string> = {
  good: '#16A34A',
  ok:   '#D97706',
  bad:  '#DC2626',
}

const STATUS_LABEL: Record<string, string> = {
  good: 'Saludable',
  ok:   'Necesita atención',
  bad:  'Requiere acción',
}

const CATEGORY_LABEL: Record<string, string> = {
  paid_media:        'Medios Pagados',
  health_retention:  'Salud y Retención',
  content_community: 'Contenido / Comunidad',
  production:        'Producción',
  content:           'Contenido',
}

function buildHtml(kpis: KpiExportItem[], generatedAt: string): string {
  const cards = kpis.map(kpi => {
    const color  = kpi.status ? STATUS_COLOR[kpi.status] : '#9CA3AF'
    const badge  = kpi.status ? STATUS_LABEL[kpi.status] : 'Sin datos'
    const value  = kpi.currentValue !== null && kpi.currentValue !== undefined
      ? String(kpi.currentValue)
      : '—'
    const cat    = CATEGORY_LABEL[kpi.categoryId] ?? kpi.categoryId

    return `
      <div class="card">
        <div class="card-top">
          <span class="icon">${kpi.icon}</span>
          <div class="meta">
            <div class="name">${kpi.name}</div>
            <div class="cat">${cat}</div>
            <div class="desc">${kpi.description}</div>
          </div>
          <div class="right">
            <div class="value">${value}</div>
            <span class="badge" style="background:${color}18;color:${color};border:1px solid ${color}33">
              ${badge}
            </span>
          </div>
        </div>
        <div class="card-bot">
          <span class="mono">⚙ ${kpi.formula}</span>
          <span class="mono">🎯 Meta: ${kpi.target}</span>
        </div>
      </div>`
  }).join('\n')

  const good = kpis.filter(k => k.status === 'good').length
  const ok   = kpis.filter(k => k.status === 'ok').length
  const bad  = kpis.filter(k => k.status === 'bad').length

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte KPIs — FB Studio</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F6FA;color:#111827;padding:28px;font-size:13px}
  .header{background:linear-gradient(135deg,#C47A1E,#D97706);color:#fff;border-radius:14px;padding:24px 28px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}
  .header h1{font-size:22px;font-weight:800;letter-spacing:-0.5px}
  .header p{font-size:12px;opacity:.8;margin-top:4px}
  .summary{display:flex;gap:12px;margin-bottom:20px}
  .chip{flex:1;border-radius:10px;padding:12px 16px;text-align:center;border:1px solid}
  .chip .n{font-size:24px;font-weight:800}
  .chip .l{font-size:11px;margin-top:2px;opacity:.8}
  .chip-g{background:#16A34A10;border-color:#16A34A33;color:#16A34A}
  .chip-o{background:#D9770610;border-color:#D9770633;color:#D97706}
  .chip-r{background:#DC262610;border-color:#DC262633;color:#DC2626}
  .card{background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,.08);padding:16px;margin-bottom:10px;box-shadow:0 1px 6px rgba(0,0,0,.05);page-break-inside:avoid}
  .card-top{display:flex;gap:12px;align-items:flex-start}
  .icon{font-size:26px;flex-shrink:0;line-height:1}
  .meta{flex:1}
  .name{font-size:14px;font-weight:700;color:#111827}
  .cat{font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:#9CA3AF;margin-top:2px}
  .desc{font-size:12px;color:#6B7280;margin-top:5px;line-height:1.45}
  .right{text-align:right;flex-shrink:0}
  .value{font-size:22px;font-weight:800;color:#C47A1E;line-height:1}
  .badge{font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;margin-top:6px;display:inline-block;white-space:nowrap}
  .card-bot{margin-top:12px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06);display:flex;gap:16px;flex-wrap:wrap}
  .mono{font-family:monospace;font-size:11px;color:#9CA3AF}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#9CA3AF}
  @media print{body{background:#fff;padding:0} .header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📊 Reporte de KPIs</h1>
      <p>FB Studio Mobile &nbsp;·&nbsp; ${generatedAt}</p>
    </div>
    <div style="text-align:right;color:rgba(255,255,255,.85);font-size:12px">
      <div style="font-size:20px;font-weight:800">${kpis.length} KPIs</div>
      <div>analizados</div>
    </div>
  </div>

  <div class="summary">
    <div class="chip chip-g"><div class="n">${good}</div><div class="l">Saludables</div></div>
    <div class="chip chip-o"><div class="n">${ok}</div><div class="l">Atención</div></div>
    <div class="chip chip-r"><div class="n">${bad}</div><div class="l">Acción requerida</div></div>
  </div>

  ${cards}

  <div class="footer">Generado por FB Studio Mobile &nbsp;·&nbsp; ${generatedAt}</div>
</body>
</html>`
}

export async function exportKpiPdf(kpis: KpiExportItem[]): Promise<void> {
  const generatedAt = new Date().toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const html = buildHtml(kpis, generatedAt)

  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (win) {
      win.addEventListener('load', () => {
        win.print()
        URL.revokeObjectURL(url)
      })
    }
    return
  }

  const { printAsync } = await import('expo-print')
  await printAsync({ html })
}
