import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timeline } from './Timeline';
import { buildTimelineEntry } from '../../test-factories';

describe('Timeline', () => {
  it('renders each entry with actor, action, and time', () => {
    render(
      <Timeline
        entries={[
          buildTimelineEntry(),
          buildTimelineEntry({
            actor: 'D. Reyes',
            action: 'submitted expense',
            tone: 'neutral',
            time: 'Jun 28, 2026 · 14:18:30 PT',
          }),
        ]}
      />,
    );
    expect(screen.getByText('M. Okafor')).toBeInTheDocument();
    expect(screen.getByText('approved expense')).toBeInTheDocument();
    expect(screen.getByText('Jun 28, 2026 · 14:18:30 PT')).toBeInTheDocument();
  });

  it('renders a before → after diff when provided', () => {
    render(
      <Timeline
        entries={[
          buildTimelineEntry({
            actor: 'System',
            action: 'routed to L2',
            tone: 'accent',
            time: 'Jun 28, 2026',
            diffFrom: 'Pending L1',
            diffTo: 'Pending L2',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Pending L1')).toBeInTheDocument();
    expect(screen.getByText('Pending L2')).toBeInTheDocument();
  });
});
