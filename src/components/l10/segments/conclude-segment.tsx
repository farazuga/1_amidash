'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTodos } from '@/hooks/queries/use-l10-todos';
import { useSubmitRating } from '@/hooks/queries/use-l10-meetings';
import { toast } from 'sonner';
import type { MeetingWithDetails, MeetingAttendeeWithProfile } from '@/types/l10';
import { cn } from '@/lib/utils';

interface ConcludeSegmentProps {
  meeting: MeetingWithDetails;
  teamId: string;
}

export function ConcludeSegment({ meeting, teamId }: ConcludeSegmentProps) {
  const { data: todos } = useTodos(teamId, false);
  const allRatings = meeting.l10_meeting_ratings || [];
  const attendees = meeting.l10_meeting_attendees || [];

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

      {/* Ratings - one row per attendee */}
      <div className="space-y-3">
        <h5 className="text-sm font-medium">Rate this Meeting</h5>
        {attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendees found.</p>
        ) : (
          <div className="space-y-3">
            {attendees.map((attendee) => {
              const existingRating = allRatings.find((r) => r.user_id === attendee.user_id);
              return (
                <AttendeeRatingRow
                  key={attendee.user_id}
                  attendee={attendee}
                  meetingId={meeting.id}
                  existingRating={existingRating ? { rating: existingRating.rating, explanation: existingRating.explanation } : null}
                />
              );
            })}
          </div>
        )}

        {/* Average */}
        {allRatings.length > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-muted p-3 mt-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium">
              Average: {(allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length).toFixed(1)}/10
            </span>
            <span className="text-xs text-muted-foreground">({allRatings.length}/{attendees.length} rated)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AttendeeRatingRow({
  attendee,
  meetingId,
  existingRating,
}: {
  attendee: MeetingAttendeeWithProfile;
  meetingId: string;
  existingRating: { rating: number; explanation: string | null } | null;
}) {
  const submitRating = useSubmitRating();
  const [rating, setRating] = useState<number>(existingRating?.rating || 0);
  const [explanation, setExplanation] = useState(existingRating?.explanation || '');
  const [submitted, setSubmitted] = useState(!!existingRating);

  const firstName = attendee.profiles?.full_name?.split(' ')[0] || attendee.profiles?.email || '?';

  const handleSubmit = async () => {
    if (rating === 0) return;
    if (rating < 8 && !explanation.trim()) {
      toast.error(`Please add an explanation for ${firstName}'s rating below 8`);
      return;
    }
    try {
      await submitRating.mutateAsync({
        meetingId,
        userId: attendee.user_id,
        rating,
        explanation: explanation.trim() || undefined,
      });
      setSubmitted(true);
      toast.success(`Rating saved for ${firstName}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{attendee.profiles?.full_name || attendee.profiles?.email}</span>
        {submitted && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            {rating}/10
          </span>
        )}
      </div>

      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => { setRating(n); setSubmitted(false); }}
            className={cn(
              'h-8 w-8 rounded-md border text-xs font-medium transition-colors',
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
        <Textarea
          value={explanation}
          onChange={(e) => { setExplanation(e.target.value); setSubmitted(false); }}
          placeholder="What would make it an 8+ next time?"
          rows={2}
          className="text-sm"
        />
      )}

      {rating > 0 && !submitted && (
        <Button size="sm" onClick={handleSubmit} disabled={submitRating.isPending}>
          {submitRating.isPending ? 'Saving...' : 'Save'}
        </Button>
      )}
    </div>
  );
}
