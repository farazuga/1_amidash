'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTodos } from '@/hooks/queries/use-l10-todos';
import { useSubmitRating } from '@/hooks/queries/use-l10-meetings';
import { useUser } from '@/contexts/user-context';
import { toast } from 'sonner';
import type { MeetingWithDetails } from '@/types/l10';
import { cn } from '@/lib/utils';

interface ConcludeSegmentProps {
  meeting: MeetingWithDetails;
  teamId: string;
}

export function ConcludeSegment({ meeting, teamId }: ConcludeSegmentProps) {
  const { data: todos } = useTodos(teamId, false); // only open todos
  const { user } = useUser();
  const submitRating = useSubmitRating();
  const [rating, setRating] = useState<number>(0);
  const [explanation, setExplanation] = useState('');

  const existingRating = meeting.l10_meeting_ratings?.find((r) => r.user_id === user?.id);
  const allRatings = meeting.l10_meeting_ratings || [];

  const handleSubmitRating = async () => {
    if (rating === 0) return;
    if (rating < 8 && !explanation.trim()) {
      toast.error('Please explain why below 8');
      return;
    }
    try {
      await submitRating.mutateAsync({
        meetingId: meeting.id,
        rating,
        explanation: explanation.trim() || undefined,
      });
      toast.success('Rating submitted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  // New todos created during this meeting
  const meetingTodos = (todos || []).filter((t) => t.source_meeting_id === meeting.id || t.source_issue_id);

  return (
    <div className="space-y-6 rounded-md border p-4">
      <div>
        <h4 className="font-semibold">Conclude</h4>
        <p className="text-sm text-muted-foreground">Recap new to-dos and rate this meeting.</p>
      </div>

      {/* New todos recap */}
      <div className="space-y-2">
        <h5 className="text-sm font-medium">New To-Dos ({(todos || []).length})</h5>
        {(todos || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No new to-dos created.</p>
        ) : (
          <div className="space-y-1">
            {(todos || []).map((todo) => (
              <div key={todo.id} className="flex items-center gap-2 text-sm rounded-md border p-2">
                <span className="flex-1">{todo.title}</span>
                <span className="text-xs text-muted-foreground">{todo.profiles?.full_name?.split(' ')[0] || ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rating */}
      <div className="space-y-3">
        <h5 className="text-sm font-medium">Rate this Meeting</h5>
        {existingRating ? (
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="font-medium">{existingRating.rating}/10</span>
            {existingRating.explanation && (
              <span className="text-sm text-muted-foreground">— {existingRating.explanation}</span>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={cn(
                    'h-9 w-9 rounded-md border text-sm font-medium transition-colors',
                    rating === n
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {rating > 0 && rating < 8 && (
              <div className="space-y-2">
                <Label>What would make it an 8+ next time?</Label>
                <Textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Your feedback..."
                  rows={2}
                />
              </div>
            )}
            {rating > 0 && (
              <Button onClick={handleSubmitRating} disabled={submitRating.isPending}>
                {submitRating.isPending ? 'Submitting...' : 'Submit Rating'}
              </Button>
            )}
          </div>
        )}

        {/* Other ratings */}
        {allRatings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Team ratings:</p>
            <div className="flex gap-2 flex-wrap">
              {allRatings.map((r) => {
                const attendee = meeting.l10_meeting_attendees?.find((a) => a.user_id === r.user_id);
                return (
                  <div key={r.id} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    <span>{attendee?.profiles?.full_name?.split(' ')[0] || '?'}</span>
                    <span className="font-medium">{r.rating}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
