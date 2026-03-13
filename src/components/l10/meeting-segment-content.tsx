'use client';

import type { MeetingWithDetails, MeetingSegment } from '@/types/l10';
import { SegueSegment } from './segments/segue-segment';
import { ScorecardSegment } from './segments/scorecard-segment';
import { RockReviewSegment } from './segments/rock-review-segment';
import { HeadlinesSegment } from './segments/headlines-segment';
import { TodoReviewSegment } from './segments/todo-review-segment';
import { IdsSegment } from './segments/ids-segment';
import { ConcludeSegment } from './segments/conclude-segment';

interface MeetingSegmentContentProps {
  segment: MeetingSegment;
  meeting: MeetingWithDetails;
  teamId: string;
}

export function MeetingSegmentContent({ segment, meeting, teamId }: MeetingSegmentContentProps) {
  switch (segment) {
    case 'segue':
      return <SegueSegment meeting={meeting} teamId={teamId} />;
    case 'scorecard':
      return <ScorecardSegment teamId={teamId} />;
    case 'rock_review':
      return <RockReviewSegment teamId={teamId} />;
    case 'headlines':
      return <HeadlinesSegment meeting={meeting} teamId={teamId} />;
    case 'todo_review':
      return <TodoReviewSegment teamId={teamId} />;
    case 'ids':
      return <IdsSegment teamId={teamId} />;
    case 'conclude':
      return <ConcludeSegment meeting={meeting} teamId={teamId} />;
    default:
      return null;
  }
}
