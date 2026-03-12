import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, User } from 'lucide-react';

interface PocInfoBlockProps {
  project: {
    poc_name: string | null;
    poc_email: string | null;
    poc_phone: string | null;
  };
  maskData?: boolean;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
}

export function PocInfoBlock({ project, maskData = true }: PocInfoBlockProps) {
  return (
    <Card className="mb-4 border-[#023A2D]/20">
      <CardContent className="py-4">
        <div className="grid md:grid-cols-2 gap-4">
          {project.poc_name && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Point of Contact</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-[#023A2D]" />
                  <span className="font-medium">{project.poc_name}</span>
                </div>
                {project.poc_email && (
                  <a
                    href={`mailto:${project.poc_email}`}
                    className="flex items-center gap-2 text-sm text-[#023A2D] hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{maskData ? maskEmail(project.poc_email) : project.poc_email}</span>
                  </a>
                )}
                {project.poc_phone && (
                  <a
                    href={`tel:${project.poc_phone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{maskData ? maskPhone(project.poc_phone) : project.poc_phone}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Project Manager</h3>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-[#023A2D]" />
                <span className="font-medium">Jason Watson</span>
              </div>
              <a
                href="mailto:jason@amitrace.com"
                className="flex items-center gap-2 text-sm text-[#023A2D] hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                jason@amitrace.com
              </a>
              <a
                href="tel:770-263-9190"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
              >
                <Phone className="h-3.5 w-3.5" />
                770-263-9190
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
