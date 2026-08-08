const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_SEMANTIC_PUNCTUATION = /[^a-z0-9:%/\s-]/g;
const EXTRA_SPACES = /\s+/g;

export function normalizeHubText(value: string) {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_SEMANTIC_PUNCTUATION, ' ')
    .replace(EXTRA_SPACES, ' ')
    .trim();
}

export function hubTokens(value: string) {
  return normalizeHubText(value).split(' ').filter(Boolean);
}

export function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
    }
    for (let index = 0; index <= right.length; index += 1) previous[index] = current[index];
  }

  return previous[right.length];
}

export function tokenMatches(token: string, target: string) {
  if (token === target) return true;
  if (token.length >= 4 && target.length >= 4 && (token.startsWith(target) || target.startsWith(token))) return true;
  const tolerance = target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0;
  return tolerance > 0 && levenshteinDistance(token, target) <= tolerance;
}

export function hasTokenLike(value: string, targets: string[]) {
  const tokens = hubTokens(value);
  return targets.some((target) => tokens.some((token) => tokenMatches(token, target)));
}

export function containsAny(value: string, phrases: string[]) {
  const normalized = normalizeHubText(value);
  return phrases.some((phrase) => normalized.includes(normalizeHubText(phrase)));
}

export function isAffirmative(value: string) {
  const normalized = normalizeHubText(value);
  if (/^(sim|s|pode|confirmo|confirmar|salvar|claro|isso|isso mesmo|correto|ok|okay)$/.test(normalized)) {
    return true;
  }

  return /^(?:sim\s+)?(?:pode\s+)?(?:confirmar|salvar)(?:\s+isso)?$/.test(normalized)
    || /^(?:pode\s+sim|sim\s+pode)(?:\s+(?:confirmar|salvar))?$/.test(normalized);
}

export function isNegative(value: string) {
  const normalized = normalizeHubText(value);
  return /^(nao|n|negativo|ainda nao|nao quero|cancelar essa acao)$/.test(normalized);
}
