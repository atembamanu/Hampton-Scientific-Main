import { isEmptyHtml, toEditorHtml } from '../utils/richText';

export const ProductDescription = ({ html, className = '' }) => {
  const clean = toEditorHtml(html);
  if (isEmptyHtml(clean)) return null;
  return (
    <div
      className={`product-prose ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};
