import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading3, Link as LinkIcon, RemoveFormatting } from 'lucide-react';

import { htmlFromClipboard, isEmptyHtml, sanitizeHtml, toEditorHtml } from '../../utils/richText';

const TOOLS = [
  { cmd: 'bold', icon: Bold, label: 'Bold' },
  { cmd: 'italic', icon: Italic, label: 'Italic' },
  { cmd: 'underline', icon: Underline, label: 'Underline' },
  { cmd: 'formatBlock', arg: 'h3', icon: Heading3, label: 'Heading' },
  { cmd: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

export const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Write a product description…',
  label = 'Description',
}) => {
  const surfaceRef = useRef(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || focusedRef.current) return;
    const next = toEditorHtml(value);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const emit = () => {
    const html = sanitizeHtml(surfaceRef.current?.innerHTML || '');
    onChange?.(isEmptyHtml(html) ? '' : html);
  };

  const run = (command, argument) => {
    surfaceRef.current?.focus();
    document.execCommand(command, false, argument);
    emit();
  };

  const addLink = () => {
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    run('createLink', url.trim());
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html') || '';
    const plain = event.clipboardData?.getData('text/plain') || '';
    const fragment = htmlFromClipboard(html, plain);
    if (!fragment) return;
    document.execCommand('insertHTML', false, fragment);
    emit();
  };

  return (
    <div className="rich-text-editor border border-ink/15 bg-white">
      <div className="flex flex-wrap gap-0.5 border-b border-ink/10 bg-cream/70 p-1">
        {TOOLS.map(({ cmd, arg, icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="rte-btn"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(cmd, arg)}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <button
          type="button"
          className="rte-btn"
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={addLink}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rte-btn"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run('removeFormat')}
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={surfaceRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder}
        className={`rich-text-surface product-prose min-h-[168px] px-3 py-2 text-sm text-ink outline-none ${isEmptyHtml(value) ? 'is-empty' : ''}`}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; emit(); }}
        onInput={emit}
        onPaste={handlePaste}
      />
    </div>
  );
};
