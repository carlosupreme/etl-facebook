export interface EvalContext {
  value: number
  pct?: number
  trend?: number
  total?: number
  count?: number
}

const ALLOWED_TOKENS = /^[a-zA-Z_][a-zA-Z0-9_]*$|^[0-9]*\.?[0-9]+$|^[+\-*/().<>!=&|]+$/
const ALLOWED_CHARS = /^[a-zA-Z0-9_.+\-*/()<>=!&| %]+$/

const SAFE_KEYWORDS = new Set([
  'value', 'pct', 'trend', 'total', 'count',
  'true', 'false', 'Math', 'min', 'max', 'abs', 'round', 'floor', 'ceil', 'sqrt',
  'avg', 'std', 'percentile',
])

function tokenize(expr: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue }
    if ('+-*/().'.includes(expr[i])) { tokens.push(expr[i]); i++; continue }
    if (expr[i] === '!' && expr[i + 1] === '=') { tokens.push('!='); i += 2; continue }
    if (expr[i] === '>' && expr[i + 1] === '=') { tokens.push('>='); i += 2; continue }
    if (expr[i] === '<' && expr[i + 1] === '=') { tokens.push('<='); i += 2; continue }
    if (expr[i] === '>' && expr[i + 1] === '>') { tokens.push('>>'); i += 2; continue }
    if (expr[i] === '<' && expr[i + 1] === '<') { tokens.push('<<'); i += 2; continue }
    if (expr[i] === '&' && expr[i + 1] === '&') { tokens.push('&&'); i += 2; continue }
    if (expr[i] === '|' && expr[i + 1] === '|') { tokens.push('||'); i += 2; continue }
    if (expr[i] === '=' && expr[i + 1] === '=') { tokens.push('=='); i += 2; continue }
    if (expr[i] === '=' && expr[i + 1] !== '=') { tokens.push('=='); i++; continue }

    let word = ''
    while (i < expr.length && !expr[i].match(/\s/) && !'+-*/().'.includes(expr[i]) && !(expr[i] === '!' && expr[i + 1] === '=') && !(expr[i] === '>' && expr[i + 1] === '=') && !(expr[i] === '<' && expr[i + 1] === '=') && !(expr[i] === '>' && expr[i + 1] === '>') && !(expr[i] === '<' && expr[i + 1] === '<') && !(expr[i] === '&' && expr[i + 1] === '&') && !(expr[i] === '|' && expr[i + 1] === '|') && !(expr[i] === '=')) {
      word += expr[i]
      i++
    }
    if (word) tokens.push(word)
  }
  return tokens
}

function parseNumber(tokens: string[], pos: { i: number }): number {
  if (pos.i >= tokens.length) throw new Error('Expected number')
  const t = tokens[pos.i]
  pos.i++
  const n = Number(t)
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${t}`)
  return n
}

function resolveVar(name: string, ctx: EvalContext): number {
  const v = ctx[name as keyof EvalContext]
  if (typeof v === 'number') return v
  throw new Error(`Unknown variable: ${name}`)
}

function evaluate(tokens: string[], pos: { i: number }, ctx: EvalContext): boolean {
  const left = evalExpr(tokens, pos, ctx)
  if (pos.i >= tokens.length) return Boolean(left)

  const op = tokens[pos.i]

  if (op === '&&') {
    pos.i++
    const r = evaluate(tokens, pos, ctx)
    return Boolean(left) && r
  }
  if (op === '||') {
    pos.i++
    const r = evaluate(tokens, pos, ctx)
    return Boolean(left) || r
  }

  if (!['<', '>', '<=', '>=', '==', '!='].includes(op)) {
    throw new Error(`Expected comparison operator, got: ${op}`)
  }
  pos.i++

  const right = evalExpr(tokens, pos, ctx)

  switch (op) {
    case '<': return left < right
    case '>': return left > right
    case '<=': return left <= right
    case '>=': return left >= right
    case '==': return left === right
    case '!=': return left !== right
    default: return false
  }
}

function evalExpr(tokens: string[], pos: { i: number }, ctx: EvalContext): number {
  return evalTerm(tokens, pos, ctx)
}

function evalTerm(tokens: string[], pos: { i: number }, ctx: EvalContext): number {
  let left = evalFactor(tokens, pos, ctx)
  while (pos.i < tokens.length && (tokens[pos.i] === '+' || tokens[pos.i] === '-')) {
    const op = tokens[pos.i]
    pos.i++
    const right = evalFactor(tokens, pos, ctx)
    left = op === '+' ? left + right : left - right
  }
  return left
}

function evalFactor(tokens: string[], pos: { i: number }, ctx: EvalContext): number {
  let left = evalPrimary(tokens, pos, ctx)
  while (pos.i < tokens.length && (tokens[pos.i] === '*' || tokens[pos.i] === '/')) {
    const op = tokens[pos.i]
    pos.i++
    const right = evalPrimary(tokens, pos, ctx)
    left = op === '*' ? left * right : left / right
  }
  return left
}

function evalPrimary(tokens: string[], pos: { i: number }, ctx: EvalContext): number {
  if (pos.i >= tokens.length) throw new Error('Unexpected end of expression')

  const t = tokens[pos.i]

  if (t === '(') {
    pos.i++
    const result = evalExpr(tokens, pos, ctx)
    if (tokens[pos.i] !== ')') throw new Error('Missing closing parenthesis')
    pos.i++
    return result
  }

  if (t === '-') {
    pos.i++
    return -evalPrimary(tokens, pos, ctx)
  }

  if (t === 'true') { pos.i++; return 1 }
  if (t === 'false') { pos.i++; return 0 }

  const num = Number(t)
  if (Number.isFinite(num)) {
    pos.i++
    return num
  }

  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) {
    pos.i++
    return resolveVar(t, ctx)
  }

  throw new Error(`Unexpected token: ${t}`)
}

export function evalTargetExpression(expr: string, ctx: EvalContext): boolean {
  if (!expr || expr.trim().length === 0) return true

  const trimmed = expr.trim()
  if (!ALLOWED_CHARS.test(trimmed)) throw new Error(`Expression contains invalid characters: ${trimmed}`)

  const tokens = tokenize(trimmed)
  if (tokens.length === 0) return true

  return evaluate(tokens, { i: 0 }, ctx)
}

export function validateExpression(expr: string): string | null {
  if (!expr || expr.trim().length === 0) return null
  try {
    evalTargetExpression(expr, { value: 0, pct: 0, trend: 0, total: 0, count: 0 })
    return null
  } catch (e: any) {
    return e.message
  }
}

export function getExpressionHint(): string {
  return 'Use: value, pct, trend, total, count with operators: >, <, >=, <=, ==, !=, &&, ||\nExamples: value >= 100, pct < 10 && trend > 0, value * 1.1 > total'
}
