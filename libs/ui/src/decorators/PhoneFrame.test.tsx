import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhoneFrame } from './PhoneFrame';

describe('PhoneFrame', () => {
  it('renders the status-bar time and its children', () => {
    render(
      <PhoneFrame time="9:41">
        <div>Screen content</div>
      </PhoneFrame>,
    );
    expect(screen.getByText('9:41')).toBeInTheDocument();
    expect(screen.getByText('Screen content')).toBeInTheDocument();
  });
});
