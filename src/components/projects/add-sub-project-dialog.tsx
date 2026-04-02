'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { linkSubProject, searchProjectsForLinking } from '@/app/(dashboard)/projects/actions'

interface AddSubProjectDialogProps {
  parentId: string
  parentClientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddSubProjectDialog({
  parentId,
  parentClientName,
  open,
  onOpenChange,
}: AddSubProjectDialogProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { id: string; client_name: string; sales_order_number: string | null; sales_amount: number | null }[]
  >([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      setSelectedId(null)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (value.trim().length < 2) {
        setResults([])
        return
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true)
        try {
          const data = await searchProjectsForLinking(value.trim(), parentId)
          setResults(data)
        } catch {
          setResults([])
        } finally {
          setIsSearching(false)
        }
      }, 300)
    },
    [parentId]
  )

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedId(null)
    }
  }, [open])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function handleLink() {
    if (!selectedId) return

    startTransition(async () => {
      const result = await linkSubProject(parentId, selectedId)
      if (result.success) {
        toast.success('Sub-project linked successfully')
        if (result.fileMigrationWarning) {
          toast.warning(result.fileMigrationWarning, { duration: 10000 })
        }
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to link sub-project')
      }
    })
  }

  function handleCreateNew() {
    onOpenChange(false)
    router.push(
      `/projects/new?parentId=${parentId}&clientName=${encodeURIComponent(parentClientName)}`
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sub-Project</DialogTitle>
          <DialogDescription>
            Link an existing project or create a new sub-project.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="link">Link Existing</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 pt-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
              <Input
                placeholder="Search by client name or SO#..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isSearching && (
              <p className="text-muted-foreground text-sm">Searching...</p>
            )}

            {!isSearching && results.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {results.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === project.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{project.client_name}</span>
                      {project.sales_amount != null && (
                        <span className="text-muted-foreground text-xs">
                          ${project.sales_amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {project.sales_order_number && (
                      <span className="text-muted-foreground text-xs">
                        {project.sales_order_number}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!isSearching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-muted-foreground text-sm">No matching projects found.</p>
            )}

            <Button
              onClick={handleLink}
              disabled={!selectedId || isPending}
              className="w-full"
            >
              {isPending ? 'Linking...' : 'Link Sub-Project'}
            </Button>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 pt-2">
            <p className="text-muted-foreground text-sm">
              Create a new project that will be linked as a sub-project of{' '}
              <span className="text-foreground font-medium">{parentClientName}</span>.
            </p>
            <Button onClick={handleCreateNew} className="w-full">
              Create Sub-Project
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
