import { render, screen } from '@testing-library/react';
import { metrics } from '../domain/metrics';
import { pace } from '../domain/pace';
import { goal, res, TODAY } from '../test/fixtures';
import { VelocityStrip } from './VelocityStrip';

function show(hoursPerDay: number | null, resources = [res({ id: 'a', minutes: 600 })], o = {}) {
  const g = goal(resources, { hoursPerDay, ...o });
  const met = metrics(g.resources);
  return render(<VelocityStrip goal={g} met={met} pace={pace(g, met, TODAY)} />);
}

describe('VelocityStrip', () => {
  it('shows the buffer when on track', () => {
    show(2);
    expect(screen.getByText(/Velocity Buffer: \+1\.1h \/ day ahead/)).toBeVisible();
    expect(screen.getByText('Safe Margin')).toBeVisible();
    expect(screen.getByRole('img', { name: /Required 55m a day, planned 2h a day/ })).toBeVisible();
  });

  it('shows the gap when behind', () => {
    show(0.5);
    expect(screen.getByText(/Velocity Gap/)).toBeVisible();
    expect(screen.getByText('Over Capacity')).toBeVisible();
  });

  it('asks for daily hours when none are set', () => {
    show(null);
    expect(screen.getByText(/Daily pace needed/)).toBeVisible();
    expect(screen.getByText('Set daily hours')).toBeVisible();
  });

  it('says the date has passed, and hides for empty and finished plans', () => {
    const { unmount } = show(2, [res({ id: 'a', minutes: 600 })], { targetDate: '2026-03-09' });
    expect(screen.getByText('Target date has passed')).toBeVisible();
    unmount();
    expect(show(2, []).container).toBeEmptyDOMElement();
    expect(show(2, [res({ id: 'a', done: true })]).container).toBeEmptyDOMElement();
  });
});
