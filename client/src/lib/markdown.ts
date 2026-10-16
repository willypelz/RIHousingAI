/** Minimal, safe markdown renderer for assistant messages.
 *  Escapes all HTML first, then supports: **bold**, *italic*, `code`,
 *  [text](https://url) links, bullet/numbered lists, and headings. */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">$1</code>');
}

export function renderMarkdown(text: string): string {
  const lines = escapeHtml(text).split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    const heading = line.match(/^(#{1,4})\s+(.*)/);

    if (bullet) {
      if (listType !== 'ul') { closeList(); out.push('<ul class="my-1 ml-4 list-disc space-y-1">'); listType = 'ul'; }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (numbered) {
      if (listType !== 'ol') { closeList(); out.push('<ol class="my-1 ml-4 list-decimal space-y-1">'); listType = 'ol'; }
      out.push(`<li>${inline(numbered[1])}</li>`);
    } else if (heading) {
      closeList();
      out.push(`<p class="mt-2 font-bold">${inline(heading[2])}</p>`);
    } else if (line.trim() === '') {
      closeList();
      out.push('<div class="h-2"></div>');
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}
