import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileImage, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export default async function PresalesFilesPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params

  const supabase = await createClient()

  const { data: files, error } = await supabase
    .from('presales_files')
    .select('*')
    .eq('activecampaign_deal_id', dealId)
    .order('created_at', { ascending: false })

  const dealName = files?.[0]?.activecampaign_deal_name ?? `Deal ${dealId}`
  const fileCount = files?.length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/upcoming-deals"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{dealName}</h1>
          <p className="text-sm text-muted-foreground">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load files. Please try again later.
        </div>
      )}

      {!error && fileCount === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FileImage className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No files uploaded</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No presales photos have been uploaded for this deal yet.
          </p>
        </div>
      )}

      {fileCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files!.map((file) => {
            const thumbnailUrl = file.local_thumbnail_url || file.thumbnail_url
            return (
              <Card key={file.id} className="overflow-hidden">
                <div className="relative aspect-[4/3] bg-muted">
                  {thumbnailUrl ? (
                    <a href={file.web_url ?? '#'} target="_blank" rel="noopener noreferrer" className="block h-full group">
                      <img
                        src={thumbnailUrl}
                        alt={file.file_name}
                        className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <ExternalLink className="h-6 w-6 text-white drop-shadow" />
                      </div>
                    </a>
                  ) : (
                    <a
                      href={file.web_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-full w-full items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <FileImage className="h-10 w-10 text-muted-foreground/50" />
                    </a>
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium truncate" title={file.file_name}>
                    {file.file_name}
                  </p>
                  {file.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {file.notes}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    {file.category && (
                      <Badge variant="secondary" className="text-xs truncate">
                        {file.category}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                      {file.created_at ? format(parseISO(file.created_at), 'MMM d, yyyy') : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
