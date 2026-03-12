import { Card, CardContent, CardHeader } from '@/components/ui/card';
import DOMPurify from 'isomorphic-dompurify';

interface CustomHtmlBlockProps {
  content?: string;
  title?: string;
}

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h3', 'h4', 'a', 'span', 'div', 'hr', 'img'];
const ALLOWED_ATTR = ['href', 'target', 'class', 'style', 'src', 'alt', 'width', 'height'];

export function CustomHtmlBlock({ content, title }: CustomHtmlBlockProps) {
  if (!content) return null;

  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <Card className="mb-4 border-[#023A2D]/20">
      {title && (
        <CardHeader className="py-3">
          <h2 className="text-sm font-semibold text-[#023A2D]">{title}</h2>
        </CardHeader>
      )}
      <CardContent className={title ? 'pt-0 pb-4' : 'py-4'}>
        <div
          className="prose prose-sm max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </CardContent>
    </Card>
  );
}
