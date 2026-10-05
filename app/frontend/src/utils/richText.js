const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'a', 'blockquote', 'div',
]);

const ALLOWED_ATTRS = {
  a: new Set(['href', 'target', 'rel']),
};

const LATEX_SYMBOLS = {
  mu: 'μ',
  micro: 'μ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  times: '×',
  pm: '±',
  circ: '°',
  deg: '°',
  degree: '°',
  Omega: 'Ω',
  omega: 'ω',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  cdot: '·',
  ldots: '…',
  infin: '∞',
  inf: '∞',
};

const unwrap = (el) => {
  const parent = el.parentNode;
  if (!parent) {
    el.remove();
    return;
  }
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
};

const convertLatexInner = (inner) => {
  let value = String(inner || '');
  const names = Object.keys(LATEX_SYMBOLS).sort((a, b) => b.length - a.length).join('|');
  const command = new RegExp(`\\\\(${names})(?![A-Za-z])`, 'g');
  value = value.replace(command, (_, name) => LATEX_SYMBOLS[name]);
  for (let i = 0; i < 4; i += 1) {
    value = value.replace(/\\(?:text|mathrm|textrm|mathbf|operatorname)\{([^}]*)\}/g, '$1');
  }
  value = value.replace(/\^\{?\\circ\}?/g, '°');
  value = value.replace(command, (_, name) => LATEX_SYMBOLS[name]);
  return value.replace(/[{}]/g, '');
};

export const latexToUnicode = (text) => {
  if (!text) return '';
  return convertLatexInner(
    String(text)
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => convertLatexInner(inner))
      .replace(/\$([^$\n]+)\$/g, (_, inner) => convertLatexInner(inner)),
  );
};

const decodeTextNodes = (root) => {
  [...root.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = latexToUnicode(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) decodeTextNodes(node);
  });
};

const sanitizeNode = (root) => {
  [...root.childNodes].forEach((node) => {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'].includes(tag)) {
      node.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      sanitizeNode(node);
      unwrap(node);
      return;
    }
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'class' || name === 'id') {
        node.removeAttribute(attr.name);
        return;
      }
      const allowed = ALLOWED_ATTRS[tag];
      if (!allowed || !allowed.has(name)) node.removeAttribute(attr.name);
    });
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (!/^(https?:\/\/|mailto:|tel:|#)/i.test(href)) node.removeAttribute('href');
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }
    sanitizeNode(node);
  });
};

export const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const stripHtml = (html) => String(html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

export const isEmptyHtml = (html) => !stripHtml(html);

export const looksLikeHtml = (value) => /<[a-z][\s\S]*>/i.test(String(value || ''));

export const sanitizeHtml = (dirty) => {
  if (typeof window === 'undefined' || !dirty) return '';
  const doc = new DOMParser().parseFromString(String(dirty), 'text/html');
  sanitizeNode(doc.body);
  decodeTextNodes(doc.body);
  return doc.body.innerHTML;
};

export const toEditorHtml = (value) => {
  const text = latexToUnicode(String(value || ''));
  if (!text.trim()) return '';
  if (looksLikeHtml(text)) return sanitizeHtml(text);
  return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
};

export const htmlFromClipboard = (html, plain) => {
  if (html && looksLikeHtml(html)) return sanitizeHtml(html);
  const lines = latexToUnicode(plain || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
};
