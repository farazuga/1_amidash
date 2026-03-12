'use client';

import { useState } from 'react';
import { Plus, ArrowRightLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHeadlines, createHeadline, deleteHeadline, dropHeadlineToIssue } from '@/app/(dashboard)/l10/headlines-actions';
import { toast } from 'sonner';
import type { MeetingWithDetails, HeadlineSentiment } from '@/types/l10';
import { cn } from '@/lib/utils';

const SENTIMENT_COLORS: Record<HeadlineSentiment, string> = {
  good: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  bad: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

interface HeadlinesSegmentProps {
  meeting: MeetingWithDetails;
  teamId: string;
}

export function HeadlinesSegment({ meeting, teamId }: HeadlinesSegmentProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('customer');
  const [sentiment, setSentiment] = useState<string>('neutral');

  const { data: headlines, isLoading } = useQuery({
    queryKey: ['l10', 'headlines', teamId, meeting.id],
    queryFn: async () => {
      const result = await getHeadlines(teamId, meeting.id);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
  });

  const addHeadline = useMutation({
    mutationFn: async () => {
      const result = await createHeadline({
        teamId,
        title: title.trim(),
        category,
        sentiment,
        meetingId: meeting.id,
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['l10', 'headlines'] });
      setTitle('');
    },
  });

  const removeHeadline = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteHeadline(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['l10', 'headlines'] });
    },
  });

  const dropToIssue = useMutation({
    mutationFn: async (headlineId: string) => {
      const result = await dropHeadlineToIssue(headlineId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['l10', 'issues'] });
      toast.success('Added to Issues');
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await addHeadline.mutateAsync();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <h4 className="font-semibold">Headlines</h4>
        <p className="text-sm text-muted-foreground">Share good and bad news. Drop important items to Issues.</p>
      </div>

      {/* Add headline form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Share a headline..."
          className="flex-1"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sentiment} onValueChange={setSentiment}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="bad">Bad</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="icon" disabled={!title.trim() || addHeadline.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {/* Headlines list */}
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      ) : (
        <div className="space-y-1">
          {(!headlines || headlines.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">No headlines yet.</p>
          )}
          {headlines?.map((h) => (
            <div key={h.id} className="flex items-center gap-2 rounded-md border p-2">
              <span className={cn('rounded px-2 py-0.5 text-xs font-medium', SENTIMENT_COLORS[(h.sentiment as HeadlineSentiment) || 'neutral'])}>
                {h.sentiment || 'neutral'}
              </span>
              <Badge variant="outline" className="text-xs">{h.category || '—'}</Badge>
              <span className="flex-1 text-sm">{h.title}</span>
              <span className="text-xs text-muted-foreground">{h.profiles?.full_name?.split(' ')[0] || ''}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dropToIssue.mutate(h.id)} title="Drop to Issues">
                <ArrowRightLeft className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeHeadline.mutate(h.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
